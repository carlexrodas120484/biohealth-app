import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolverTenantId } from '@/lib/tenant';
import { esUuidValido } from '@/lib/validation/id';
import { IngredientesSchema, EstadoFormulacionSchema, type IngredienteInput } from '@/lib/validation/formulacion';
import {
  construirPreparaciones, generarAlertas, calcularCantidadParaDuracion,
  CAPACIDAD_CAPSULA_MG_DEFECTO, VERSION_MOTOR_FORMULACION,
  type InfoCatalogo, type PacienteContextoFormulacion, type PreparacionCalculada, type Alerta,
} from '@/lib/clinica/formulacion';

// ---- Esquemas del flujo existente (items de texto libre, firma con
// contraseña, revisión clínica): sin cambios de forma — los sigue
// leyendo tal cual la generación de PDF (lib/pdf/documentos-clinicos.ts). ----
const ItemSchema = z.object({
  id: z.string().min(1).max(100),
  nombre: z.string().trim().min(2).max(150),
  dosis: z.string().trim().min(1).max(200),
  presentacion: z.string().trim().max(200).default(''),
  cantidad: z.string().trim().max(120).default(''),
  indicacion: z.string().trim().min(1).max(300),
  observaciones: z.string().trim().max(500),
  evidencia: z.string().max(10).optional(),
  fuente: z.string().max(200).optional(),
});
const RevisionClinicaSchema = z.object({
  pesoKg: z.string().max(20), embarazoLactancia: z.enum(['no-aplica', 'no', 'embarazo', 'lactancia', 'desconocido']),
  funcionRenal: z.string().max(300), funcionHepatica: z.string().max(300), laboratorios: z.string().max(1000), diagnosticoConfirmado: z.boolean(),
});
const DatosSchema = z.object({
  items: z.array(ItemSchema).min(1).max(20),
  revisionClinica: RevisionClinicaSchema,
  seguridadRevisada: z.boolean(),
  firmar: z.boolean(),
  password: z.string().max(200),
  // Motor de reglas — modelo nuevo y aditivo (ver lib/clinica/formulacion.ts).
  ingredientes: IngredientesSchema.optional(),
  estado: EstadoFormulacionSchema.optional(),
  duracionDias: z.number().int().positive().max(365).optional(),
});

const DURACION_DEFECTO_DIAS = 30;

type Sugerencia = { id: string; nombre: string; objetivo: string; precaucion: string; evidencia: 'B' | 'C' | 'D'; fuente: string };
const SUGERENCIAS: Record<string, Sugerencia[]> = {
  'Reparar mucosa intestinal': [
    { id: 'l-glutamina', nombre: 'L-glutamina', objetivo: 'Reparar mucosa intestinal', precaucion: 'Individualizar en enfermedad hepática, renal o contexto oncológico.', evidencia: 'C', fuente: 'Material docente aportado' },
    { id: 'zinc-carnosina', nombre: 'Zinc-L-carnosina', objetivo: 'Reparar mucosa intestinal', precaucion: 'Considerar aporte total de zinc y uso prolongado.', evidencia: 'C', fuente: 'Material docente aportado' },
  ],
  'Disminuir inflamación': [
    { id: 'omega-3', nombre: 'Omega-3 (EPA + DHA)', objetivo: 'Disminuir inflamación', precaucion: 'Revisar anticoagulantes, antiagregantes y riesgo hemorrágico.', evidencia: 'B', fuente: 'Manual profesional; validar indicación' },
    { id: 'curcumina', nombre: 'Curcumina', objetivo: 'Disminuir inflamación', precaucion: 'Revisar anticoagulación, patología biliar e interacciones.', evidencia: 'C', fuente: 'Material docente aportado' },
  ],
  'Mejorar microbiota': [
    { id: 'probiotico', nombre: 'Probiótico con cepa identificada', objetivo: 'Mejorar microbiota', precaucion: 'Seleccionar cepa según indicación; cautela en inmunosupresión grave.', evidencia: 'C', fuente: 'Material docente aportado' },
    { id: 's-boulardii', nombre: 'Saccharomyces boulardii', objetivo: 'Mejorar microbiota', precaucion: 'Evitar en pacientes críticos, inmunosupresión grave o con catéter venoso central.', evidencia: 'C', fuente: 'Material docente aportado' },
  ],
  'Optimizar digestión enzimática': [
    { id: 'enzimas-digestivas', nombre: 'Complejo de enzimas digestivas', objetivo: 'Optimizar digestión enzimática', precaucion: 'Definir composición según clínica; no sustituye evaluación pancreática o biliar.', evidencia: 'D', fuente: 'Resumen de fórmula aportado' },
  ],
  'Restaurar pH gástrico': [
    { id: 'betaina-hcl', nombre: 'Betaína HCl', objetivo: 'Restaurar pH gástrico', precaucion: 'No usar sin evaluar gastritis, úlcera, reflujo y medicación gastroprotectora.', evidencia: 'D', fuente: 'Formulario aportado' },
  ],
};

const ADVERTENCIA_FORMULACION =
  'Asistente de formulación: organiza y calcula presentación a partir de datos ya definidos. No prescribe ni aprueba automáticamente — requiere revisión y aprobación médica.';

type PacienteContexto = {
  medicamentos_actuales?: string | null; alergias?: string | null;
  antecedentes_personales?: string | null; antecedentes_familiares?: string | null;
};

async function contexto(id: string) {
  if (!esUuidValido(id)) return { error: NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 }) };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };

  const tenant = await resolverTenantId(supabase, user.id);
  if ('error' in tenant) return { error: tenant.error };

  const { data: paciente, error: errorPaciente } = await supabase
    .from('pacientes')
    .select('id, medicamentos_actuales, alergias, antecedentes_personales, antecedentes_familiares')
    .eq('id', id)
    .eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (errorPaciente) return { error: NextResponse.json({ error: errorPaciente.message }, { status: 500 }) };
  if (!paciente) return { error: NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 }) };

  return { supabase, tenantId: tenant.tenantId, user, paciente: paciente as PacienteContexto };
}

async function objetivosConfirmados(ctx: Exclude<Awaited<ReturnType<typeof contexto>>, { error: NextResponse }>, id: string) {
  const { data, error } = await ctx.supabase.from('objetivos_terapeuticos')
    .select('fase,objetivos,confirmado').eq('paciente_id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as { fase?: string; objetivos?: string[]; confirmado?: boolean } | null;
}

async function catalogoPorNombreNormalizado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string
): Promise<Map<string, InfoCatalogo>> {
  const { data } = await supabase
    .from('catalogo_formulacion')
    .select('nombre,sinonimos,capacidad_capsula_mg,amargor,soluble_en_agua,presentacion_preferida,incompatibilidades,dosis_referencia_max,limite_superior_referencia')
    .eq('activo', true)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);

  const mapa = new Map<string, InfoCatalogo>();
  for (const fila of (data ?? []) as Array<Record<string, unknown>>) {
    const info: InfoCatalogo = {
      nombre: String(fila.nombre),
      capacidadCapsulaMg: (fila.capacidad_capsula_mg as number | null) ?? CAPACIDAD_CAPSULA_MG_DEFECTO,
      amargor: (fila.amargor as number | null) ?? 0,
      solubleEnAgua: (fila.soluble_en_agua as boolean | null) ?? null,
      presentacionPreferida: (fila.presentacion_preferida as InfoCatalogo['presentacionPreferida']) ?? 'individualizar',
      incompatibilidades: (fila.incompatibilidades as string[] | null) ?? [],
      doseReferenciaMaxMg: (fila.dosis_referencia_max as number | null) ?? null,
      limiteSuperiorMg: (fila.limite_superior_referencia as number | null) ?? null,
    };
    mapa.set(String(fila.nombre).trim().toLowerCase(), info);
    for (const s of (fila.sinonimos as string[] | null) ?? []) mapa.set(s.trim().toLowerCase(), info);
  }
  return mapa;
}

/** Resuelve, para cada ingrediente que escribió el médico, su entrada de catálogo (si existe) por nombre o sinónimo. */
function mapearIngredientesAlCatalogo(ingredientes: IngredienteInput[], normalizado: Map<string, InfoCatalogo>): Map<string, InfoCatalogo> {
  const mapa = new Map<string, InfoCatalogo>();
  for (const ing of ingredientes) {
    const info = normalizado.get(ing.nombre.trim().toLowerCase());
    if (info) mapa.set(ing.nombre, info);
  }
  return mapa;
}

function calcularMotor(
  ingredientes: IngredienteInput[],
  catalogoPorNombre: Map<string, InfoCatalogo>,
  paciente: PacienteContextoFormulacion,
  duracionDias: number
): { preparaciones: (PreparacionCalculada & { ingredientes: Array<PreparacionCalculada['ingredientes'][number] & { cantidadTotalMg: number }> })[]; alertas: Alerta[] } {
  const preparaciones = construirPreparaciones(ingredientes, catalogoPorNombre).map(prep => ({
    ...prep,
    ingredientes: prep.ingredientes.map(ing => ({ ...ing, cantidadTotalMg: calcularCantidadParaDuracion(ing, duracionDias) })),
  }));
  const alertas = generarAlertas({ ingredientes, catalogoPorNombre, paciente });
  return { preparaciones, alertas };
}

async function fasesActivasDelPlan(supabase: Awaited<ReturnType<typeof createClient>>, id: string, tenantId: string): Promise<string[]> {
  const { data } = await supabase.from('planes_terapeuticos').select('fases').eq('paciente_id', id).eq('tenant_id', tenantId).maybeSingle();
  const fases = (data as { fases?: Array<{ nombre: string; estado: string }> } | null)?.fases ?? [];
  return fases.filter(f => f.estado === 'activa').map(f => f.nombre);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;

  try {
    const [objetivos, formula] = await Promise.all([
      objetivosConfirmados(ctx, id),
      ctx.supabase.from('formulaciones_terapeuticas').select('*').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ]);
    if (formula.error) throw new Error(formula.error.message);
    if (!objetivos?.confirmado || !objetivos.fase) {
      return NextResponse.json({ error: 'Confirme primero los objetivos terapéuticos.' }, { status: 409 });
    }

    const sugerencias = (objetivos.objetivos ?? []).flatMap(o => SUGERENCIAS[o] ?? []);
    const guardada = formula.data as {
      fase?: string; objetivos?: string[]; items?: unknown[]; revision_clinica?: unknown;
      seguridad_revisada?: boolean; firmada?: boolean; firmada_en?: string | null;
      estado?: string; ingredientes?: IngredienteInput[]; preparaciones?: unknown; alertas?: unknown;
    } | null;
    const vigente = guardada?.fase === objetivos.fase && JSON.stringify(guardada?.objetivos ?? []) === JSON.stringify(objetivos.objetivos ?? []);

    const ingredientesGuardados = vigente ? guardada?.ingredientes ?? [] : [];
    const catalogoNormalizado = await catalogoPorNombreNormalizado(ctx.supabase, ctx.tenantId);
    const catalogoPorNombre = mapearIngredientesAlCatalogo(ingredientesGuardados, catalogoNormalizado);
    const paciente: PacienteContextoFormulacion = {
      alergias: ctx.paciente.alergias ?? null,
      medicamentosActuales: ctx.paciente.medicamentos_actuales ?? null,
      antecedentesPersonales: ctx.paciente.antecedentes_personales ?? null,
      antecedentesFamiliares: ctx.paciente.antecedentes_familiares ?? null,
    };
    const { preparaciones, alertas } = calcularMotor(ingredientesGuardados, catalogoPorNombre, paciente, DURACION_DEFECTO_DIAS);

    const fasesActivas = await fasesActivasDelPlan(ctx.supabase, id, ctx.tenantId);

    let plantillaDuplicada: { items: unknown[]; ingredientes: IngredienteInput[]; revisionClinica: unknown } | null = null;
    const duplicarDe = req.nextUrl.searchParams.get('duplicarDe');
    if (duplicarDe && esUuidValido(duplicarDe)) {
      // Sólo puede duplicarse desde un paciente del mismo tenant: nunca se
      // filtra por tenant_id del paciente origen sin ese chequeo explícito.
      const { data: origen } = await ctx.supabase
        .from('formulaciones_terapeuticas')
        .select('items,ingredientes,revision_clinica')
        .eq('paciente_id', duplicarDe)
        .eq('tenant_id', ctx.tenantId)
        .maybeSingle();
      if (origen) {
        const o = origen as { items?: unknown[]; ingredientes?: IngredienteInput[]; revision_clinica?: unknown };
        plantillaDuplicada = { items: o.items ?? [], ingredientes: o.ingredientes ?? [], revisionClinica: o.revision_clinica ?? null };
      }
    }

    return NextResponse.json({
      fase: objetivos.fase,
      objetivos: objetivos.objetivos ?? [],
      sugerencias,
      medicamentosActuales: ctx.paciente.medicamentos_actuales ?? 'No registrados',
      alergias: ctx.paciente.alergias ?? 'No registradas',
      items: vigente ? guardada?.items ?? [] : [],
      revisionClinica: vigente ? guardada?.revision_clinica ?? null : null,
      seguridadRevisada: vigente ? Boolean(guardada?.seguridad_revisada) : false,
      firmada: vigente ? Boolean(guardada?.firmada) : false,
      firmadaEn: vigente ? guardada?.firmada_en ?? null : null,
      estado: vigente ? guardada?.estado ?? 'borrador' : 'borrador',
      ingredientes: ingredientesGuardados,
      preparaciones,
      alertas,
      contextoPlan: { fasesActivas },
      plantillaDuplicada,
      advertencia: ADVERTENCIA_FORMULACION,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo cargar la formulación.' }, { status: 500 });
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

  const parsed = DatosSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Complete nombre, dosis e indicación de cada activo.', detalles: parsed.error.flatten().fieldErrors }, { status: 422 });

  try {
    const objetivos = await objetivosConfirmados(ctx, id);
    if (!objetivos?.confirmado || !objetivos.fase) {
      return NextResponse.json({ error: 'Confirme primero los objetivos terapéuticos.' }, { status: 409 });
    }
    if (parsed.data.firmar && !parsed.data.seguridadRevisada) {
      return NextResponse.json({ error: 'Confirme la revisión de medicación, alergias, contraindicaciones e interacciones.' }, { status: 422 });
    }
    if (parsed.data.firmar && !parsed.data.revisionClinica.diagnosticoConfirmado) {
      return NextResponse.json({ error: 'Confirme la indicación clínica y el contexto usado para definir las dosis.' }, { status: 422 });
    }

    // Sólo el médico puede pasar una fórmula a 'aprobada' — y sólo
    // firmándola con contraseña, el mismo mecanismo que ya exigía la
    // firma. El sistema nunca la aprueba por su cuenta.
    const estadoSolicitado = parsed.data.estado;
    if (estadoSolicitado === 'aprobada' && !parsed.data.firmar) {
      return NextResponse.json({ error: 'Para aprobar la fórmula, primero debe firmarla.' }, { status: 422 });
    }

    if (parsed.data.firmar) {
      if (!ctx.user.email || !parsed.data.password) return NextResponse.json({ error: 'Ingrese su contraseña para firmar.' }, { status: 422 });
      const { error: authError } = await ctx.supabase.auth.signInWithPassword({ email: ctx.user.email, password: parsed.data.password });
      if (authError) return NextResponse.json({ error: 'Contraseña incorrecta.' }, { status: 401 });
    }

    const ingredientes = parsed.data.ingredientes ?? [];
    const catalogoNormalizado = await catalogoPorNombreNormalizado(ctx.supabase, ctx.tenantId);
    const catalogoPorNombre = mapearIngredientesAlCatalogo(ingredientes, catalogoNormalizado);
    const paciente: PacienteContextoFormulacion = {
      alergias: ctx.paciente.alergias ?? null,
      medicamentosActuales: ctx.paciente.medicamentos_actuales ?? null,
      antecedentesPersonales: ctx.paciente.antecedentes_personales ?? null,
      antecedentesFamiliares: ctx.paciente.antecedentes_familiares ?? null,
    };
    const duracionDias = parsed.data.duracionDias ?? DURACION_DEFECTO_DIAS;
    const { preparaciones, alertas } = calcularMotor(ingredientes, catalogoPorNombre, paciente, duracionDias);

    const estadoFinal = estadoSolicitado ?? (parsed.data.firmar ? 'aprobada' : 'borrador');

    const { error } = await (ctx.supabase.from('formulaciones_terapeuticas') as any).upsert({
      tenant_id: ctx.tenantId,
      paciente_id: id,
      fase: objetivos.fase,
      objetivos: objetivos.objetivos ?? [],
      items: parsed.data.items,
      ingredientes,
      preparaciones,
      alertas,
      estado: estadoFinal,
      revision_clinica: parsed.data.revisionClinica,
      seguridad_revisada: parsed.data.seguridadRevisada,
      firmada: parsed.data.firmar,
      firmada_por: parsed.data.firmar ? ctx.user.id : null,
      firmada_en: parsed.data.firmar ? new Date().toISOString() : null,
      version_reglas: `v${VERSION_MOTOR_FORMULACION}.0`,
    }, { onConflict: 'tenant_id,paciente_id' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      firmadaEn: parsed.data.firmar ? new Date().toISOString() : null,
      estado: estadoFinal,
      preparaciones,
      alertas,
      advertencia: ADVERTENCIA_FORMULACION,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo guardar la formulación.' }, { status: 500 });
  }
}
