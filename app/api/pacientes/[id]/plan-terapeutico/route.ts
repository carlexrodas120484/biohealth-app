import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolverTenantId } from '@/lib/tenant';
import { esUuidValido } from '@/lib/validation/id';
import { DecisionesFasesSchema, type DecisionFase } from '@/lib/validation/planTerapeutico';
import {
  sugerirFasesPlan, calcularBanderasSeguridad, plantillaDeFase, VERSION_ALGORITMO_PLAN, ADVERTENCIA_PLAN,
  type FaseTerapeutica, type PatronConfirmado, type HistoriaRelevantePlan, type PacienteContextoPlan,
} from '@/lib/clinica/planTerapeutico';

type PacienteContexto = PacienteContextoPlan;

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
    .select('id, antecedentes_personales, antecedentes_familiares, medicamentos_actuales, alergias')
    .eq('id', pacienteId)
    .eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (errorPaciente) {
    return { error: NextResponse.json({ error: errorPaciente.message }, { status: 500 }) };
  }
  if (!paciente) return { error: NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 }) };

  const p = paciente as {
    antecedentes_personales: string | null; antecedentes_familiares: string | null;
    medicamentos_actuales: string | null; alergias: string | null;
  };

  const pacienteContexto: PacienteContexto = {
    antecedentesPersonales: p.antecedentes_personales ?? null,
    antecedentesFamiliares: p.antecedentes_familiares ?? null,
    medicamentosActuales: p.medicamentos_actuales ?? null,
    alergias: p.alergias ?? null,
  };

  return { supabase, tenantId: tenant.tenantId, paciente: pacienteContexto };
}

function extraerHistoriaRelevante(historia: Record<string, unknown>): HistoriaRelevantePlan {
  return {
    fiebrePersistente: historia.fiebrePersistente === true,
    perdidaPesoInvoluntaria: historia.perdidaPesoInvoluntaria === true,
    sangrado: historia.sangrado === true,
    dolorToracico: historia.dolorToracico === true,
    disneaReposo: historia.disneaReposo === true,
    deficitNeurologico: historia.deficitNeurologico === true,
  };
}

/** Sólo los patrones que el médico ya confirmó en Diagnóstico funcional sustentan una fase. */
function extraerPatronesConfirmados(patrones: unknown): PatronConfirmado[] {
  if (!Array.isArray(patrones)) return [];
  return patrones
    .filter((p): p is { codigo: string; puntaje: number; nivel: string; estado: string } =>
      typeof p === 'object' && p !== null && (p as { estado?: string }).estado === 'confirmado'
    )
    .map(p => ({ codigo: p.codigo, puntaje: p.puntaje, nivel: p.nivel as PatronConfirmado['nivel'] }));
}

async function calcularFasesFrescasYBanderas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pacienteId: string,
  pacienteContexto: PacienteContexto
) {
  const [diagnosticoRes, historiaRes] = await Promise.all([
    supabase.from('diagnosticos_funcionales').select('patrones').eq('paciente_id', pacienteId).maybeSingle(),
    supabase.from('historias_clinicas').select('historia').eq('paciente_id', pacienteId).maybeSingle(),
  ]);

  const patronesConfirmados = extraerPatronesConfirmados(
    (diagnosticoRes.data as { patrones?: unknown } | null)?.patrones
  );
  const historia = extraerHistoriaRelevante(
    (historiaRes.data as { historia?: Record<string, unknown> } | null)?.historia ?? {}
  );

  return {
    fresh: sugerirFasesPlan({ patronesConfirmados, historia }),
    banderasSeguridad: calcularBanderasSeguridad(historia, pacienteContexto),
  };
}

/**
 * Combina las fases recién calculadas con las persistidas (`previos`) y
 * las decisiones nuevas (`decisiones`). Una fase que el médico ya tocó
 * (estado distinto de 'sugerida', prioridad, duración, objetivo u
 * observaciones propias) nunca desaparece aunque dejen de existir
 * patrones confirmados que la sustenten — se conserva con su último
 * cálculo conocido. El médico puede además "agregar" cualquiera de las
 * 6 fases del catálogo aunque el motor no la haya sugerido, mandando
 * una decisión con ese código.
 */
function mergirFases(
  fresh: FaseTerapeutica[],
  previos: FaseTerapeutica[],
  decisiones: DecisionFase[]
): FaseTerapeutica[] {
  const freshPorCodigo = new Map(fresh.map(f => [f.codigo, f]));
  const previosPorCodigo = new Map(previos.map(f => [f.codigo, f]));
  const decisionesPorCodigo = new Map(decisiones.map(d => [d.codigo, d]));

  const codigos = new Set<string>([
    ...fresh.map(f => f.codigo),
    ...previos.map(f => f.codigo),
    ...decisiones.map(d => d.codigo),
  ]);

  const resultado: FaseTerapeutica[] = [];
  for (const codigo of codigos) {
    const plantilla = plantillaDeFase(codigo);
    if (!plantilla) continue;

    const base: FaseTerapeutica =
      freshPorCodigo.get(codigo) ??
      previosPorCodigo.get(codigo) ?? {
        ...plantilla,
        prioridad: 'media',
        evidencias: [],
        observacionesMedico: '',
        estado: 'sugerida',
        orden: resultado.length + 1,
        fechaCalculo: new Date().toISOString(),
        version: VERSION_ALGORITMO_PLAN,
      };

    const previo = previosPorCodigo.get(codigo);
    const decision = decisionesPorCodigo.get(codigo);

    resultado.push({
      ...base,
      objetivo: decision?.objetivo ?? previo?.objetivo ?? base.objetivo,
      duracionEstimadaSemanas: decision?.duracionEstimadaSemanas ?? previo?.duracionEstimadaSemanas ?? base.duracionEstimadaSemanas,
      prioridad: decision?.prioridad ?? previo?.prioridad ?? base.prioridad,
      estado: decision?.estado ?? previo?.estado ?? 'sugerida',
      observacionesMedico: decision?.observacionesMedico ?? previo?.observacionesMedico ?? '',
      orden: decision?.orden ?? previo?.orden ?? base.orden,
    });
  }

  return resultado
    .sort((a, b) => a.orden - b.orden)
    .map((f, i) => ({ ...f, orden: i + 1 }));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;

  const [{ data: plan, error: errorPlan }, { fresh, banderasSeguridad }] = await Promise.all([
    ctx.supabase.from('planes_terapeuticos').select('*').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    calcularFasesFrescasYBanderas(ctx.supabase, id, ctx.paciente),
  ]);
  if (errorPlan) return NextResponse.json({ error: errorPlan.message }, { status: 500 });

  const previas = ((plan as { fases?: FaseTerapeutica[] } | null)?.fases ?? []);
  const fases = mergirFases(fresh, previas, []);

  return NextResponse.json({
    fases,
    banderasSeguridad,
    version: (plan as { version?: number } | null)?.version ?? null,
    updatedAt: (plan as { updated_at?: string } | null)?.updated_at ?? null,
    advertencia: ADVERTENCIA_PLAN,
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

  const cuerpo = (body ?? {}) as { decisionesFases?: unknown };
  const decisiones = DecisionesFasesSchema.safeParse(cuerpo.decisionesFases ?? []);
  if (!decisiones.success) {
    return NextResponse.json(
      { error: 'Datos del plan terapéutico inválidos.', detalles: decisiones.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const [{ data: previo, error: errorPrevio }, { fresh, banderasSeguridad }] = await Promise.all([
    ctx.supabase.from('planes_terapeuticos').select('fases').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    calcularFasesFrescasYBanderas(ctx.supabase, id, ctx.paciente),
  ]);
  if (errorPrevio) return NextResponse.json({ error: errorPrevio.message }, { status: 500 });

  const previas = ((previo as { fases?: FaseTerapeutica[] } | null)?.fases ?? []);
  const fases = mergirFases(fresh, previas, decisiones.data);

  const { error } = await (ctx.supabase.from('planes_terapeuticos') as any).upsert(
    { tenant_id: ctx.tenantId, paciente_id: id, fases, version: VERSION_ALGORITMO_PLAN },
    { onConflict: 'tenant_id,paciente_id' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, fases, banderasSeguridad, advertencia: ADVERTENCIA_PLAN });
}
