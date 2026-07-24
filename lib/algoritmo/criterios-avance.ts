/**
 * lib/algoritmo/criterios-avance.ts
 *
 * Criterios de avance de fase — paso 10 (Control).
 * Portado de la especificación validada del algoritmo IPT, sección 6.
 */

import type { Fase } from './fases';

export interface CicloControl {
  reduccionIptPct: number;   // reducción del IPT de la alteración tratada
  mejoriaObjetivosPct: number; // mejoría en los síntomas del objetivo de fase
  adherenciaPct: number;
  semanasEnFase: number;
  banderaRojaNueva: boolean;
}

export type DecisionControl = 'avanzar' | 'reformular' | 'derivar_paso4';

export interface ResultadoControl {
  decision: DecisionControl;
  criterios: { nombre: string; cumple: boolean; valor: number | boolean; umbral: string }[];
  motivo: string;
}

const UMBRAL_REDUCCION_IPT = 30;
const UMBRAL_MEJORIA_OBJETIVOS = 50;
const UMBRAL_ADHERENCIA = 70;

/** Tras este número de reformulaciones consecutivas sin alcanzar los
 *  umbrales, el sistema bloquea la reformulación automática y fuerza
 *  el retorno al paso 4: el diagnóstico puede estar equivocado, no la fórmula. */
export const MAX_REFORMULACIONES_CONSECUTIVAS = 3;

export function evaluarControl(
  ciclo: CicloControl,
  fase: Fase,
  semanasMinimasFase: number,
  reformulacionesPrevias: number
): ResultadoControl {
  const criterios = [
    { nombre: 'Reducción del IPT de la alteración tratada', cumple: ciclo.reduccionIptPct >= UMBRAL_REDUCCION_IPT, valor: ciclo.reduccionIptPct, umbral: `≥ ${UMBRAL_REDUCCION_IPT}%` },
    { nombre: 'Mejoría en objetivos de fase', cumple: ciclo.mejoriaObjetivosPct >= UMBRAL_MEJORIA_OBJETIVOS, valor: ciclo.mejoriaObjetivosPct, umbral: `≥ ${UMBRAL_MEJORIA_OBJETIVOS}%` },
    { nombre: 'Adherencia reportada', cumple: ciclo.adherenciaPct >= UMBRAL_ADHERENCIA, valor: ciclo.adherenciaPct, umbral: `≥ ${UMBRAL_ADHERENCIA}%` },
    { nombre: 'Tiempo mínimo en fase', cumple: ciclo.semanasEnFase >= semanasMinimasFase, valor: ciclo.semanasEnFase, umbral: `≥ ${semanasMinimasFase} semanas` },
    { nombre: 'Banderas rojas nuevas', cumple: !ciclo.banderaRojaNueva, valor: ciclo.banderaRojaNueva, umbral: 'ninguna' },
  ];

  const todosCumplen = criterios.every(c => c.cumple);

  if (todosCumplen) {
    return { decision: 'avanzar', criterios, motivo: 'Todos los criterios de avance se cumplieron.' };
  }

  if (reformulacionesPrevias >= MAX_REFORMULACIONES_CONSECUTIVAS) {
    return {
      decision: 'derivar_paso4',
      criterios,
      motivo: `${MAX_REFORMULACIONES_CONSECUTIVAS} reformulaciones consecutivas sin alcanzar los umbrales. El diagnóstico funcional puede estar equivocado — reevaluar desde el paso 4, no reformular de nuevo.`,
    };
  }

  return { decision: 'reformular', criterios, motivo: 'Uno o más criterios no se cumplen. Se sugiere ajustar dosis, adherencia o perpetuadores antes de avanzar de fase.' };
}
