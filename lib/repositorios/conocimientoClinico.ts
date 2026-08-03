/**
 * lib/repositorios/conocimientoClinico.ts
 *
 * Capa de repositorio para `conocimiento_clinico` (migración 0026):
 * funciones de acceso a datos puras, sin ruta ni pantalla propia
 * todavía — pensadas para que una futura ruta administrativa (mismo
 * patrón que app/api/admin/base-conocimiento/*) y, más adelante, el
 * Motor Inteligente de Formulación (lib/clinica/mif.ts) las consuman.
 *
 * Mismo patrón de ciclo de vida que lib/adminAuth.ts + las rutas de
 * principios_activos (ADR-0007/ADR-0011 en BIOHEALTH_DECISIONS.md):
 * estado borrador→en_revision→validado→archivado, edición de un
 * registro validado exige `forzarSobrescritura` y lo regresa a
 * en_revision, e historial append-only de cada cambio relevante.
 */

import type { createClient } from '@/lib/supabase/server';
import type { ConocimientoClinicoInput, EstadoConocimiento, Fase } from '@/lib/validation/conocimientoClinico';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type ConocimientoClinico = {
  id: string;
  tenantId: string | null;
  principioActivoId: string;
  objetivoTerapeutico: string;
  fase: Fase;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  evidencia: string | null;
  nivelEvidencia: 'A' | 'B' | 'C' | 'D' | null;
  dosisHabitual: number | null;
  dosisMinima: number | null;
  dosisMaxima: number | null;
  unidadDosis: string | null;
  horario: string | null;
  observaciones: string | null;
  contraindicaciones: string[];
  interacciones: string[];
  requiereSobre: boolean;
  requiereCapsula: boolean;
  ordenSugerido: number;
  estado: EstadoConocimiento;
  pendienteValidacion: boolean;
  createdAt: string;
  updatedAt: string;
};

type FilaConocimientoClinico = {
  id: string; tenant_id: string | null; principio_activo_id: string; objetivo_terapeutico: string; fase: string;
  prioridad: string; evidencia: string | null; nivel_evidencia: string | null;
  dosis_habitual: number | null; dosis_minima: number | null; dosis_maxima: number | null; unidad_dosis: string | null;
  horario: string | null; observaciones: string | null;
  contraindicaciones: string[] | null; interacciones: string[] | null;
  requiere_sobre: boolean; requiere_capsula: boolean; orden_sugerido: number;
  estado: string; pendiente_validacion: boolean; created_at: string; updated_at: string;
};

const COLUMNAS =
  'id, tenant_id, principio_activo_id, objetivo_terapeutico, fase, prioridad, evidencia, nivel_evidencia, ' +
  'dosis_habitual, dosis_minima, dosis_maxima, unidad_dosis, horario, observaciones, contraindicaciones, interacciones, ' +
  'requiere_sobre, requiere_capsula, orden_sugerido, estado, pendiente_validacion, created_at, updated_at';

function aConocimientoClinico(fila: FilaConocimientoClinico): ConocimientoClinico {
  return {
    id: fila.id, tenantId: fila.tenant_id, principioActivoId: fila.principio_activo_id,
    objetivoTerapeutico: fila.objetivo_terapeutico, fase: fila.fase as Fase,
    prioridad: fila.prioridad as ConocimientoClinico['prioridad'],
    evidencia: fila.evidencia, nivelEvidencia: fila.nivel_evidencia as ConocimientoClinico['nivelEvidencia'],
    dosisHabitual: fila.dosis_habitual, dosisMinima: fila.dosis_minima, dosisMaxima: fila.dosis_maxima,
    unidadDosis: fila.unidad_dosis, horario: fila.horario, observaciones: fila.observaciones,
    contraindicaciones: fila.contraindicaciones ?? [], interacciones: fila.interacciones ?? [],
    requiereSobre: fila.requiere_sobre, requiereCapsula: fila.requiere_capsula, ordenSugerido: fila.orden_sugerido,
    estado: fila.estado as EstadoConocimiento, pendienteValidacion: fila.pendiente_validacion,
    createdAt: fila.created_at, updatedAt: fila.updated_at,
  };
}

// ==================== Lectura ====================

/**
 * Consulta principal que usará el MIF: indicaciones YA VALIDADAS para
 * un objetivo terapéutico + fase, ordenadas por prioridad de
 * sugerencia. Ningún registro en borrador/en_revision/archivado llega
 * acá, sin importar qué tan completos estén sus datos — mismo
 * principio de seguridad que rige principios_activos.
 */
export async function listarConocimientoValidadoPorObjetivoYFase(
  supabase: SupabaseServerClient,
  tenantId: string,
  objetivoTerapeutico: string,
  fase: Fase
): Promise<ConocimientoClinico[]> {
  const { data, error } = await supabase
    .from('conocimiento_clinico')
    .select(COLUMNAS)
    .eq('estado', 'validado')
    .eq('objetivo_terapeutico', objetivoTerapeutico)
    .eq('fase', fase)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .order('orden_sugerido', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as FilaConocimientoClinico[]).map(aConocimientoClinico);
}

/** Todas las indicaciones (cualquier estado) de un principio activo — para paneles administrativos futuros. */
export async function listarConocimientoPorPrincipio(
  supabase: SupabaseServerClient,
  tenantId: string,
  principioActivoId: string
): Promise<ConocimientoClinico[]> {
  const { data, error } = await supabase
    .from('conocimiento_clinico')
    .select(COLUMNAS)
    .eq('principio_activo_id', principioActivoId)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .order('objetivo_terapeutico', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as FilaConocimientoClinico[]).map(aConocimientoClinico);
}

export async function obtenerConocimientoClinico(
  supabase: SupabaseServerClient,
  tenantId: string,
  id: string
): Promise<ConocimientoClinico | null> {
  const { data, error } = await supabase
    .from('conocimiento_clinico')
    .select(COLUMNAS)
    .eq('id', id)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? aConocimientoClinico(data as FilaConocimientoClinico) : null;
}

export async function obtenerHistorialConocimientoClinico(
  supabase: SupabaseServerClient,
  id: string
): Promise<Array<{ id: string; accion: string; campoModificado: string | null; valorAnterior: string | null; valorNuevo: string | null; realizadoPor: string | null; createdAt: string }>> {
  const { data, error } = await supabase
    .from('historial_conocimiento_clinico')
    .select('id, accion, campo_modificado, valor_anterior, valor_nuevo, realizado_por, created_at')
    .eq('conocimiento_id', id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string; accion: string; campo_modificado: string | null; valor_anterior: string | null; valor_nuevo: string | null; realizado_por: string | null; created_at: string }>)
    .map(f => ({ id: f.id, accion: f.accion, campoModificado: f.campo_modificado, valorAnterior: f.valor_anterior, valorNuevo: f.valor_nuevo, realizadoPor: f.realizado_por, createdAt: f.created_at }));
}

// ==================== Escritura ====================

export async function crearConocimientoClinico(
  supabase: SupabaseServerClient,
  userId: string,
  datos: ConocimientoClinicoInput
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await (supabase.from('conocimiento_clinico') as any).insert({
    tenant_id: null,
    principio_activo_id: datos.principioActivoId,
    objetivo_terapeutico: datos.objetivoTerapeutico,
    fase: datos.fase,
    prioridad: datos.prioridad,
    evidencia: datos.evidencia ?? null,
    nivel_evidencia: datos.nivelEvidencia ?? null,
    dosis_habitual: datos.dosisHabitual ?? null,
    dosis_minima: datos.dosisMinima ?? null,
    dosis_maxima: datos.dosisMaxima ?? null,
    unidad_dosis: datos.unidadDosis ?? null,
    horario: datos.horario ?? null,
    observaciones: datos.observaciones ?? null,
    contraindicaciones: datos.contraindicaciones,
    interacciones: datos.interacciones,
    requiere_sobre: datos.requiereSobre,
    requiere_capsula: datos.requiereCapsula,
    orden_sugerido: datos.ordenSugerido,
    estado: 'borrador',
    pendiente_validacion: true,
    creado_por: userId,
  }).select('id').single();

  if (error) return { error: error.message };
  const id = (data as { id: string }).id;

  await (supabase.from('historial_conocimiento_clinico') as any).insert({
    conocimiento_id: id, accion: 'creado', valor_nuevo: 'borrador', realizado_por: userId,
  });

  return { id };
}

const CAMPOS_ESCALARES_EDITABLES = [
  'objetivoTerapeutico', 'fase', 'prioridad', 'evidencia', 'nivelEvidencia',
  'dosisHabitual', 'dosisMinima', 'dosisMaxima', 'unidadDosis', 'horario', 'observaciones',
  'contraindicaciones', 'interacciones', 'requiereSobre', 'requiereCapsula', 'ordenSugerido',
] as const;

const CAMPO_TS_A_COLUMNA: Record<typeof CAMPOS_ESCALARES_EDITABLES[number], string> = {
  objetivoTerapeutico: 'objetivo_terapeutico', fase: 'fase', prioridad: 'prioridad',
  evidencia: 'evidencia', nivelEvidencia: 'nivel_evidencia',
  dosisHabitual: 'dosis_habitual', dosisMinima: 'dosis_minima', dosisMaxima: 'dosis_maxima', unidadDosis: 'unidad_dosis',
  horario: 'horario', observaciones: 'observaciones',
  contraindicaciones: 'contraindicaciones', interacciones: 'interacciones',
  requiereSobre: 'requiere_sobre', requiereCapsula: 'requiere_capsula', ordenSugerido: 'orden_sugerido',
};

/**
 * Edita los campos escalares de una indicación ya creada. Si está
 * `validado`, exige `forzarSobrescritura: true` y la regresa a
 * `en_revision` — misma regla que principios_activos (ADR-0011).
 */
export async function actualizarCamposConocimientoClinico(
  supabase: SupabaseServerClient,
  tenantId: string,
  userId: string,
  id: string,
  campos: Partial<Pick<ConocimientoClinicoInput, typeof CAMPOS_ESCALARES_EDITABLES[number]>>,
  forzarSobrescritura = false
): Promise<{ ok: true } | { error: string }> {
  const actual = await obtenerConocimientoClinico(supabase, tenantId, id);
  if (!actual) return { error: 'Indicación clínica no encontrada.' };
  if (actual.estado === 'validado' && !forzarSobrescritura) {
    return { error: 'Esta indicación ya está validada. Confirme explícitamente para sobrescribirla (vuelve a quedar en revisión).' };
  }

  const actualizacion: Record<string, unknown> = { actualizado_por: userId };
  for (const campo of CAMPOS_ESCALARES_EDITABLES) {
    if (campos[campo] !== undefined) actualizacion[CAMPO_TS_A_COLUMNA[campo]] = campos[campo];
  }

  if (actual.estado === 'validado' && forzarSobrescritura) {
    actualizacion.estado = 'en_revision';
    actualizacion.pendiente_validacion = true;
    actualizacion.validado_por = null;
    actualizacion.validado_en = null;
  }

  const { error } = await (supabase.from('conocimiento_clinico') as any).update(actualizacion).eq('id', id);
  if (error) return { error: error.message };

  await (supabase.from('historial_conocimiento_clinico') as any).insert({
    conocimiento_id: id, accion: 'editado', realizado_por: userId,
  });

  return { ok: true };
}

const TRANSICIONES_VALIDAS: Record<EstadoConocimiento, EstadoConocimiento[]> = {
  borrador: ['en_revision', 'archivado'],
  en_revision: ['validado', 'borrador', 'archivado'],
  validado: ['archivado'],
  archivado: ['borrador'],
};
const ACCION_POR_ESTADO: Record<EstadoConocimiento, string> = {
  borrador: 'restaurado', en_revision: 'revisado', validado: 'validado', archivado: 'archivado',
};

/**
 * Aplica una transición de estado válida (mismo diagrama que
 * principios_activos, ADR-0007): nunca permite saltar directo a
 * `validado` sin pasar por `en_revision`.
 */
export async function transicionarEstadoConocimientoClinico(
  supabase: SupabaseServerClient,
  tenantId: string,
  userId: string,
  id: string,
  nuevoEstado: EstadoConocimiento
): Promise<{ ok: true; estado: EstadoConocimiento } | { error: string }> {
  const actual = await obtenerConocimientoClinico(supabase, tenantId, id);
  if (!actual) return { error: 'Indicación clínica no encontrada.' };

  const permitidas = TRANSICIONES_VALIDAS[actual.estado] ?? [];
  if (!permitidas.includes(nuevoEstado)) {
    return { error: `No se puede pasar de "${actual.estado}" a "${nuevoEstado}".` };
  }

  const actualizacion: Record<string, unknown> = { estado: nuevoEstado, actualizado_por: userId };
  if (nuevoEstado === 'en_revision') {
    actualizacion.revisado_por = userId;
    actualizacion.fecha_revision = new Date().toISOString().slice(0, 10);
  }
  if (nuevoEstado === 'validado') {
    actualizacion.validado_por = userId;
    actualizacion.validado_en = new Date().toISOString();
    actualizacion.pendiente_validacion = false;
  }
  if (nuevoEstado === 'borrador') {
    actualizacion.pendiente_validacion = true;
    actualizacion.validado_por = null;
    actualizacion.validado_en = null;
  }

  const { error } = await (supabase.from('conocimiento_clinico') as any).update(actualizacion).eq('id', id);
  if (error) return { error: error.message };

  await (supabase.from('historial_conocimiento_clinico') as any).insert({
    conocimiento_id: id, accion: ACCION_POR_ESTADO[nuevoEstado], campo_modificado: 'estado',
    valor_anterior: actual.estado, valor_nuevo: nuevoEstado, realizado_por: userId,
  });

  return { ok: true, estado: nuevoEstado };
}
