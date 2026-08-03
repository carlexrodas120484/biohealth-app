/**
 * lib/repositorios/interaccionesPrincipios.ts
 *
 * Primera lectura de `interacciones_principios` (tabla creada en la
 * migración 0024, sin ningún consumidor hasta ahora). De sólo
 * lectura: no inserta, actualiza ni borra nada.
 *
 * Devuelve las filas "en crudo" (por id de principio, sin resolver
 * nombres) — quien llama (lib/clinica/interacciones.ts) ya tiene la
 * lista de principios seleccionados con sus nombres y arma el cruce.
 * Mantener el repositorio así de simple evita acoplarlo a la forma de
 * `PrincipioSeleccionMPI`.
 */

import type { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type SeveridadInteraccionRepo = 'leve' | 'moderada' | 'alta';

export type InteraccionPrincipioRepo = {
  id: string;
  principioId: string;
  principioRelacionadoId: string | null;
  sustanciaExterna: string | null;
  tipo: string | null;
  descripcion: string;
  severidad: SeveridadInteraccionRepo;
};

type FilaInteraccion = {
  id: string; principio_id: string; principio_relacionado_id: string | null;
  sustancia_externa: string | null; tipo: string | null; descripcion: string; severidad: SeveridadInteraccionRepo;
};

const COLUMNAS = 'id, principio_id, principio_relacionado_id, sustancia_externa, tipo, descripcion, severidad';

function aInteraccionRepo(fila: FilaInteraccion): InteraccionPrincipioRepo {
  return {
    id: fila.id, principioId: fila.principio_id, principioRelacionadoId: fila.principio_relacionado_id,
    sustanciaExterna: fila.sustancia_externa, tipo: fila.tipo, descripcion: fila.descripcion, severidad: fila.severidad,
  };
}

/**
 * Trae toda interacción donde alguno de los `principioIds` participe,
 * ya sea como `principio_id` o como `principio_relacionado_id` — una
 * interacción principio↔principio puede estar cargada desde
 * cualquiera de los dos lados de la relación. RLS (política
 * `interacciones_principios_select` de 0024) sigue aplicando en
 * ambas consultas.
 */
export async function obtenerInteraccionesPorPrincipios(
  supabase: SupabaseServerClient,
  principioIds: string[]
): Promise<InteraccionPrincipioRepo[]> {
  if (principioIds.length === 0) return [];

  const [comoOrigen, comoRelacionado] = await Promise.all([
    supabase.from('interacciones_principios').select(COLUMNAS).in('principio_id', principioIds),
    supabase.from('interacciones_principios').select(COLUMNAS).in('principio_relacionado_id', principioIds),
  ]);

  if (comoOrigen.error) throw new Error(comoOrigen.error.message);
  if (comoRelacionado.error) throw new Error(comoRelacionado.error.message);

  const vistos = new Set<string>();
  const resultado: InteraccionPrincipioRepo[] = [];
  for (const fila of [...(comoOrigen.data ?? []), ...(comoRelacionado.data ?? [])] as FilaInteraccion[]) {
    if (vistos.has(fila.id)) continue;
    vistos.add(fila.id);
    resultado.push(aInteraccionRepo(fila));
  }
  return resultado;
}
