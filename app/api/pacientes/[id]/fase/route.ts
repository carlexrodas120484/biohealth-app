import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DOMINIOS, seleccionarFase, type Fase } from '@/lib/algoritmo/fases';
import type { AlteracionInput } from '@/lib/algoritmo/ipt';
import { createClient } from '@/lib/supabase/server';

const Fases = z.enum(['restore', 'repair', 'reset', 'target', 'regenerate', 'balance']);
const DominiosFase = z.enum([
  DOMINIOS.BARRERA, DOMINIOS.INFLAMATORIO, DOMINIOS.TOXICO_METABOLICO,
  DOMINIOS.EJE_ESPECIFICO, DOMINIOS.DEFICIT_RESIDUAL,
]);
const ClasificacionSchema = z.object({ alteracionId: z.string().min(1), dominioFase: DominiosFase });
const DatosSchema = z.object({
  clasificaciones: z.array(ClasificacionSchema).max(50),
  faseSeleccionada: Fases,
  motivoAnulacion: z.string().trim().max(1000),
  confirmado: z.boolean(),
});

type AlteracionDiagnostica = {
  id: string; nombre: string; dominio: string;
  nivel: 'primaria' | 'secundaria' | 'terciaria';
};
type Evaluacion = Omit<AlteracionInput, 'id' | 'nombre' | 'dominio' | 'nivel'> & { alteracionId: string };

const BANDERAS = ['fiebrePersistente', 'perdidaPesoInvoluntaria', 'sangrado', 'dolorToracico', 'disneaReposo', 'deficitNeurologico'];

function sugerirDominio(dominio: string): string {
  const d = dominio.toLowerCase();
  if (d.includes('digest') || d.includes('inmun')) return DOMINIOS.BARRERA;
  if (d.includes('inflam') || d.includes('cardio')) return DOMINIOS.INFLAMATORIO;
  if (d.includes('metab') || d.includes('detox') || d.includes('nutri')) return DOMINIOS.TOXICO_METABOLICO;
  if (d.includes('hormon') || d.includes('neuro') || d.includes('endocr')) return DOMINIOS.EJE_ESPECIFICO;
  return DOMINIOS.DEFICIT_RESIDUAL;
}

async function contexto(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  const { data: usuario } = await supabase.from('usuarios').select('tenant_id').eq('auth_id', user.id).maybeSingle();
  const tenantId = (usuario as { tenant_id?: string } | null)?.tenant_id;
  if (!tenantId) return { error: NextResponse.json({ error: 'Usuario sin consultorio vinculado.' }, { status: 403 }) };
  const { data: paciente } = await supabase.from('pacientes').select('id').eq('id', id)
    .eq('tenant_id', tenantId).is('deleted_at', null).maybeSingle();
  if (!paciente) return { error: NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 }) };
  return { supabase, tenantId };
}

async function fuentes(ctx: Exclude<Awaited<ReturnType<typeof contexto>>, { error: NextResponse }>, id: string) {
  const [diagnostico, ipt, historia, guardada] = await Promise.all([
    ctx.supabase.from('diagnosticos_funcionales').select('alteraciones').eq('paciente_id', id).maybeSingle(),
    ctx.supabase.from('ipt_evaluaciones').select('evaluaciones,confirmado').eq('paciente_id', id).maybeSingle(),
    ctx.supabase.from('historias_clinicas').select('historia').eq('paciente_id', id).maybeSingle(),
    ctx.supabase.from('fases_terapeuticas').select('*').eq('paciente_id', id).maybeSingle(),
  ]);
  const error = diagnostico.error ?? ipt.error ?? historia.error ?? guardada.error;
  if (error) throw new Error(error.message);
  return { diagnostico: diagnostico.data, ipt: ipt.data, historia: historia.data, guardada: guardada.data };
}

function prepararEntradas(alteraciones: AlteracionDiagnostica[], evaluaciones: Evaluacion[], clasificaciones: { alteracionId: string; dominioFase: string }[]) {
  const evaluacionPorId = new Map(evaluaciones.map(e => [e.alteracionId, e]));
  const clasificacionPorId = new Map(clasificaciones.map(c => [c.alteracionId, c.dominioFase]));
  return alteraciones.flatMap<AlteracionInput>(a => {
    const e = evaluacionPorId.get(a.id);
    if (!e) return [];
    return [{ ...a, ...e, dominio: clasificacionPorId.get(a.id) ?? sugerirDominio(a.dominio) }];
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;
  try {
    const f = await fuentes(ctx, id);
    const alteraciones = ((f.diagnostico as { alteraciones?: AlteracionDiagnostica[] } | null)?.alteraciones ?? []);
    const evaluaciones = ((f.ipt as { evaluaciones?: Evaluacion[] } | null)?.evaluaciones ?? []);
    const guardada = f.guardada as any;
    const clasificaciones = guardada?.clasificaciones ?? alteraciones.map(a => ({ alteracionId: a.id, dominioFase: sugerirDominio(a.dominio) }));
    const historia = (f.historia as { historia?: Record<string, unknown> } | null)?.historia ?? {};
    const banderaRoja = BANDERAS.some(c => historia[c] === true);
    const entradas = prepararEntradas(alteraciones, evaluaciones, clasificaciones);
    const resultado = seleccionarFase(entradas, banderaRoja);
    return NextResponse.json({
      alteraciones, evaluaciones, clasificaciones, banderaRoja,
      iptConfirmado: Boolean((f.ipt as { confirmado?: boolean } | null)?.confirmado),
      faseSugerida: resultado.fase, compuertas: resultado.compuertas, derivado: resultado.derivado,
      faseSeleccionada: guardada?.fase_seleccionada ?? resultado.fase,
      motivoAnulacion: guardada?.motivo_anulacion ?? '', confirmado: guardada?.confirmado ?? false,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo cargar la fase.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;
  const parsed = DatosSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Datos de fase inválidos.' }, { status: 422 });
  try {
    const f = await fuentes(ctx, id);
    if (!(f.ipt as { confirmado?: boolean } | null)?.confirmado) return NextResponse.json({ error: 'Confirme primero el IPT.' }, { status: 409 });
    const alteraciones = ((f.diagnostico as { alteraciones?: AlteracionDiagnostica[] } | null)?.alteraciones ?? []);
    const evaluaciones = ((f.ipt as { evaluaciones?: Evaluacion[] } | null)?.evaluaciones ?? []);
    const ids = new Set(alteraciones.map(a => a.id));
    if (parsed.data.clasificaciones.length !== alteraciones.length || parsed.data.clasificaciones.some(c => !ids.has(c.alteracionId))) {
      return NextResponse.json({ error: 'El diagnóstico cambió. Recargue la página.' }, { status: 409 });
    }
    const historia = (f.historia as { historia?: Record<string, unknown> } | null)?.historia ?? {};
    const banderaRoja = BANDERAS.some(c => historia[c] === true);
    const resultado = seleccionarFase(prepararEntradas(alteraciones, evaluaciones, parsed.data.clasificaciones), banderaRoja);
    if (resultado.derivado && parsed.data.confirmado) return NextResponse.json({ error: 'Existe una bandera roja: derive o estabilice antes de confirmar una fase.' }, { status: 409 });
    if (parsed.data.faseSeleccionada !== resultado.fase && !parsed.data.motivoAnulacion) {
      return NextResponse.json({ error: 'Escriba el motivo clínico para modificar la fase sugerida.' }, { status: 422 });
    }
    const { error } = await (ctx.supabase.from('fases_terapeuticas') as any).upsert({
      tenant_id: ctx.tenantId, paciente_id: id, clasificaciones: parsed.data.clasificaciones,
      fase_sugerida: resultado.fase, fase_seleccionada: parsed.data.faseSeleccionada,
      compuertas: resultado.compuertas, bandera_roja: banderaRoja,
      motivo_anulacion: parsed.data.faseSeleccionada === resultado.fase ? null : parsed.data.motivoAnulacion,
      confirmado: parsed.data.confirmado,
    }, { onConflict: 'tenant_id,paciente_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, resultado });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo guardar la fase.' }, { status: 500 });
  }
}
