export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { renderPdf } from '@/lib/pdf/render';
import { informeMedico, informePaciente, recetaBotica } from '@/lib/pdf/documentos-clinicos';
import type { Fase } from '@/lib/algoritmo/fases';

const Schema = z.object({ tipo: z.enum(['receta_botica', 'informe_medico', 'informe_paciente']) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Tipo de documento inválido.' }, { status: 422 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const { data: usuario } = await supabase.from('usuarios').select('tenant_id').eq('auth_id', user.id).maybeSingle();
  const tenantId = (usuario as { tenant_id?: string } | null)?.tenant_id;
  if (!tenantId) return NextResponse.json({ error: 'Usuario sin consultorio vinculado.' }, { status: 403 });

  const [paciente, formulacion] = await Promise.all([
    supabase.from('pacientes').select('nombre,apellido,documento,fecha_nacimiento,sexo,telefono,motivo_consulta,antecedentes_personales,medicamentos_actuales,alergias').eq('id', id).eq('tenant_id', tenantId).is('deleted_at', null).maybeSingle(),
    supabase.from('formulaciones_terapeuticas').select('*').eq('paciente_id', id).eq('tenant_id', tenantId).maybeSingle(),
  ]);
  if (paciente.error || !paciente.data) return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 });
  if (formulacion.error || !formulacion.data) return NextResponse.json({ error: 'La formulación no existe.' }, { status: 404 });

  const f = formulacion.data as unknown as { id: string; fase: Fase; objetivos: string[]; items: Array<{ nombre: string; dosis: string; presentacion?: string; cantidad?: string; indicacion: string; observaciones?: string; evidencia?: string; fuente?: string }>; revision_clinica?: Record<string, string>; firmada: boolean; firmada_en?: string | null; version_reglas?: string };
  if (!f.firmada) return NextResponse.json({ error: 'Primero debe firmar la formulación.' }, { status: 409 });
  if (!Array.isArray(f.items) || f.items.length === 0) return NextResponse.json({ error: 'La formulación no tiene componentes.' }, { status: 422 });

  const generadores = { receta_botica: recetaBotica, informe_medico: informeMedico, informe_paciente: informePaciente };
  const html = generadores[parsed.data.tipo](paciente.data, f);
  const pdf = await renderPdf(html);
  const nombre = `${parsed.data.tipo}_${String((paciente.data as { nombre: string }).nombre).replace(/\s+/g, '_').toLowerCase()}.pdf`;

  await (supabase.from('documentos_clinicos_generados') as any).insert({
    tenant_id: tenantId, paciente_id: id, formulacion_id: f.id, tipo: parsed.data.tipo, generado_por: user.id,
  });

  return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nombre}"` } });
}
