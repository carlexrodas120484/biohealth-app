/**
 * lib/repositorios/protocolo.ts
 *
 * Capa de repositorio del Motor de Protocolos Inteligentes (MPI):
 * lee, de sólo lectura, las piezas del flujo clínico existente que el
 * MPI necesita y que los repositorios ya existentes
 * (lib/repositorios/baseFarmacotecnica.ts, .../conocimientoClinico.ts)
 * todavía no exponen (contexto de contraindicaciones del paciente,
 * resultado completo del IPT, patrones confirmados del diagnóstico,
 * duración habitual de una dosis).
 *
 * Deliberadamente NO modifica baseFarmacotecnica.ts ni
 * conocimientoClinico.ts — el MPI los reutiliza tal cual (import),
 * para no arriesgar ninguna regresión en el MIF ya probado. Ninguna
 * función de este archivo escribe nada: sólo lee.
 */

import type { createClient } from '@/lib/supabase/server';
import type { PacienteContextoFormulacion } from '@/lib/clinica/formulacion';
import type { ResultadoIPT } from '@/lib/algoritmo/ipt';
import type { PatronFuncional } from '@/lib/clinica/patrones';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Mismos campos de `pacientes` que ya usa app/api/pacientes/[id]/formulacion/route.ts — reutilizados, no reinventados. */
export async function obtenerContextoContraindicacionesPaciente(
  supabase: SupabaseServerClient,
  tenantId: string,
  pacienteId: string
): Promise<PacienteContextoFormulacion | null> {
  const { data, error } = await supabase
    .from('pacientes')
    .select('alergias, medicamentos_actuales, antecedentes_personales, antecedentes_familiares')
    .eq('id', pacienteId).eq('tenant_id', tenantId).is('deleted_at', null).maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const fila = data as { alergias: string | null; medicamentos_actuales: string | null; antecedentes_personales: string | null; antecedentes_familiares: string | null };
  return {
    alergias: fila.alergias, medicamentosActuales: fila.medicamentos_actuales,
    antecedentesPersonales: fila.antecedentes_personales, antecedentesFamiliares: fila.antecedentes_familiares,
  };
}

export type IptParaProtocolo = { confirmado: boolean; resultado: ResultadoIPT[] };

export async function obtenerIptParaProtocolo(
  supabase: SupabaseServerClient,
  tenantId: string,
  pacienteId: string
): Promise<IptParaProtocolo> {
  const { data, error } = await supabase
    .from('ipt_evaluaciones')
    .select('confirmado, resultado')
    .eq('tenant_id', tenantId).eq('paciente_id', pacienteId).maybeSingle();

  if (error) throw new Error(error.message);
  const fila = data as { confirmado: boolean; resultado: ResultadoIPT[] } | null;
  return { confirmado: Boolean(fila?.confirmado), resultado: fila?.resultado ?? [] };
}

/** Sólo los patrones que el médico confirmó — nunca los `sugerido`/`descartado` (ver lib/clinica/patrones.ts). */
export async function obtenerPatronesConfirmados(
  supabase: SupabaseServerClient,
  tenantId: string,
  pacienteId: string
): Promise<PatronFuncional[]> {
  const { data, error } = await supabase
    .from('diagnosticos_funcionales')
    .select('patrones')
    .eq('tenant_id', tenantId).eq('paciente_id', pacienteId).maybeSingle();

  if (error) throw new Error(error.message);
  const patrones = (data as { patrones: PatronFuncional[] } | null)?.patrones ?? [];
  return patrones.filter(p => p.estado === 'confirmado');
}

/** Duración habitual (texto libre, ej. "8 semanas") por principio, tomada de la dosis 'usual' o, si no hay, de la 'minima'. */
export async function obtenerDuracionesHabituales(
  supabase: SupabaseServerClient,
  principioIds: string[]
): Promise<Map<string, string>> {
  if (principioIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('dosis_principios')
    .select('principio_id, tipo, duracion_habitual')
    .in('principio_id', principioIds)
    .in('tipo', ['usual', 'minima']);

  if (error) throw new Error(error.message);
  const filas = (data ?? []) as Array<{ principio_id: string; tipo: string; duracion_habitual: string | null }>;

  const mapa = new Map<string, string>();
  // Preferir 'usual' sobre 'minima': si ya hay una duración de la dosis usual, no la pisa la de la mínima.
  for (const fila of filas) {
    if (!fila.duracion_habitual) continue;
    if (fila.tipo === 'usual') mapa.set(fila.principio_id, fila.duracion_habitual);
    else if (fila.tipo === 'minima' && !mapa.has(fila.principio_id)) mapa.set(fila.principio_id, fila.duracion_habitual);
  }
  return mapa;
}

export type FlagsContraindicacion = {
  contraindicadoEmbarazo: boolean | null;
  contraindicadoLactancia: boolean | null;
  contraindicadoOncologico: boolean | null;
  precaucionAnticoagulacion: boolean;
  precaucionAntihipertensivos: boolean;
  precaucionHipoglucemiantes: boolean;
};

/**
 * `principios_activos.contraindicado_*`/`precaucion_*` — el DTO de
 * lib/repositorios/baseFarmacotecnica.ts (`PrincipioFarmacotecnico`)
 * no los expone porque el MIF todavía no los usa; se leen acá aparte
 * para no tocar ese repositorio ya probado.
 */
export async function obtenerFlagsContraindicacion(
  supabase: SupabaseServerClient,
  principioIds: string[]
): Promise<Map<string, FlagsContraindicacion>> {
  if (principioIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('principios_activos')
    .select('id, contraindicado_embarazo, contraindicado_lactancia, contraindicado_oncologico, precaucion_anticoagulacion, precaucion_antihipertensivos, precaucion_hipoglucemiantes')
    .in('id', principioIds);

  if (error) throw new Error(error.message);
  const filas = (data ?? []) as Array<{
    id: string; contraindicado_embarazo: boolean | null; contraindicado_lactancia: boolean | null; contraindicado_oncologico: boolean | null;
    precaucion_anticoagulacion: boolean; precaucion_antihipertensivos: boolean; precaucion_hipoglucemiantes: boolean;
  }>;

  return new Map(filas.map(f => [f.id, {
    contraindicadoEmbarazo: f.contraindicado_embarazo, contraindicadoLactancia: f.contraindicado_lactancia, contraindicadoOncologico: f.contraindicado_oncologico,
    precaucionAnticoagulacion: f.precaucion_anticoagulacion, precaucionAntihipertensivos: f.precaucion_antihipertensivos, precaucionHipoglucemiantes: f.precaucion_hipoglucemiantes,
  }]));
}
