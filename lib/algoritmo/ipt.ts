/**
 * lib/algoritmo/ipt.ts
 *
 * Índice de Prioridad Terapéutica (IPT) — Método BioHealth®
 *
 * Portado 1:1 desde el prototipo validado (biohealth_prototipo.html).
 * Los pesos y coeficientes NO se modifican acá: viven en `ipt_pesos` en
 * base de datos y se inyectan como parámetro, para que el ajuste futuro
 * de la rúbrica no requiera tocar código ni redeployar.
 *
 * Este archivo es intencionalmente puro: no importa Next.js, no importa
 * Supabase, no toca el DOM. Recibe datos, devuelve un resultado. Eso es
 * lo que permite testearlo con Vitest sin levantar base de datos, y es
 * el mismo cálculo que ya se validó interactivamente en el prototipo.
 */

export type NivelJerarquico = 'primaria' | 'secundaria' | 'terciaria';

export interface PesosIPT {
  IC: number; // impacto clínico
  IS: number; // influencia sistémica
  RV: number; // reversibilidad
  EV: number; // evidencia científica
  CB: number; // costo-beneficio
}

export interface JerarquiaIPT {
  primaria: number;
  secundaria: number;
  terciaria: number;
}

/** Rúbrica de consenso experto v1.0 — valores por defecto si la tabla
 *  `ipt_pesos` no trae una versión vigente para el tenant. */
export const PESOS_DEFAULT: PesosIPT = { IC: 0.30, IS: 0.25, RV: 0.20, EV: 0.15, CB: 0.10 };
export const JERARQUIA_DEFAULT: JerarquiaIPT = { primaria: 1.15, secundaria: 1.00, terciaria: 0.85 };

/** Puntos que suma un perpetuador activo no resuelto. Nunca resta: una
 *  alteración sostenida por una causa viva es más urgente, no menos. */
export const BONUS_PERPETUADOR = 8;

export interface AlteracionInput {
  id: string;
  nombre: string;
  dominio: string;
  nivel: NivelJerarquico;
  perpetuadorActivo: boolean;
  /** cronicidad en meses; si > 12, penaliza 1 punto de RV antes del cálculo */
  cronicidadMeses?: number;
  IC: number;
  IS: number;
  RV: number;
  EV: number;
  CB: number;
}

export interface ResultadoIPT {
  alteracionId: string;
  base: number;       // suma ponderada × 20, antes de modificadores
  jerarquico: number;  // base × coeficiente de nivel
  final: number;        // + bonus de perpetuador, acotado a [0, 100]
  banda: BandaPrioridad;
}

export type BandaPrioridad = 'critica' | 'alta' | 'media' | 'diferida';

export interface BandaInfo {
  banda: BandaPrioridad;
  etiqueta: string;
}

/**
 * Calcula el IPT de una alteración.
 *
 * Fórmula (idéntica al prototipo):
 *   base       = (IC·wIC + IS·wIS + RV·wRV + EV·wEV + CB·wCB) × 20
 *   jerarquico = base × coeficiente_nivel
 *   final      = min(100, jerarquico + (perpetuador ? 8 : 0))
 *
 * Ajuste de cronicidad: si la alteración lleva más de 12 meses, se resta
 * 1 punto de RV *antes* del cálculo (no del resultado final) — refleja
 * que lo crónico es estadísticamente menos reversible.
 */
export function calcularIPT(
  a: AlteracionInput,
  pesos: PesosIPT = PESOS_DEFAULT,
  jerarquia: JerarquiaIPT = JERARQUIA_DEFAULT
): ResultadoIPT {
  const rv = a.cronicidadMeses && a.cronicidadMeses > 12 ? Math.max(0, a.RV - 1) : a.RV;

  const base = (pesos.IC * a.IC + pesos.IS * a.IS + pesos.RV * rv + pesos.EV * a.EV + pesos.CB * a.CB) * 20;
  const jerarquico = base * jerarquia[a.nivel];
  const final = Math.min(100, jerarquico + (a.perpetuadorActivo ? BONUS_PERPETUADOR : 0));

  return {
    alteracionId: a.id,
    base: Math.round(base),
    jerarquico: Math.round(jerarquico),
    final: Math.round(final),
    banda: bandaDe(final).banda,
  };
}

/** Bandas de prioridad — determinan la conducta clínica sugerida. */
export function bandaDe(v: number): BandaInfo {
  if (v >= 80) return { banda: 'critica', etiqueta: 'Crítica' };
  if (v >= 65) return { banda: 'alta', etiqueta: 'Alta' };
  if (v >= 45) return { banda: 'media', etiqueta: 'Media' };
  return { banda: 'diferida', etiqueta: 'Diferida' };
}

/**
 * Calcula el IPT de un conjunto de alteraciones y las devuelve
 * ordenadas de mayor a menor prioridad — el orden que el médico ve
 * en el paso 5.
 */
export function calcularRankingIPT(
  alteraciones: AlteracionInput[],
  pesos?: PesosIPT,
  jerarquia?: JerarquiaIPT
): ResultadoIPT[] {
  return alteraciones
    .map(a => calcularIPT(a, pesos, jerarquia))
    .sort((x, y) => y.final - x.final);
}

/**
 * IPT máximo de un dominio clínico (ej. "Barrera", "Inflamatorio").
 * Es el valor que consumen las compuertas de fase en lib/algoritmo/fases.ts.
 * Devuelve 0 si el dominio no tiene alteraciones activas.
 */
export function iptMaximoPorDominio(
  alteraciones: AlteracionInput[],
  dominio: string,
  pesos?: PesosIPT,
  jerarquia?: JerarquiaIPT
): number {
  const delDominio = alteraciones.filter(a => a.dominio === dominio);
  if (delDominio.length === 0) return 0;
  return Math.max(...delDominio.map(a => calcularIPT(a, pesos, jerarquia).final));
}

/**
 * Punto de partida sugerido (no una decisión) para IC/IS/RV/EV/CB de una
 * alteración recién agregada, a partir de su nivel jerárquico — así el
 * médico ve un formulario con valores razonables para ajustar en vez de
 * ceros vacíos, sin que el sistema le imponga una puntuación clínica.
 */
export function sugerirPuntuacionPorNivel(nivel: NivelJerarquico): number {
  if (nivel === 'primaria') return 4;
  if (nivel === 'secundaria') return 3;
  return 2;
}
