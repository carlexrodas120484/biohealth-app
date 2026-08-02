import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET, PUT } from '@/app/api/pacientes/[id]/historia/route';

const USUARIO = { id: 'auth-1' };
const TENANT_ROW = { data: { tenant_id: 'tenant-1' }, error: null };
const SIN_TENANT_ROW = { data: { tenant_id: null }, error: null };
const PACIENTE_ROW = { data: { id: 'p1' }, error: null };
const ID_VALIDO = '11111111-1111-4111-8111-111111111111';

function usarMock(user: { id: string } | null, queue: any[]) {
  const { client, from } = crearSupabaseMock(user, queue);
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client);
  return from;
}

function paramsCon(id: string) {
  return { params: Promise.resolve({ id }) };
}

const HISTORIA_VALIDA = {
  motivo: 'Fatiga persistente',
  enfermedadActual: 'Cansancio de 3 meses de evolución',
  peso: 70,
  talla: 170,
  estres: 5,
  bristol: 4,
  fiebrePersistente: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/pacientes/[id]/historia', () => {
  it('devuelve 404 si el id no es un UUID válido, sin tocar la base', async () => {
    const from = usarMock(USUARIO, []);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon('no-es-uuid'));
    expect(res.status).toBe(404);
    expect(from).not.toHaveBeenCalled();
  });

  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(401);
  });

  it('devuelve 403 si el usuario no tiene tenant asignado', async () => {
    usarMock(USUARIO, [SIN_TENANT_ROW]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(403);
  });

  it('devuelve 500 si falla la consulta del usuario (no lo confunde con "sin tenant")', async () => {
    usarMock(USUARIO, [{ data: null, error: { message: 'timeout de conexión' } }]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(500);
  });

  it('devuelve 404 si el paciente no existe', async () => {
    usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('devuelve 404 si el paciente es de otro tenant (el filtro no lo matchea)', async () => {
    usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('devuelve 404 si el paciente está eliminado (el filtro deleted_at is null no lo matchea)', async () => {
    usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('devuelve valores por defecto si el paciente existe pero todavía no tiene historia', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, { data: null, error: null }]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.historia).toEqual({});
    expect(body.respuestas).toEqual({});
    expect(body.puntajes).toEqual({});
    expect(body.completado).toBe(false);
    expect(body.updatedAt).toBeNull();
    expect(body.version).toBeNull();
    expect(body.resumen.topSintomas).toEqual([]);
    expect(body.resumen.advertencia).toEqual(expect.any(String));
  });

  it('carga la historia existente sin duplicarla, filtrando por tenant_id', async () => {
    const fila = {
      historia: { motivo: 'Control' }, respuestas: { a: 2 }, puntajes: { X: { puntos: 2, maximo: 4, porcentaje: 50 } },
      completado: true, updated_at: '2026-01-01T00:00:00Z',
    };
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, { data: fila, error: null }]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.historia).toEqual(fila.historia);
    expect(body.completado).toBe(true);
    expect(body.updatedAt).toBe(fila.updated_at);

    const historiasBuilder = from.mock.results[2].value;
    expect(historiasBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(historiasBuilder.eq).toHaveBeenCalledWith('paciente_id', ID_VALIDO);
  });
});

describe('PUT /api/pacientes/[id]/historia', () => {
  function req(body: unknown) {
    return new NextRequest('http://localhost/x', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await PUT(req({ historia: HISTORIA_VALIDA }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(401);
  });

  it('devuelve 403 si el usuario no tiene tenant asignado', async () => {
    usarMock(USUARIO, [SIN_TENANT_ROW]);
    const res = await PUT(req({ historia: HISTORIA_VALIDA }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(403);
  });

  it('devuelve 404 si el paciente no existe, es de otro tenant o está eliminado', async () => {
    usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await PUT(req({ historia: HISTORIA_VALIDA }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('devuelve 422 si el body no es JSON válido', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const badReq = new NextRequest('http://localhost/x', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{ esto no es json',
    });
    const res = await PUT(badReq, paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('devuelve 422 con datos clínicos inválidos (peso fuera de rango, respuesta fuera de escala)', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const res = await PUT(
      req({ historia: { ...HISTORIA_VALIDA, peso: 9999 }, respuestas: { 'digestivo-1': 9 } }),
      paramsCon(ID_VALIDO)
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.detalles).toBeDefined();
  });

  it('crea la historia cuando el paciente todavía no tiene una (upsert)', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, { data: { updated_at: '2026-01-01T00:00:00Z' }, error: null }]);
    const res = await PUT(req({ historia: HISTORIA_VALIDA, respuestas: {}, completado: false }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.updatedAt).toBe('2026-01-01T00:00:00Z');

    const historiasBuilder = from.mock.results[2].value;
    expect(historiasBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 'tenant-1', paciente_id: ID_VALIDO }),
      { onConflict: 'tenant_id,paciente_id' }
    );
  });

  it('actualiza (no duplica) cuando la historia ya existe: mismo upsert con la misma unique key', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, { data: { updated_at: '2026-02-01T00:00:00Z' }, error: null }]);
    const res = await PUT(req({ historia: { ...HISTORIA_VALIDA, motivo: 'Control de seguimiento' }, respuestas: {}, completado: true }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);

    const historiasBuilder = from.mock.results[2].value;
    // el onConflict sobre (tenant_id, paciente_id) es lo que garantiza
    // "una historia por paciente": nunca hay un INSERT que duplique.
    expect(historiasBuilder.upsert).toHaveBeenCalledTimes(1);
    const [, opciones] = historiasBuilder.upsert.mock.calls[0];
    expect(opciones).toEqual({ onConflict: 'tenant_id,paciente_id' });
  });

  it('no permite crear o editar la historia de un paciente de otro tenant (aislamiento)', async () => {
    // la resolución de paciente ya filtra por tenant_id: si es de otro
    // tenant, la búsqueda no lo encuentra y nunca se llega al upsert.
    const from = usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await PUT(req({ historia: HISTORIA_VALIDA }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('propaga 500 si el upsert falla', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, { data: null, error: { message: 'db error' } }]);
    const res = await PUT(req({ historia: HISTORIA_VALIDA }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(500);
  });
});
