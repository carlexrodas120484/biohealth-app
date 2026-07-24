/**
 * POST /api/documentos/generar
 *
 * Reemplaza a pdfFormula() / pdfPlan() del prototipo, que corrían
 * enteramente en el navegador contra el array mock `BIBLIOTECA` y el
 * estado `S`. Acá se lee la consulta real desde Supabase, se arma el
 * mismo contenido validado, y se renderiza en el servidor.
 *
 * Corre en runtime de Node (no Edge) porque Puppeteer necesita un
 * proceso hijo real — ver la nota en lib/pdf/render.ts.
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderPdf } from '@/lib/pdf/render';
import { plantillaFormulaMagistral, plantillaPlanPaciente } from '@/lib/pdf/plantillas';
import { FASES, type Fase } from '@/lib/algoritmo/fases';
import { z } from 'zod';

const BodySchema = z.object({
  consultaId: z.string().uuid(),
  tipo: z.enum(['formula_magistral', 'plan_paciente']),
});

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  }
  const { consultaId, tipo } = parsed.data;

  const supabase = await createClient();

  // RLS filtra automáticamente por tenant_id del usuario autenticado —
  // esta consulta no puede devolver datos de otro consultorio aunque
  // el consultaId sea válido pero ajeno.
  const { data: consulta, error: errConsulta } = await supabase
    .from('consultas')
    .select('*, pacientes(*), fase_asignaciones(fase, confirmada), formulas(*, formula_items(*)), plan_nutricional(*)')
    .eq('id', consultaId)
    .single();

  if (errConsulta || !consulta) {
    return NextResponse.json({ error: 'Consulta no encontrada' }, { status: 404 });
  }

  const paciente = (consulta as any).pacientes;
  const faseAsignada = ((consulta as any).fase_asignaciones?.find((f: any) => f.confirmada)?.fase ?? 'balance') as Fase;
  const formulaRow = (consulta as any).formulas?.[0];

  const formula = {
    id: formulaRow?.id ?? '',
    consultaId,
    firmada: formulaRow?.firmada ?? false,
    firmadaPor: formulaRow?.firmada_por ?? null,
    firmadaEn: formulaRow?.firmada_en ?? null,
    versionReglas: formulaRow?.version_reglas ?? 'v1.0',
    items: (formulaRow?.formula_items ?? []).map((i: any) => ({
      activoId: i.activo_id, nombre: i.nombre, dosisIndicada: i.dosis_indicada,
    })),
  };

  if (tipo === 'formula_magistral' && formula.items.length === 0) {
    return NextResponse.json({ error: 'La fórmula no tiene activos agregados' }, { status: 422 });
  }

  const html = tipo === 'formula_magistral'
    ? plantillaFormulaMagistral(paciente, faseAsignada, formula)
    : plantillaPlanPaciente(
        paciente, faseAsignada, formula,
        (consulta as any).plan_nutricional?.[0]?.priorizar ?? FASES[faseAsignada].objetivos.join(', '),
        (consulta as any).plan_nutricional?.[0]?.evitar ?? ''
      );

  const pdf = await renderPdf(html);

  // se registra el documento generado — trazabilidad de qué se le entregó al paciente y cuándo
  await (supabase.from('documentos_generados') as any).insert({
    consulta_id: consultaId, tipo, generado_en: new Date().toISOString(),
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${tipo}_${paciente.nombre.replace(/\s+/g, '_').toLowerCase()}.pdf"`,
    },
  });
}
