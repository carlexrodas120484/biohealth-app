/**
 * lib/adaptadores/protocoloAFormulacion.ts
 *
 * Único punto de traducción entre el resultado del MPI
 * (`PrincipioSeleccionMPI[]`) y las dos formas que ya consume el
 * flujo de Formulación existente (app/api/pacientes/[id]/formulacion,
 * sin tocar):
 *   - `IngredienteFormula[]`: modelo estructurado (lib/clinica/
 *     formulacion.ts), el que alimenta el motor de reglas real
 *     (construirPreparaciones/generarAlertas).
 *   - `ItemLegacy[]`: modelo de texto libre que ya usan la firma y el
 *     PDF (lib/pdf/documentos-clinicos.ts) — mismo campo por campo que
 *     el `ItemSchema` (hoy interno, no exportado) de esa ruta.
 *
 * Es un formateador puro: no decide presentación, dosis ni sabor —
 * sólo traduce lo que el MIF/MPI ya decidieron a la forma que el
 * resto del sistema ya sabe leer. Determinista: los mismos
 * `PrincipioSeleccionMPI[]` de entrada siempre producen la misma
 * salida (ids derivados del id estable del principio, nunca
 * aleatorios).
 */

import { HORARIOS, type Horario, type Presentacion, type IngredienteFormula } from '@/lib/clinica/formulacion';
import { mgDesdeDosis } from '@/lib/clinica/mif';
import { normalizarNombre } from '@/lib/clinica/baseConocimiento';
import type { PrincipioSeleccionMPI } from '@/lib/clinica/mpi';

/** Mismos campos que el `ItemSchema` interno de app/api/pacientes/[id]/formulacion/route.ts — no se modifica esa ruta, sólo se produce un objeto compatible con lo que ya espera. */
export type ItemLegacy = {
  id: string;
  nombre: string;
  dosis: string;
  presentacion: string;
  cantidad: string;
  indicacion: string;
  observaciones: string;
  evidencia?: string;
  fuente?: string;
};

const PRESENTACIONES_LEGACY = new Set<Presentacion>(['capsula', 'sobre', 'liquido', 'comercial']);
const HORARIOS_VALIDOS = new Set<Horario>(HORARIOS);

function horarioValido(h: string | null): Horario {
  return h && HORARIOS_VALIDOS.has(h as Horario) ? (h as Horario) : 'desayuno';
}

/**
 * `IngredienteFormula.presentacionElegida` sólo admite las 4 formas
 * "clásicas" (capsula/sobre/liquido/comercial) — el MIF ya puede
 * sugerir perlas/polvo/comprimidos (Base Farmacotécnica ampliada),
 * que ese campo todavía no representa. En ese caso se deja sin
 * definir (undefined es válido: el motor de formulación existente
 * recalcula la presentación por su cuenta) en vez de forzar un valor
 * incorrecto.
 */
function presentacionLegacyOIndefinida(p: string | undefined): Presentacion | undefined {
  return p && PRESENTACIONES_LEGACY.has(p as Presentacion) ? (p as Presentacion) : undefined;
}

function dosisPorTomaMgValida(c: PrincipioSeleccionMPI): number | null {
  if (!c.dosisElegida) return null;
  const mg = mgDesdeDosis(c.dosisElegida);
  if (mg === null || mg <= 0) return null;
  return Math.round(mg * 100) / 100; // evita ruido de punto flotante en conversiones desde mcg
}

/**
 * Sólo incluye candidatos con dosis positiva convertible a mg y
 * principio resuelto en la Base Farmacotécnica — `dosisPorTomaMg` es
 * obligatorio y positivo en `IngredienteFormula`
 * (`IngredienteInputSchema`), así que un candidato sin esos datos no
 * puede representarse ahí sin inventar un número. Ese candidato sigue
 * apareciendo en `itemsSugeridos` (texto libre, más tolerante) para
 * que no desaparezca de la vista del médico.
 */
export function adaptarAIngredientes(seleccionados: PrincipioSeleccionMPI[]): IngredienteFormula[] {
  const resultado: IngredienteFormula[] = [];

  for (const c of seleccionados) {
    if (!c.principio) continue;
    const dosisPorTomaMg = dosisPorTomaMgValida(c);
    if (dosisPorTomaMg === null) continue;

    resultado.push({
      id: c.principio.id,
      nombre: c.nombre,
      dosisPorTomaMg,
      // El MPI asigna un único horario por principio (agrupación en
      // preparados de lib/clinica/mpi.ts) — todavía no calcula
      // múltiples tomas diarias, así que 1 vez/día es la lectura
      // correcta de ese modelo, no un valor inventado por el adaptador.
      vecesPorDia: 1,
      horario: horarioValido(c.horarioRecomendado),
      presentacionElegida: presentacionLegacyOIndefinida(c.decisionPresentacion?.presentacionSugerida),
    });
  }

  return resultado;
}

function textoDosis(c: PrincipioSeleccionMPI): string {
  if (!c.dosisElegida) return 'Sin dosis validada — definir manualmente';
  return `${c.dosisElegida.valor} ${c.dosisElegida.unidad}`.slice(0, 200);
}

function idDeterministico(c: PrincipioSeleccionMPI): string {
  return c.principio ? c.principio.id : `sin-validar-${normalizarNombre(c.nombre)}`.slice(0, 100);
}

/** Igual criterio de determinismo que `adaptarAIngredientes`; acá sí se incluyen TODOS los candidatos, incluso sin dosis (texto libre lo tolera). */
export function adaptarAItems(seleccionados: PrincipioSeleccionMPI[]): ItemLegacy[] {
  return seleccionados.map(c => ({
    id: idDeterministico(c),
    nombre: c.nombre.slice(0, 150),
    dosis: textoDosis(c),
    presentacion: (c.decisionPresentacion?.presentacionSugerida ?? '').slice(0, 200),
    cantidad: (c.duracionSugerida ?? '').slice(0, 120),
    indicacion: c.objetivos.join(', ').slice(0, 300),
    observaciones: c.advertencias.map(a => a.descripcion).join(' ').slice(0, 500),
  }));
}
