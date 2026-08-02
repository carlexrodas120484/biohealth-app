import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolverTenantId } from '@/lib/tenant';
import { esUuidValido } from '@/lib/validation/id';
import { PlanNutricionalSchema } from '@/lib/validation/nutricion';
import {
  calcularValoresNutricionales, generarAdvertenciasPlan, OBJETIVOS_CLINICOS, ALIMENTOS_LOCALES,
  ADVERTENCIA_NUTRICION, VERSION_MOTOR_NUTRICION,
  type ObjetivoClinico, type NivelActividad, type Sexo, type RestriccionesDeclaradas,
  type PacienteContextoNutricion, type CalculosNutricionales,
} from '@/lib/clinica/nutricion';

type PacienteContexto = {
  sexo: Sexo | null; fecha_nacimiento: string | null;
  alergias: string | null; medicamentos_actuales: string | null;
  antecedentes_personales: string | null; antecedentes_familiares: string | null;
};

function calcularEdad(fechaNacimiento: string | null): number | null {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

async function contexto(id: string) {
  if (!esUuidValido(id)) return { error: NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 }) };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };

  const tenant = await resolverTenantId(supabase, user.id);
  if ('error' in tenant) return { error: tenant.error };

  const { data: paciente, error: errorPaciente } = await supabase
    .from('pacientes')
    .select('id, sexo, fecha_nacimiento, alergias, medicamentos_actuales, antecedentes_personales, antecedentes_familiares')
    .eq('id', id)
    .eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (errorPaciente) return { error: NextResponse.json({ error: errorPaciente.message }, { status: 500 }) };
  if (!paciente) return { error: NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 }) };

  return { supabase, tenantId: tenant.tenantId, user, paciente: paciente as PacienteContexto };
}

async function fuentes(ctx: Exclude<Awaited<ReturnType<typeof contexto>>, { error: NextResponse }>, id: string) {
  const [fase, plan, formula, historia] = await Promise.all([
    ctx.supabase.from('fases_terapeuticas').select('fase_seleccionada,confirmado').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('planes_nutricionales_clinicos').select('*').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('formulaciones_terapeuticas').select('firmada,estado,ingredientes').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('historias_clinicas').select('historia').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
  ]);
  if (fase.error) throw new Error(fase.error.message);
  if (plan.error) throw new Error(plan.error.message);
  if (formula.error) throw new Error(formula.error.message);
  if (historia.error) throw new Error(historia.error.message);
  return { fase: fase.data, plan: plan.data, formula: formula.data, historia: historia.data };
}

function ingredientesFormulacionAprobada(formula: unknown): string[] {
  const f = formula as { firmada?: boolean; estado?: string; ingredientes?: Array<{ nombre: string }> } | null;
  if (!f || !(f.firmada || f.estado === 'aprobada')) return [];
  return (f.ingredientes ?? []).map(i => i.nombre);
}

function pesoTallaDeHistoria(historia: unknown): { pesoKg: number | null; tallaCm: number | null } {
  const h = (historia as { historia?: Record<string, unknown> } | null)?.historia ?? {};
  return {
    pesoKg: typeof h.peso === 'number' ? h.peso : null,
    tallaCm: typeof h.talla === 'number' ? h.talla : null,
  };
}

const RESTRICCIONES_VACIAS: RestriccionesDeclaradas = { alergiasAlimentarias: [], celiaquia: false, vegetarianismo: false, veganismo: false };
const PLAN_VACIO = {
  numeroComidas: 4, menuDiario: [], menuSemanal: {}, alimentosRecomendados: [], alimentosALimitar: [],
  alimentosAEvitar: [], listaCompras: [], observaciones: '', duracionDias: 30,
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;

  try {
    const { fase, plan, formula, historia } = await fuentes(ctx, id);
    const f = fase as { fase_seleccionada?: string; confirmado?: boolean } | null;
    if (!f?.confirmado || !f.fase_seleccionada) {
      return NextResponse.json({ error: 'Confirme primero la fase terapéutica.' }, { status: 409 });
    }

    const guardado = plan as {
      fase?: string; objetivo_clinico?: ObjetivoClinico; calculos?: CalculosNutricionales; plan?: typeof PLAN_VACIO;
      restricciones?: RestriccionesDeclaradas; advertencias?: unknown; estado?: string;
      aprobado_por?: string | null; aprobado_en?: string | null; version_motor?: number; updated_at?: string;
    } | null;
    const vigente = guardado?.fase === f.fase_seleccionada;

    const { pesoKg: pesoHistoria, tallaCm: tallaHistoria } = pesoTallaDeHistoria(historia);
    const edadAnios = calcularEdad(ctx.paciente.fecha_nacimiento) ?? 30;
    const sexo: Sexo = ctx.paciente.sexo ?? 'femenino';

    const objetivoClinico: ObjetivoClinico = vigente && guardado?.objetivo_clinico ? guardado.objetivo_clinico : 'mantenimiento';
    const nivelActividad: NivelActividad = 'moderado';
    const pesoKg = pesoHistoria ?? 70;
    const tallaCm = tallaHistoria ?? 165;

    const calculos = vigente && guardado?.calculos && Object.keys(guardado.calculos).length > 0
      ? guardado.calculos
      : calcularValoresNutricionales({ pesoKg, tallaCm, edadAnios, sexo, nivelActividad, objetivo: objetivoClinico });

    const restricciones = vigente ? guardado?.restricciones ?? RESTRICCIONES_VACIAS : RESTRICCIONES_VACIAS;
    const planAlimentario = vigente ? guardado?.plan ?? PLAN_VACIO : PLAN_VACIO;

    const pacienteContexto: PacienteContextoNutricion = {
      alergias: ctx.paciente.alergias, medicamentosActuales: ctx.paciente.medicamentos_actuales,
      antecedentesPersonales: ctx.paciente.antecedentes_personales, antecedentesFamiliares: ctx.paciente.antecedentes_familiares,
    };
    const ingredientesFormula = ingredientesFormulacionAprobada(formula);
    const advertencias = generarAdvertenciasPlan({
      objetivo: objetivoClinico, paciente: pacienteContexto, restricciones,
      alimentosRecomendados: planAlimentario.alimentosRecomendados ?? [], ingredientesFormulacionAprobada: ingredientesFormula,
    });

    return NextResponse.json({
      fase: f.fase_seleccionada,
      tieneFormula: Boolean((formula as { firmada?: boolean } | null)?.firmada),
      objetivoClinico, pesoKg, tallaCm, edadAnios, sexo, nivelActividad,
      calculos, restricciones, plan: planAlimentario, advertencias,
      estado: vigente ? guardado?.estado ?? 'borrador' : 'borrador',
      aprobadoPor: vigente ? guardado?.aprobado_por ?? null : null,
      aprobadoEn: vigente ? guardado?.aprobado_en ?? null : null,
      version: vigente ? guardado?.version_motor ?? null : null,
      updatedAt: vigente ? guardado?.updated_at ?? null : null,
      objetivosClinicosDisponibles: OBJETIVOS_CLINICOS,
      catalogoAlimentos: ALIMENTOS_LOCALES,
      contextoFormulacion: { ingredientesAprobados: ingredientesFormula },
      advertencia: ADVERTENCIA_NUTRICION,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo cargar el plan nutricional.' }, { status: 500 });
  }
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

  const parsed = PlanNutricionalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Complete correctamente el plan nutricional.', detalles: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  try {
    const { fase, formula } = await fuentes(ctx, id);
    const f = fase as { fase_seleccionada?: string; confirmado?: boolean } | null;
    if (!f?.confirmado || !f.fase_seleccionada) {
      return NextResponse.json({ error: 'Confirme primero la fase terapéutica.' }, { status: 409 });
    }

    const datos = parsed.data;
    const edadAnios = calcularEdad(ctx.paciente.fecha_nacimiento) ?? 30;
    const sexo: Sexo = ctx.paciente.sexo ?? 'femenino';
    const calculadosFrescos = calcularValoresNutricionales({
      pesoKg: datos.pesoKg, tallaCm: datos.tallaCm, edadAnios, sexo,
      nivelActividad: datos.nivelActividad as NivelActividad, objetivo: datos.objetivoClinico as ObjetivoClinico,
    });
    // El profesional puede sobrescribir cualquier valor calculado.
    const calculos = { ...calculadosFrescos, ...(datos.calculosOverride ?? {}) };

    const pacienteContexto: PacienteContextoNutricion = {
      alergias: ctx.paciente.alergias, medicamentosActuales: ctx.paciente.medicamentos_actuales,
      antecedentesPersonales: ctx.paciente.antecedentes_personales, antecedentesFamiliares: ctx.paciente.antecedentes_familiares,
    };
    const ingredientesFormula = ingredientesFormulacionAprobada(formula);
    const advertencias = generarAdvertenciasPlan({
      objetivo: datos.objetivoClinico as ObjetivoClinico, paciente: pacienteContexto,
      restricciones: datos.restricciones, alimentosRecomendados: datos.plan.alimentosRecomendados,
      ingredientesFormulacionAprobada: ingredientesFormula,
    });

    // Nunca se aprueba automáticamente: si no se manda estado, queda en borrador.
    const estadoFinal = datos.estado ?? 'borrador';

    const { error } = await (ctx.supabase.from('planes_nutricionales_clinicos') as any).upsert({
      tenant_id: ctx.tenantId,
      paciente_id: id,
      fase: f.fase_seleccionada,
      // columnas legadas de 0013, se mantienen pobladas por compatibilidad
      priorizar: OBJETIVOS_CLINICOS.find(o => o.codigo === datos.objetivoClinico)?.priorizarDefecto ?? '',
      evitar: OBJETIVOS_CLINICOS.find(o => o.codigo === datos.objetivoClinico)?.evitarDefecto ?? '',
      comidas_dia: datos.plan.numeroComidas,
      confirmado: estadoFinal === 'aprobado',
      objetivo_clinico: datos.objetivoClinico,
      calculos,
      plan: datos.plan,
      restricciones: datos.restricciones,
      advertencias,
      estado: estadoFinal,
      aprobado_por: estadoFinal === 'aprobado' ? ctx.user.id : null,
      aprobado_en: estadoFinal === 'aprobado' ? new Date().toISOString() : null,
      version_motor: VERSION_MOTOR_NUTRICION,
    }, { onConflict: 'tenant_id,paciente_id' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, estado: estadoFinal, calculos, advertencias, advertencia: ADVERTENCIA_NUTRICION });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo guardar el plan nutricional.' }, { status: 500 });
  }
}
