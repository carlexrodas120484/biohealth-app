import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolverTenantId } from '@/lib/tenant';
import { esUuidValido } from '@/lib/validation/id';
import { IngredientesSchema, EstadoFormulacionSchema, type IngredienteInput } from '@/lib/validation/formulacion';
import {
  construirPreparaciones, generarAlertas, calcularCantidadParaDuracion, sugerirPrincipiosActivos,
  CAPACIDAD_CAPSULA_MG_DEFECTO, VERSION_MOTOR_FORMULACION,
  type InfoCatalogo, type PacienteContextoFormulacion, type PreparacionCalculada, type Alerta,
} from '@/lib/clinica/formulacion';
import { principiosValidadosAInfoCatalogo, type PrincipioValidadoParaMotor } from '@/lib/clinica/baseConocimiento';

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

/**
 * Combina dos fuentes: el catálogo plano preexistente
 * (`catalogo_formulacion`, migración 0012) y la Base de Conocimiento
 * Clínica nueva (`principios_activos` + tablas relacionadas) —
 * de esta última SÓLO entran los principios en estado 'validado';
 * cualquier otro estado (borrador/en_revision/archivado) es invisible
 * acá aunque tenga datos cargados. Donde un mismo nombre exista en las
 * dos fuentes, gana la Base de Conocimiento por ser la más auditada.
 * Nada de esto rompe formulaciones ya guardadas: sólo cambia de dónde
 * sale la información de apoyo (cápsula, sabor, incompatibilidades)
 * para un nombre dado.
 */
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

  const validados = await catalogoDesdeBaseConocimiento(supabase, tenantId);
  for (const [clave, info] of validados) mapa.set(clave, info);

  return mapa;
}

async function catalogoDesdeBaseConocimiento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string
): Promise<Map<string, InfoCatalogo>> {
  const { data: principios } = await supabase
    .from('principios_activos')
    .select('id, nombre_canonico, estado')
    .eq('estado', 'validado')
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);

  const filas = (principios ?? []) as Array<{ id: string; nombre_canonico: string; estado: string }>;
  if (filas.length === 0) return new Map();
  const ids = filas.map(f => f.id);

  const [sinonimos, presentaciones, propiedades, dosisMaxima, incompatibilidades] = await Promise.all([
    supabase.from('sinonimos_principios').select('principio_id, sinonimo').in('principio_id', ids),
    supabase.from('presentaciones_farmaceuticas').select('principio_id, forma, capacidad_capsula_mg, preferida').in('principio_id', ids),
    supabase.from('propiedades_organolepticas').select('principio_id, intensidad_sabor, solubilidad').in('principio_id', ids),
    supabase.from('dosis_principios').select('principio_id, valor').in('principio_id', ids).eq('tipo', 'maxima'),
    supabase.from('incompatibilidades_formulacion').select('principio_id, principio_incompatible:principios_activos!incompatibilidades_formulacion_principio_incompatible_id_fkey(nombre_canonico)').in('principio_id', ids),
  ]);

  const agrupar = <T extends { principio_id: string }>(filas: T[] | null | undefined) => {
    const mapa = new Map<string, T[]>();
    for (const f of filas ?? []) { if (!mapa.has(f.principio_id)) mapa.set(f.principio_id, []); mapa.get(f.principio_id)!.push(f); }
    return mapa;
  };

  const sinonimosPorId = agrupar(sinonimos.data as Array<{ principio_id: string; sinonimo: string }> | null);
  const presentacionesPorId = agrupar(presentaciones.data as Array<{ principio_id: string; forma: string; capacidad_capsula_mg: number | null; preferida: boolean }> | null);
  const propiedadesPorId = agrupar(propiedades.data as Array<{ principio_id: string; intensidad_sabor: number | null; solubilidad: string | null }> | null);
  const dosisPorId = agrupar(dosisMaxima.data as Array<{ principio_id: string; valor: number }> | null);
  const incompatibilidadesPorId = agrupar(incompatibilidades.data as unknown as Array<{ principio_id: string; principio_incompatible: { nombre_canonico: string } | null }> | null);

  const entradas: PrincipioValidadoParaMotor[] = filas.map(p => {
    const presentacionPreferida = (presentacionesPorId.get(p.id) ?? []).find(pf => pf.preferida) ?? (presentacionesPorId.get(p.id) ?? [])[0];
    const props = (propiedadesPorId.get(p.id) ?? [])[0];
    const maxima = (dosisPorId.get(p.id) ?? [])[0];
    return {
      nombreCanonico: p.nombre_canonico,
      estado: p.estado as PrincipioValidadoParaMotor['estado'],
      sinonimos: (sinonimosPorId.get(p.id) ?? []).map(s => s.sinonimo),
      capacidadCapsulaMg: presentacionPreferida?.capacidad_capsula_mg ?? null,
      intensidadSabor: props?.intensidad_sabor ?? null,
      solubilidad: props?.solubilidad ?? null,
      formaFarmaceuticaPreferida: presentacionPreferida?.forma ?? null,
      incompatibilidadesNombres: (incompatibilidadesPorId.get(p.id) ?? []).map(i => i.principio_incompatible?.nombre_canonico).filter((n): n is string => Boolean(n)),
      dosisMaximaMg: maxima?.valor ?? null,
    };
  });

  return principiosValidadosAInfoCatalogo(entradas);
}

// Nota de alcance: las reglas de formulación (capacidad de cápsula por
// defecto, umbral de sobre, amargor que bloquea) ya son configurables
// a nivel de motor y de base de datos (tabla `reglas_formulacion`,
// ver migración 0024 y ReglasFormulacion en lib/clinica/formulacion.ts)
// y tienen su propia fila sembrada con los valores por defecto
// (1000 mg / 2 cápsulas / amargor 3) que ya usaba este motor. Falta
// sólo que esta ruta las lea dinámicamente por tenant en vez del
// default del módulo — se deja para una siguiente iteración, para no
// sumar otra consulta nueva a esta misma migración junto con la de
// principios validados de abajo.

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

    const sugerencias = sugerirPrincipiosActivos(objetivos.objetivos ?? []);
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
