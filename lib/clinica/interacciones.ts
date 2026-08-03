/**
 * lib/clinica/interacciones.ts
 *
 * Detección de interacciones para el MIPO. Corre sobre los principios
 * YA seleccionados por el MPI (post-exclusiones) — nunca decide qué
 * entra o sale del protocolo, sólo informa. Función pura: no llama a
 * Supabase (eso lo hace lib/repositorios/interaccionesPrincipios.ts,
 * que el orquestador de mipo.ts invoca por separado).
 *
 * Dos fuentes, ambas ya existentes y sin usar hasta ahora:
 *   - `interacciones_principios` con `principio_relacionado_id`:
 *     interacción entre dos principios — sólo se informa si AMBOS
 *     están en el protocolo (si uno no está, no aplica a esta receta).
 *   - `interacciones_principios` con `sustancia_externa`: interacción
 *     con una sustancia — sólo se informa si esa sustancia aparece en
 *     la medicación actual registrada del paciente (cruce por texto,
 *     misma técnica ya usada en `generarAlertas` de formulacion.ts:
 *     heurística explícita, nunca un diagnóstico).
 */

import { normalizarNombre } from './baseConocimiento';
import type { PrincipioSeleccionMPI } from './mpi';
import type { PacienteContextoFormulacion } from './formulacion';
import type { InteraccionPrincipioRepo, SeveridadInteraccionRepo } from '@/lib/repositorios/interaccionesPrincipios';

export type SeveridadInteraccion = SeveridadInteraccionRepo;

export type InteraccionDetectada = {
  principioA: string;
  principioB: string | null;
  sustanciaExterna: string | null;
  severidad: SeveridadInteraccion;
  tipo: string | null;
  descripcion: string;
  fuente: 'interacciones_principios' | 'medicacion-externa';
};

function contieneSustancia(texto: string | null, sustancia: string): boolean {
  if (!texto) return false;
  return normalizarNombre(texto).includes(normalizarNombre(sustancia));
}

/**
 * Nunca excluye ni modifica `seleccionados` — sólo lee de ahí los
 * nombres para poder informar cuáles interacciones son relevantes
 * para ESTA receta en particular.
 */
export function detectarInteracciones(
  seleccionados: PrincipioSeleccionMPI[],
  filasInteraccion: InteraccionPrincipioRepo[],
  contextoPaciente: PacienteContextoFormulacion | null
): InteraccionDetectada[] {
  const nombrePorId = new Map<string, string>();
  for (const c of seleccionados) {
    if (c.principio) nombrePorId.set(c.principio.id, c.nombre);
  }

  const resultado: InteraccionDetectada[] = [];
  const vistos = new Set<string>();

  for (const fila of filasInteraccion) {
    if (fila.principioRelacionadoId) {
      const nombreA = nombrePorId.get(fila.principioId);
      const nombreB = nombrePorId.get(fila.principioRelacionadoId);
      if (!nombreA || !nombreB) continue; // uno de los dos no está en este protocolo: no aplica.

      const clave = ['pp', ...[nombreA, nombreB].sort()].join('|');
      if (vistos.has(clave)) continue;
      vistos.add(clave);

      resultado.push({
        principioA: nombreA, principioB: nombreB, sustanciaExterna: null,
        severidad: fila.severidad, tipo: fila.tipo, descripcion: fila.descripcion, fuente: 'interacciones_principios',
      });
      continue;
    }

    if (fila.sustanciaExterna) {
      const nombreA = nombrePorId.get(fila.principioId);
      if (!nombreA) continue;
      if (!contieneSustancia(contextoPaciente?.medicamentosActuales ?? null, fila.sustanciaExterna)) continue;

      const clave = ['pm', nombreA, fila.sustanciaExterna].join('|');
      if (vistos.has(clave)) continue;
      vistos.add(clave);

      resultado.push({
        principioA: nombreA, principioB: null, sustanciaExterna: fila.sustanciaExterna,
        severidad: fila.severidad, tipo: fila.tipo, descripcion: fila.descripcion, fuente: 'medicacion-externa',
      });
    }
  }

  return resultado;
}
