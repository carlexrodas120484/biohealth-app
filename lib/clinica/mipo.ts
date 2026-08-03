/**
 * lib/clinica/mipo.ts
 *
 * Motor Inteligente de Prescripción Ortomolecular (MIPO) — Etapa 1.
 *
 * Orquesta, en este orden fijo: MPI (ya existente, sin tocar) →
 * interacciones → explicación clínica → adaptación al modelo de
 * Formulación existente → VCI (ya existente, sin tocar). No
 * reimplementa ninguna regla clínica de MIF/MPI/VCI — cada paso
 * reutiliza sus funciones públicas tal cual.
 *
 * De sólo lectura: no inserta, actualiza ni firma nada.
 * `generarPrescripcionSugerida` nunca persiste — el guardado y la
 * firma siguen siendo, exclusivamente, responsabilidad de
 * app/api/pacientes/[id]/formulacion/route.ts (sin tocar), a partir
 * de que un médico revise y confirme esta sugerencia.
 */

import { generarProtocoloSugerido, type ProtocoloSugerido } from './mpi';
import { validarPrescripcion, type ResultadoVCI } from './vci';
import { detectarInteracciones, type InteraccionDetectada } from './interacciones';
import { explicarProtocolo, type ExplicacionClinicaPrincipio } from './explicacionClinica';
import { adaptarAIngredientes, adaptarAItems, type ItemLegacy } from '@/lib/adaptadores/protocoloAFormulacion';
import { REGLAS_FORMULACION_DEFECTO, type ReglasFormulacion, type IngredienteFormula } from './formulacion';
import { obtenerContextoContraindicacionesPaciente } from '@/lib/repositorios/protocolo';
import { obtenerInteraccionesPorPrincipios } from '@/lib/repositorios/interaccionesPrincipios';
import type { createClient } from '@/lib/supabase/server';

export const VERSION_MIPO = 1;

export const ADVERTENCIA_MIPO =
  'Motor Inteligente de Prescripción Ortomolecular: genera una sugerencia de receta completa a partir de la historia clínica, ' +
  'el diagnóstico, el IPT, los objetivos terapéuticos, la Base Farmacotécnica y la Base de Conocimiento Clínica. ' +
  'No diagnostica, no prescribe ni firma nada por su cuenta — es una sugerencia sujeta a revisión y aprobación médica antes de convertirse en receta.';

export type PrescripcionSugerida = {
  pacienteId: string;
  disponible: boolean;
  motivoNoDisponible: string | null;
  protocolo: ProtocoloSugerido;
  interacciones: InteraccionDetectada[];
  explicaciones: ExplicacionClinicaPrincipio[];
  ingredientesSugeridos: IngredienteFormula[];
  itemsSugeridos: ItemLegacy[];
  resultadoVCI: ResultadoVCI;
  version: number;
  advertenciaLegal: string;
};

function prescripcionNoDisponible(protocolo: ProtocoloSugerido): PrescripcionSugerida {
  return {
    pacienteId: protocolo.pacienteId, disponible: false, motivoNoDisponible: protocolo.motivoNoDisponible,
    protocolo, interacciones: [], explicaciones: [], ingredientesSugeridos: [], itemsSugeridos: [],
    resultadoVCI: validarPrescripcion(protocolo), version: VERSION_MIPO, advertenciaLegal: ADVERTENCIA_MIPO,
  };
}

/**
 * Punto de entrada del MIPO. No es una función pura en sentido
 * estricto (hace lecturas a Supabase, como MPI/MIF), pero es
 * determinista para un mismo estado de base de datos, y ninguna de
 * sus llamadas internas muta la entrada de la siguiente: cada paso
 * recibe datos ya calculados y devuelve una estructura nueva.
 */
export async function generarPrescripcionSugerida(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  pacienteId: string,
  reglas: ReglasFormulacion = REGLAS_FORMULACION_DEFECTO
): Promise<PrescripcionSugerida> {
  // 1) MPI completo — selección, exclusiones, presentación, sabor, agrupación y orden ya resueltos.
  const protocolo = await generarProtocoloSugerido(supabase, tenantId, pacienteId, reglas);
  if (!protocolo.disponible) return prescripcionNoDisponible(protocolo);

  const idsSeleccionados = protocolo.principiosSeleccionados
    .map(c => c.principio?.id)
    .filter((id): id is string => Boolean(id));

  const [contextoPaciente, filasInteraccion] = await Promise.all([
    obtenerContextoContraindicacionesPaciente(supabase, tenantId, pacienteId),
    obtenerInteraccionesPorPrincipios(supabase, idsSeleccionados),
  ]);

  // 2) Interacciones — sólo informan, nunca excluyen ni modifican `protocolo.principiosSeleccionados`.
  const interacciones = detectarInteracciones(protocolo.principiosSeleccionados, filasInteraccion, contextoPaciente);

  // 3) Explicación clínica — formateo puro sobre lo ya calculado por MIF/MPI.
  const explicaciones = explicarProtocolo(protocolo.principiosSeleccionados);

  // 4) Adaptación al modelo de Formulación existente — sin tocar esa pantalla ni esa ruta.
  const ingredientesSugeridos = adaptarAIngredientes(protocolo.principiosSeleccionados);
  const itemsSugeridos = adaptarAItems(protocolo.principiosSeleccionados);

  // 5) VCI — audita el protocolo del MPI tal cual lo diseñamos; no requiere cambios en vci.ts.
  const resultadoVCI = validarPrescripcion(protocolo);

  return {
    pacienteId, disponible: true, motivoNoDisponible: null,
    protocolo, interacciones, explicaciones, ingredientesSugeridos, itemsSugeridos, resultadoVCI,
    version: VERSION_MIPO, advertenciaLegal: ADVERTENCIA_MIPO,
  };
}
