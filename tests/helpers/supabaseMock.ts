import { vi } from 'vitest';

export interface MockResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

interface MockUser {
  id: string;
  email?: string;
}

/**
 * Mock mínimo del cliente Supabase para probar rutas de la API sin una
 * base de datos real. Cada llamada a `.from(tabla)` consume el siguiente
 * resultado de `queue`, en el mismo orden en que la ruta bajo prueba hace
 * sus llamadas — así que `queue` debe reflejar exactamente esa secuencia
 * (ej.: [resolución de tenant, operación sobre `pacientes`]).
 *
 * Los métodos de filtro (`eq`, `is`, `or`, `order`, `select`, `update`,
 * `insert`) son no-op encadenables: no filtran datos de verdad, sólo
 * dejan pasar el resultado precocinado hasta el punto terminal
 * (`single`, `maybeSingle`, o el `await` directo del builder).
 */
export function crearSupabaseMock(
  user: MockUser | null,
  queue: MockResult[],
  opciones?: { signInWithPasswordError?: unknown }
) {
  let indice = 0;
  const llamadasFrom: string[] = [];

  const from = vi.fn((tabla: string) => {
    llamadasFrom.push(tabla);
    const resultado: MockResult = queue[indice] ?? { data: null, error: null };
    indice += 1;

    const resolved = () =>
      Promise.resolve({
        data: resultado.data ?? null,
        error: resultado.error ?? null,
        count: resultado.count ?? null,
      });

    const builder: any = {
      select: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      or: vi.fn(() => builder),
      in: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      single: vi.fn(() => resolved()),
      maybeSingle: vi.fn(() => resolved()),
      then: (resolve: any, reject: any) => resolved().then(resolve, reject),
    };
    return builder;
  });

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
      signInWithPassword: vi.fn(async () => ({
        data: opciones?.signInWithPasswordError ? null : { user },
        error: opciones?.signInWithPasswordError ?? null,
      })),
    },
    from,
  };

  return { client, from, llamadasFrom };
}
