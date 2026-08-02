import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolverTenantId } from '@/lib/tenant';
import { esUuidValido } from '@/lib/validation/id';
import { DecisionesPatronesSchema, type DecisionPatron } from '@/lib/validation/patrones';
import {
  calcularPatrones, type PatronFuncional, type HistoriaRelevante, type HallazgoBioescaner,
} from '@/lib/clinica/patrones';
import { calcularPuntajes, type Sexo } from '@/lib/clinica/cuestionario';

const AlteracionSchema = z.object({
  id: z.string().min(1), nombre: z.string().trim().min(1).max(180),
  nivel: z.enum(['primaria', 'secundaria', 'terciaria']),
  dominio: z.string().trim().min(1).max(100), justificacion: z.string().trim().max(1000),
});
const TextoSchema = z.object({ id: z.string().min(1), nombre: z.string().trim().min(1).max(180) });
const DatosSchema = z.object({
  alteraciones: z.array(AlteracionSchema).max(50), perpetuadores: z.array(TextoSchema).max(50),
  deficits: z.array(TextoSchema).max(50), impresion: z.string().trim().max(6000),
  estudios: z.string().trim().max(4000), confirmado: z.boolean(),
  decisionesPatrones: DecisionesPatronesSchema.optional(),
});

type PacienteContexto = {
  sexo: Sexo | null;
  antecedentesPersonales: string | null;
  antecedentesFamiliares: string | null;
  medicamentosActuales: string | null;
  alergias: string | null;
};

async function contexto(pacienteId: string) {
  if (!esUuidValido(pacienteId)) {
    return { error: NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 }) };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };

  const tenant = await resolverTenantId(supabase, user.id);
  if ('error' in tenant) return { error: tenant.error };

  const { data: paciente, error: errorPaciente } = await supabase
    .from('pacientes')
    .select('id, sexo, antecedentes_personales, antecedentes_familiares, medicamentos_actuales, alergias')
    .eq('id', pacienteId)
    .eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (errorPaciente) {
    return { error: NextResponse.json({ error: errorPaciente.message }, { status: 500 }) };
  }
  if (!paciente) return { error: NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 }) };

  const p = paciente as {
    sexo: Sexo | null; antecedentes_personales: string | null; antecedentes_familiares: string | null;
    medicamentos_actuales: string | null; alergias: string | null;
  };

  const pacienteContexto: PacienteContexto = {
    sexo: p.sexo ?? null,
    antecedentesPersonales: p.antecedentes_personales ?? null,
    antecedentesFamiliares: p.antecedentes_familiares ?? null,
    medicamentosActuales: p.medicamentos_actuales ?? null,
    alergias: p.alergias ?? null,
  };

  return { supabase, tenantId: tenant.tenantId, paciente: pacienteContexto };
}

function extraerHistoriaRelevante(historia: Record<string, unknown>): HistoriaRelevante {
  return {
    bristol: typeof historia.bristol === 'number' ? historia.bristol : undefined,
    estres: typeof historia.estres === 'number' ? historia.estres : undefined,
    suenoHoras: typeof historia.suenoHoras === 'number' ? historia.suenoHoras : undefined,
    fiebrePersistente: historia.fiebrePersistente === true,
    dolorToracico: historia.dolorToracico === true,
    disneaReposo: historia.disneaReposo === true,
    deficitNeurologico: historia.deficitNeurologico === true,
  };
}

/**
 * Calcula los patrones funcionales frescos a partir de la evidencia
 * disponible del paciente (cuestionario, historia, bioescáner).
 */
async function calcularPatronesFrescos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pacienteId: string,
  sexo: Sexo | null
): Promise<PatronFuncional[]> {
  const [historiaRes, bioescanerRes] = await Promise.all([
    supabase.from('historias_clinicas').select('historia, respuestas').eq('paciente_id', pacienteId).maybeSingle(),
    supabase.from('bioescaneres').select('hallazgos').eq('paciente_id', pacienteId).maybeSingle(),
  ]);

  const historiaData = historiaRes.data as { historia?: Record<string, unknown>; respuestas?: Record<string, number> } | null;
  const bioescanerData = bioescanerRes.data as { hallazgos?: HallazgoBioescaner[] } | null;

  const puntajesCuestionario = calcularPuntajes(historiaData?.respuestas ?? {}, sexo ? { sexo } : undefined);

  return calcularPatrones({
    puntajesCuestionario,
    historia: extraerHistoriaRelevante(historiaData?.historia ?? {}),
    hallazgos: bioescanerData?.hallazgos ?? [],
  });
}

/**
 * Combina los patrones recién calculados con las decisiones ya
 * guardadas por el médico (`previos`) y las decisiones nuevas de esta
 * solicitud (`decisiones`). Un patrón confirmado o descartado por el
 * médico nunca desaparece aunque la evidencia recalculada caiga por
 * debajo del umbral — se conserva con su último cálculo conocido.
 * Puntaje/nivel/evidencias/fechaCalculo/version siempre salen del
 * motor, nunca del cliente.
 */
function mergirPatrones(
  frescos: PatronFuncional[],
  previos: PatronFuncional[],
  decisiones: DecisionPatron[]
): PatronFuncional[] {
  const frescosPorCodigo = new Map(frescos.map(p => [p.codigo, p]));
  const previosPorCodigo = new Map(previos.map(p => [p.codigo, p]));
  const decisionesPorCodigo = new Map(decisiones.map(d => [d.codigo, d]));

  const codigos = new Set<string>([
    ...frescos.map(p => p.codigo),
    ...previos.filter(p => p.estado !== 'sugerido').map(p => p.codigo),
  ]);

  const resultado: PatronFuncional[] = [];
  for (const codigo of codigos) {
    const base = frescosPorCodigo.get(codigo) ?? previosPorCodigo.get(codigo);
    if (!base) continue;
    const previo = previosPorCodigo.get(codigo);
    const decision = decisionesPorCodigo.get(codigo);
    resultado.push({
      ...base,
      estado: decision?.estado ?? previo?.estado ?? 'sugerido',
      prioridad: decision?.prioridad ?? previo?.prioridad ?? base.prioridad,
      observacionesMedico: decision?.observacionesMedico ?? previo?.observacionesMedico ?? '',
    });
  }
  return resultado.sort((a, b) => b.puntaje - a.puntaje);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;

  const { data: diagnostico, error: errorDiagnostico } = await ctx.supabase
    .from('diagnosticos_funcionales')
    .select('*')
    .eq('paciente_id', id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();

  if (errorDiagnostico) return NextResponse.json({ error: errorDiagnostico.message }, { status: 500 });

  const d = diagnostico as {
    alteraciones?: unknown[]; perpetuadores?: unknown[]; deficits?: unknown[];
    impresion?: string; estudios?: string; confirmado?: boolean;
    patrones?: PatronFuncional[]; updated_at?: string;
  } | null;

  const frescos = await calcularPatronesFrescos(ctx.supabase, id, ctx.paciente.sexo);
  const patrones = mergirPatrones(frescos, d?.patrones ?? [], []);

  return NextResponse.json({
    alteraciones: d?.alteraciones ?? [], perpetuadores: d?.perpetuadores ?? [], deficits: d?.deficits ?? [],
    impresion: d?.impresion ?? '', estudios: d?.estudios ?? '', confirmado: d?.confirmado ?? false,
    patrones,
    contextoPaciente: {
      antecedentesPersonales: ctx.paciente.antecedentesPersonales,
      antecedentesFamiliares: ctx.paciente.antecedentesFamiliares,
      medicamentosActuales: ctx.paciente.medicamentosActuales,
      alergias: ctx.paciente.alergias,
    },
    updatedAt: d?.updated_at ?? null,
    advertencia: 'Resultado de cribado funcional. No sustituye diagnóstico médico.',
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 422 });
  }

  const parsed = DatosSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos diagnósticos inválidos.', detalles: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { decisionesPatrones, ...datosManual } = parsed.data;

  const [{ data: previo, error: errorPrevio }, frescos] = await Promise.all([
    ctx.supabase.from('diagnosticos_funcionales').select('patrones').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    calcularPatronesFrescos(ctx.supabase, id, ctx.paciente.sexo),
  ]);
  if (errorPrevio) return NextResponse.json({ error: errorPrevio.message }, { status: 500 });

  const patronesPrevios = ((previo as { patrones?: PatronFuncional[] } | null)?.patrones ?? []);
  const patrones = mergirPatrones(frescos, patronesPrevios, decisionesPatrones ?? []);

  const { error } = await (ctx.supabase.from('diagnosticos_funcionales') as any).upsert({
    tenant_id: ctx.tenantId, paciente_id: id, ...datosManual, patrones,
  }, { onConflict: 'tenant_id,paciente_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    patrones,
    advertencia: 'Resultado de cribado funcional. No sustituye diagnóstico médico.',
  });
}
