import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET, POST } from '@/app/api/admin/base-conocimiento/principios/route';

const USUARIO = { id: 'auth-1' };
const TITULAR_ROW = { data: { tenant_id: 'tenant-1', rol: 'medico_titular' }, error: null };
const INVITADO_ROW = { data: { tenant_id: 'tenant-1', rol: 'medico_invitado' }, error: null };
const SIN_TENANT_ROW = { data: { tenant_id: null, rol: 'medico_titular' }, error: null };

function usarMock(user: { id: string } | null, queue: any[]) {
  const { client, from } = crearSupabaseMock(user, queue);
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client);
  return from;
}

function getReq(qs = '') {
  return new NextRequest(`http://localhost/api/admin/base-conocimiento/principios${qs}`);
}

function postReq(body: unknown) {
  return new NextRequest('http://localhost/api/admin/base-conocimiento/principios', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

function principioValido(overrides: Record<string, unknown> = {}) {
  return {
    nombreCanonico: 'Ingrediente de prueba',
    sinonimos: [],
    dosis: [
      { tipo: 'minima', valor: 100, unidad: 'mg', sinEvidencia: true },
      { tipo: 'maxima', valor: 500, unidad: 'mg', sinEvidencia: true },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/base-conocimiento/principios — seguridad', () => {
  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await GET(getReq());
    expect(res.status).toBe(401);
  });

  it('devuelve 403 si el usuario no tiene rol autorizado (sin rol de acceso al panel)', async () => {
    usarMock(USUARIO, [INVITADO_ROW]);
    const res = await GET(getReq());
    expect(res.status).toBe(403);
  });

  it('devuelve 403 si el usuario no tiene tenant asignado', async () => {
    usarMock(USUARIO, [SIN_TENANT_ROW]);
    const res = await GET(getReq());
    expect(res.status).toBe(403);
  });

  it('filtra por catálogo compartido o del propio tenant (aislamiento entre tenants)', async () => {
    const from = usarMock(USUARIO, [TITULAR_ROW, { data: [], error: null, count: 0 }]);
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const builder = from.mock.results[1].value;
    expect(builder.or).toHaveBeenCalledWith('tenant_id.is.null,tenant_id.eq.tenant-1');
  });
});

describe('POST /api/admin/base-conocimiento/principios — seguridad', () => {
  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await POST(postReq(principioValido()));
    expect(res.status).toBe(401);
  });

  it('devuelve 403 si el usuario no tiene rol autorizado', async () => {
    usarMock(USUARIO, [INVITADO_ROW]);
    const res = await POST(postReq(principioValido()));
    expect(res.status).toBe(403);
  });

  it('devuelve 422 si el cuerpo no es JSON válido', async () => {
    usarMock(USUARIO, [TITULAR_ROW]);
    const req = new NextRequest('http://localhost/api/admin/base-conocimiento/principios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{no es json',
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });
});

describe('POST /api/admin/base-conocimiento/principios — validación de datos', () => {
  it('devuelve 422 si faltan datos requeridos (nombre vacío)', async () => {
    usarMock(USUARIO, [TITULAR_ROW]);
    const res = await POST(postReq(principioValido({ nombreCanonico: '' })));
    expect(res.status).toBe(422);
  });

  it('devuelve 422 si una dosis no trae unidad válida', async () => {
    usarMock(USUARIO, [TITULAR_ROW]);
    const res = await POST(postReq(principioValido({
      dosis: [{ tipo: 'usual', valor: 100, unidad: 'kg', sinEvidencia: true }],
    })));
    expect(res.status).toBe(422);
  });

  it('devuelve 422 si una dosis no tiene ni referencia ni marca "sin evidencia"', async () => {
    usarMock(USUARIO, [TITULAR_ROW]);
    const res = await POST(postReq(principioValido({
      dosis: [{ tipo: 'usual', valor: 100, unidad: 'mg', sinEvidencia: false }],
    })));
    expect(res.status).toBe(422);
  });

  it('devuelve 422 si la dosis máxima es menor que la mínima', async () => {
    usarMock(USUARIO, [TITULAR_ROW]);
    const res = await POST(postReq(principioValido({
      dosis: [
        { tipo: 'minima', valor: 500, unidad: 'mg', sinEvidencia: true },
        { tipo: 'maxima', valor: 100, unidad: 'mg', sinEvidencia: true },
      ],
    })));
    expect(res.status).toBe(422);
  });

  it('devuelve 422 si el límite de edad máximo es menor que el mínimo', async () => {
    usarMock(USUARIO, [TITULAR_ROW]);
    const res = await POST(postReq(principioValido({ limiteEdadMinAnios: 18, limiteEdadMaxAnios: 5 })));
    expect(res.status).toBe(422);
  });
});

describe('POST /api/admin/base-conocimiento/principios — duplicados', () => {
  it('devuelve 409 si ya existe un principio con el mismo nombre canónico', async () => {
    usarMock(USUARIO, [
      TITULAR_ROW,
      { data: [{ nombre_canonico: 'Ingrediente de Prueba' }], error: null },
      { data: [], error: null },
    ]);
    const res = await POST(postReq(principioValido()));
    expect(res.status).toBe(409);
  });

  it('devuelve 409 si el nombre choca con un sinónimo existente', async () => {
    usarMock(USUARIO, [
      TITULAR_ROW,
      { data: [], error: null },
      { data: [{ sinonimo: 'Ingrediente de Prueba', principio_id: 'otro-id' }], error: null },
    ]);
    const res = await POST(postReq(principioValido()));
    expect(res.status).toBe(409);
  });

  it('devuelve 409 si dos sinónimos del lote enviado están duplicados entre sí', async () => {
    usarMock(USUARIO, [
      TITULAR_ROW,
      { data: [], error: null },
      { data: [], error: null },
    ]);
    const res = await POST(postReq(principioValido({ sinonimos: ['Sinónimo A', 'sinónimo a'] })));
    expect(res.status).toBe(409);
  });
});

describe('POST /api/admin/base-conocimiento/principios — creación válida', () => {
  it('crea el principio en estado borrador y registra historial', async () => {
    const from = usarMock(USUARIO, [
      TITULAR_ROW,
      { data: [], error: null },
      { data: [], error: null },
      { data: { id: 'nuevo-id' }, error: null },
      { data: null, error: null },
    ]);
    const res = await POST(postReq(principioValido()));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBe('nuevo-id');

    const insertBuilder = from.mock.results[3].value;
    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'borrador',
      pendiente_validacion: true,
    }));

    const tablas = from.mock.calls.map((c: unknown[]) => c[0]);
    expect(tablas).toContain('historial_principios_activos');
  });
});
