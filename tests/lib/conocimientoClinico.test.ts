import { describe, it, expect, vi, beforeEach } from 'vitest';
import { crearSupabaseMock } from '../helpers/supabaseMock';
import {
  ConocimientoClinicoInputSchema, ConocimientoClinicoBaseSchema, TransicionEstadoConocimientoSchema,
} from '@/lib/validation/conocimientoClinico';
import {
  listarConocimientoValidadoPorObjetivoYFase, listarConocimientoPorPrincipio, obtenerConocimientoClinico,
  obtenerHistorialConocimientoClinico, crearConocimientoClinico, actualizarCamposConocimientoClinico,
  transicionarEstadoConocimientoClinico,
} from '@/lib/repositorios/conocimientoClinico';

const PRINCIPIO_ID = '11111111-1111-4111-8111-111111111111';

function entradaValida(overrides: Record<string, unknown> = {}) {
  return {
    principioActivoId: PRINCIPIO_ID,
    objetivoTerapeutico: 'Disminuir inflamación',
    fase: 'restore',
    dosisMinima: 100,
    dosisMaxima: 500,
    dosisHabitual: 250,
    unidadDosis: 'mg',
    ...overrides,
  };
}

describe('ConocimientoClinicoInputSchema — validación', () => {
  it('acepta una entrada válida y aplica los valores por defecto', () => {
    const r = ConocimientoClinicoInputSchema.safeParse(entradaValida());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.prioridad).toBe('media');
      expect(r.data.requiereSobre).toBe(false);
      expect(r.data.requiereCapsula).toBe(false);
      expect(r.data.ordenSugerido).toBe(0);
      expect(r.data.contraindicaciones).toEqual([]);
    }
  });

  it('rechaza si falta principioActivoId', () => {
    const { principioActivoId, ...resto } = entradaValida();
    void principioActivoId;
    expect(ConocimientoClinicoInputSchema.safeParse(resto).success).toBe(false);
  });

  it('rechaza un principioActivoId que no es UUID', () => {
    expect(ConocimientoClinicoInputSchema.safeParse(entradaValida({ principioActivoId: 'no-uuid' })).success).toBe(false);
  });

  it('rechaza una fase inválida', () => {
    expect(ConocimientoClinicoInputSchema.safeParse(entradaValida({ fase: 'no-existe' })).success).toBe(false);
  });

  it('rechaza una prioridad inválida', () => {
    expect(ConocimientoClinicoInputSchema.safeParse(entradaValida({ prioridad: 'critica' })).success).toBe(false);
  });

  it('rechaza un nivel de evidencia inválido', () => {
    expect(ConocimientoClinicoInputSchema.safeParse(entradaValida({ nivelEvidencia: 'E' })).success).toBe(false);
  });

  it('rechaza una unidad de dosis inválida', () => {
    expect(ConocimientoClinicoInputSchema.safeParse(entradaValida({ unidadDosis: 'kg' })).success).toBe(false);
  });

  it('rechaza un horario inválido', () => {
    expect(ConocimientoClinicoInputSchema.safeParse(entradaValida({ horario: 'medianoche' })).success).toBe(false);
  });

  it('rechaza si la dosis máxima es menor que la mínima', () => {
    const r = ConocimientoClinicoInputSchema.safeParse(entradaValida({ dosisMinima: 500, dosisMaxima: 100 }));
    expect(r.success).toBe(false);
  });

  it('rechaza si requiereSobre y requiereCapsula son true a la vez', () => {
    const r = ConocimientoClinicoInputSchema.safeParse(entradaValida({ requiereSobre: true, requiereCapsula: true }));
    expect(r.success).toBe(false);
  });

  it('acepta requiereSobre sin requiereCapsula', () => {
    expect(ConocimientoClinicoInputSchema.safeParse(entradaValida({ requiereSobre: true })).success).toBe(true);
  });

  it('el esquema base admite .partial() para ediciones parciales', () => {
    const r = ConocimientoClinicoBaseSchema.partial().safeParse({ prioridad: 'alta' });
    expect(r.success).toBe(true);
  });
});

describe('TransicionEstadoConocimientoSchema', () => {
  it('acepta un estado válido', () => {
    expect(TransicionEstadoConocimientoSchema.safeParse({ estado: 'validado' }).success).toBe(true);
  });
  it('rechaza un estado inexistente', () => {
    expect(TransicionEstadoConocimientoSchema.safeParse({ estado: 'aprobado' }).success).toBe(false);
  });
});

function usarMock(queue: any[]) {
  const { client, from } = crearSupabaseMock({ id: 'user-1' }, queue);
  return { client: client as any, from };
}

const FILA_BASE = {
  id: 'ck-1', tenant_id: null, principio_activo_id: PRINCIPIO_ID, objetivo_terapeutico: 'Disminuir inflamación', fase: 'restore',
  prioridad: 'media', evidencia: null, nivel_evidencia: null,
  dosis_habitual: 250, dosis_minima: 100, dosis_maxima: 500, unidad_dosis: 'mg',
  horario: null, observaciones: null, contraindicaciones: [], interacciones: [],
  requiere_sobre: false, requiere_capsula: false, orden_sugerido: 0,
  estado: 'borrador', pendiente_validacion: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listarConocimientoValidadoPorObjetivoYFase', () => {
  it('filtra por estado validado, objetivo, fase y tenant/catálogo compartido', async () => {
    const { client, from } = usarMock([{ data: [{ ...FILA_BASE, estado: 'validado' }], error: null }]);
    const resultado = await listarConocimientoValidadoPorObjetivoYFase(client, 'tenant-1', 'Disminuir inflamación', 'restore');
    expect(resultado).toHaveLength(1);
    expect(resultado[0].estado).toBe('validado');
    const builder = from.mock.results[0].value;
    expect(builder.eq).toHaveBeenCalledWith('estado', 'validado');
    expect(builder.eq).toHaveBeenCalledWith('objetivo_terapeutico', 'Disminuir inflamación');
    expect(builder.eq).toHaveBeenCalledWith('fase', 'restore');
    expect(builder.or).toHaveBeenCalledWith('tenant_id.is.null,tenant_id.eq.tenant-1');
  });

  it('devuelve lista vacía si no hay coincidencias', async () => {
    const { client } = usarMock([{ data: [], error: null }]);
    const resultado = await listarConocimientoValidadoPorObjetivoYFase(client, 'tenant-1', 'Objetivo inexistente', 'restore');
    expect(resultado).toEqual([]);
  });
});

describe('listarConocimientoPorPrincipio / obtenerConocimientoClinico', () => {
  it('lista todas las indicaciones de un principio sin filtrar por estado', async () => {
    const { client, from } = usarMock([{ data: [FILA_BASE, { ...FILA_BASE, id: 'ck-2', estado: 'validado' }], error: null }]);
    const resultado = await listarConocimientoPorPrincipio(client, 'tenant-1', PRINCIPIO_ID);
    expect(resultado).toHaveLength(2);
    const builder = from.mock.results[0].value;
    expect(builder.eq).toHaveBeenCalledWith('principio_activo_id', PRINCIPIO_ID);
  });

  it('devuelve null si la indicación no existe o es de otro tenant', async () => {
    const { client } = usarMock([{ data: null, error: null }]);
    const resultado = await obtenerConocimientoClinico(client, 'tenant-1', 'no-existe');
    expect(resultado).toBeNull();
  });

  it('mapea correctamente todos los campos de una fila existente', async () => {
    const { client } = usarMock([{ data: FILA_BASE, error: null }]);
    const resultado = await obtenerConocimientoClinico(client, 'tenant-1', 'ck-1');
    expect(resultado).toMatchObject({
      id: 'ck-1', principioActivoId: PRINCIPIO_ID, objetivoTerapeutico: 'Disminuir inflamación', fase: 'restore',
      dosisMinima: 100, dosisMaxima: 500, unidadDosis: 'mg', estado: 'borrador',
    });
  });
});

describe('obtenerHistorialConocimientoClinico', () => {
  it('devuelve el historial ordenado por fecha descendente', async () => {
    const filas = [
      { id: 'h2', accion: 'validado', campo_modificado: 'estado', valor_anterior: 'en_revision', valor_nuevo: 'validado', realizado_por: 'user-1', created_at: '2026-01-02' },
      { id: 'h1', accion: 'creado', campo_modificado: null, valor_anterior: null, valor_nuevo: 'borrador', realizado_por: null, created_at: '2026-01-01' },
    ];
    const { client, from } = usarMock([{ data: filas, error: null }]);
    const historial = await obtenerHistorialConocimientoClinico(client, 'ck-1');
    expect(historial).toHaveLength(2);
    expect(historial[0].accion).toBe('validado');
    const builder = from.mock.results[0].value;
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});

describe('crearConocimientoClinico', () => {
  it('crea en estado borrador y registra historial "creado"', async () => {
    const { client, from } = usarMock([
      { data: { id: 'nuevo-ck' }, error: null },
      { data: null, error: null },
    ]);
    const resultado = await crearConocimientoClinico(client, 'user-1', {
      principioActivoId: PRINCIPIO_ID, objetivoTerapeutico: 'Disminuir inflamación', fase: 'restore',
      prioridad: 'media', contraindicaciones: [], interacciones: [], requiereSobre: false, requiereCapsula: false, ordenSugerido: 0,
    } as any);
    expect('id' in resultado && resultado.id).toBe('nuevo-ck');
    const insertBuilder = from.mock.results[0].value;
    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ estado: 'borrador', pendiente_validacion: true }));
    const tablas = from.mock.calls.map((c: unknown[]) => c[0]);
    expect(tablas).toContain('historial_conocimiento_clinico');
  });

  it('devuelve error si el insert falla', async () => {
    const { client } = usarMock([{ data: null, error: { message: 'fallo de base de datos' } }]);
    const resultado = await crearConocimientoClinico(client, 'user-1', {
      principioActivoId: PRINCIPIO_ID, objetivoTerapeutico: 'X', fase: 'restore',
      prioridad: 'media', contraindicaciones: [], interacciones: [], requiereSobre: false, requiereCapsula: false, ordenSugerido: 0,
    } as any);
    expect('error' in resultado).toBe(true);
  });
});

describe('actualizarCamposConocimientoClinico', () => {
  it('devuelve error si la indicación no existe', async () => {
    const { client } = usarMock([{ data: null, error: null }]);
    const resultado = await actualizarCamposConocimientoClinico(client, 'tenant-1', 'user-1', 'no-existe', { prioridad: 'alta' });
    expect('error' in resultado).toBe(true);
  });

  it('devuelve error si está validado y no se fuerza la sobrescritura', async () => {
    const { client } = usarMock([{ data: { ...FILA_BASE, estado: 'validado' }, error: null }]);
    const resultado = await actualizarCamposConocimientoClinico(client, 'tenant-1', 'user-1', 'ck-1', { prioridad: 'alta' });
    expect('error' in resultado).toBe(true);
  });

  it('actualiza campos de una indicación en borrador sin forzar nada', async () => {
    const { client, from } = usarMock([
      { data: FILA_BASE, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    const resultado = await actualizarCamposConocimientoClinico(client, 'tenant-1', 'user-1', 'ck-1', { prioridad: 'alta' });
    expect('ok' in resultado).toBe(true);
    const updateBuilder = from.mock.results[1].value;
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ prioridad: 'alta' }));
  });

  it('al forzar sobrescritura de un registro validado, lo regresa a en_revision', async () => {
    const { client, from } = usarMock([
      { data: { ...FILA_BASE, estado: 'validado' }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    const resultado = await actualizarCamposConocimientoClinico(client, 'tenant-1', 'user-1', 'ck-1', { observaciones: 'nueva nota' }, true);
    expect('ok' in resultado).toBe(true);
    const updateBuilder = from.mock.results[1].value;
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ estado: 'en_revision', pendiente_validacion: true, validado_por: null, validado_en: null }));
  });
});

describe('transicionarEstadoConocimientoClinico', () => {
  it('devuelve error si la indicación no existe', async () => {
    const { client } = usarMock([{ data: null, error: null }]);
    const resultado = await transicionarEstadoConocimientoClinico(client, 'tenant-1', 'user-1', 'no-existe', 'en_revision');
    expect('error' in resultado).toBe(true);
  });

  it('rechaza saltar directo de borrador a validado', async () => {
    const { client } = usarMock([{ data: FILA_BASE, error: null }]);
    const resultado = await transicionarEstadoConocimientoClinico(client, 'tenant-1', 'user-1', 'ck-1', 'validado');
    expect('error' in resultado).toBe(true);
  });

  it('permite pasar de borrador a en_revision', async () => {
    const { client } = usarMock([
      { data: FILA_BASE, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    const resultado = await transicionarEstadoConocimientoClinico(client, 'tenant-1', 'user-1', 'ck-1', 'en_revision');
    expect(resultado).toMatchObject({ ok: true, estado: 'en_revision' });
  });

  it('permite validar desde en_revision y marca validado_por/validado_en', async () => {
    const { client, from } = usarMock([
      { data: { ...FILA_BASE, estado: 'en_revision' }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    const resultado = await transicionarEstadoConocimientoClinico(client, 'tenant-1', 'user-1', 'ck-1', 'validado');
    expect(resultado).toMatchObject({ ok: true, estado: 'validado' });
    const updateBuilder = from.mock.results[1].value;
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ validado_por: 'user-1', pendiente_validacion: false }));
  });

  it('permite archivar un registro validado', async () => {
    const { client } = usarMock([
      { data: { ...FILA_BASE, estado: 'validado' }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    const resultado = await transicionarEstadoConocimientoClinico(client, 'tenant-1', 'user-1', 'ck-1', 'archivado');
    expect(resultado).toMatchObject({ ok: true, estado: 'archivado' });
  });

  it('rechaza archivar directamente a validado (transición inexistente)', async () => {
    const { client } = usarMock([{ data: { ...FILA_BASE, estado: 'archivado' }, error: null }]);
    const resultado = await transicionarEstadoConocimientoClinico(client, 'tenant-1', 'user-1', 'ck-1', 'validado');
    expect('error' in resultado).toBe(true);
  });

  it('restaurar desde archivado limpia la marca de validación', async () => {
    const { client, from } = usarMock([
      { data: { ...FILA_BASE, estado: 'archivado' }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    const resultado = await transicionarEstadoConocimientoClinico(client, 'tenant-1', 'user-1', 'ck-1', 'borrador');
    expect(resultado).toMatchObject({ ok: true, estado: 'borrador' });
    const updateBuilder = from.mock.results[1].value;
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ pendiente_validacion: true, validado_por: null, validado_en: null }));
  });
});
