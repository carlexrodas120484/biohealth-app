/**
 * lib/algoritmo/fases.ts
 *
 * Selección de fase BioHealth® — árbol de compuertas.
 *
 * Portado del prototipo validado (paso 6): la fase NO se elige por el
 * IPT más alto, se elige por un cascadeo de compuertas ordenadas. La
 * primera compuerta que se cumple define la fase; las siguientes no
 * se evalúan. Este orden es fisiológico, no estadístico — barrera y
 * microbiota van antes que un eje endocrino específico porque no tiene
 * sentido tratar la tiroides si el paciente no absorbe lo que se le da.
 *
 * Igual que ipt.ts, este módulo es puro: no depende de Next.js ni de
 * Supabase. El umbral de dominio (60) vive acá como constante nombrada,
 * no mágica, para que quede claro que es parte de la rúbrica versionada
 * — si en el futuro se recalibra, se mueve a `ipt_compuertas` en base
 * de datos exactamente como se documentó en el diseño del algoritmo.
 */

import type { AlteracionInput } from './ipt';
import { iptMaximoPorDominio } from './ipt';

export type Fase = 'restore' | 'repair' | 'reset' | 'target' | 'regenerate' | 'balance';

/** Dominios clínicos reconocidos por el árbol de compuertas. Cada
 *  alteración diagnosticada en el paso 4 se etiqueta con uno de estos. */
export const DOMINIOS = {
  BARRERA: 'barrera_microbiota',
  INFLAMATORIO: 'inflamatorio',
  TOXICO_METABOLICO: 'toxico_metabolico',
  EJE_ESPECIFICO: 'eje_especifico',
  DEFICIT_RESIDUAL: 'deficit_residual',
} as const;

export const UMBRAL_DOMINIO = 60;

export interface FaseInfo {
  fase: Fase;
  nombre: string;
  objetivos: string[];
  semanasMinimas: number;
}

export const FASES: Record<Fase, FaseInfo> = {
  restore: { fase: 'restore', nombre: 'Restore', objetivos: ['Reparar mucosa intestinal', 'Disminuir inflamación', 'Mejorar microbiota', 'Optimizar digestión enzimática', 'Restaurar pH gástrico'], semanasMinimas: 6 },
  repair: { fase: 'repair', nombre: 'Repair', objetivos: ['Reducir estrés oxidativo', 'Modular citoquinas', 'Reparar tejido conectivo'], semanasMinimas: 8 },
  reset: { fase: 'reset', nombre: 'Reset', objetivos: ['Activar detoxificación fase II', 'Sensibilizar a la insulina', 'Regular cortisol'], semanasMinimas: 6 },
  target: { fase: 'target', nombre: 'Target', objetivos: ['Optimizar eje tiroideo', 'Modular eje HPA'], semanasMinimas: 12 },
  regenerate: { fase: 'regenerate', nombre: 'Regenerate', objetivos: ['Biogénesis mitocondrial', 'Reparación tisular'], semanasMinimas: 12 },
  balance: { fase: 'balance', nombre: 'Balance', objetivos: ['Mantenimiento', 'Prevención'], semanasMinimas: 0 },
};

export interface CompuertaResultado {
  orden: number;
  nombre: string;
  dominio: string | null;
  iptDominio: number | null;
  evaluada: boolean;
  cumple: boolean;
  faseResultante: Fase | null;
}

export interface ResultadoSeleccionFase {
  fase: Fase;
  compuertas: CompuertaResultado[];
  /** true si una bandera roja detuvo el árbol antes de llegar a evaluar dominios */
  derivado: boolean;
}

/**
 * Evalúa el árbol de compuertas y devuelve la fase sugerida junto con
 * el detalle de cada compuerta — lo que el paso 6 muestra en pantalla
 * para que el médico vea *por qué* se llegó a esa fase, no solo el
 * resultado.
 *
 * @param alteraciones   alteraciones diagnosticadas en el paso 4, con dominio asignado
 * @param banderaRoja    true si algún criterio de seguridad exige derivar antes de tratar
 */
export function seleccionarFase(
  alteraciones: AlteracionInput[],
  banderaRoja: boolean
): ResultadoSeleccionFase {
  const compuertas: CompuertaResultado[] = [];
  let orden = 1;

  compuertas.push({
    orden: orden++,
    nombre: 'Bandera roja de seguridad',
    dominio: null,
    iptDominio: null,
    evaluada: true,
    cumple: banderaRoja,
    faseResultante: null, // una bandera roja deriva fuera del algoritmo, no asigna fase
  });

  if (banderaRoja) {
    return { fase: 'balance', compuertas, derivado: true };
  }

  const cascada: { dominio: string; nombre: string; fase: Fase }[] = [
    { dominio: DOMINIOS.BARRERA, nombre: 'Barrera o microbiota', fase: 'restore' },
    { dominio: DOMINIOS.INFLAMATORIO, nombre: 'Inflamación o daño tisular', fase: 'repair' },
    { dominio: DOMINIOS.TOXICO_METABOLICO, nombre: 'Carga tóxica o metabólica', fase: 'reset' },
    { dominio: DOMINIOS.EJE_ESPECIFICO, nombre: 'Eje o sistema específico', fase: 'target' },
    { dominio: DOMINIOS.DEFICIT_RESIDUAL, nombre: 'Déficit funcional residual', fase: 'regenerate' },
  ];

  let faseElegida: Fase | null = null;

  for (const paso of cascada) {
    const yaResuelto = faseElegida !== null;
    const iptDominio = yaResuelto ? null : iptMaximoPorDominio(alteraciones, paso.dominio);
    const cumple = !yaResuelto && iptDominio !== null && iptDominio >= UMBRAL_DOMINIO;

    compuertas.push({
      orden: orden++,
      nombre: paso.nombre,
      dominio: paso.dominio,
      iptDominio,
      evaluada: !yaResuelto,
      cumple,
      faseResultante: cumple ? paso.fase : null,
    });

    if (cumple) faseElegida = paso.fase;
  }

  return {
    fase: faseElegida ?? 'balance',
    compuertas,
    derivado: false,
  };
}

/**
 * Un factor perpetuador nunca compite por fase — regla dura del
 * algoritmo. Genera una acción concurrente que corre en paralelo
 * a la fase elegida, no una fase propia. Esta función solo filtra
 * las alteraciones marcadas como perpetuador activo para que la capa
 * de UI pueda mostrarlas en su propio panel.
 */
export function perpetuadoresActivos(alteraciones: AlteracionInput[]): AlteracionInput[] {
  return alteraciones.filter(a => a.perpetuadorActivo);
}
