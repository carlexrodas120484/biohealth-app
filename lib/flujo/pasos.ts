/**
 * Orden canónico del flujo clínico paciente-a-informe. Un único lugar
 * de verdad para "cuál es el siguiente paso" — antes vivía inline en
 * app/(app)/pacientes/[id]/layout.tsx (para el StepRail) y cada
 * formulario de paso tenía que saber a mano a qué ruta navegar después
 * de guardar. Ahora ambos usan esto.
 */
export const RUTA_POR_PASO = [
  'historia', 'cuestionario', 'bioescaner', 'diagnostico', 'ipt',
  'fase', 'objetivos', 'formulacion', 'nutricion', 'control', 'informes',
] as const;

export type PasoFlujo = (typeof RUTA_POR_PASO)[number];

/** Ruta del siguiente paso, o null si `actual` es el último (o no se reconoce). */
export function siguientePaso(actual: string): PasoFlujo | null {
  const i = RUTA_POR_PASO.indexOf(actual as PasoFlujo);
  if (i === -1 || i === RUTA_POR_PASO.length - 1) return null;
  return RUTA_POR_PASO[i + 1];
}
