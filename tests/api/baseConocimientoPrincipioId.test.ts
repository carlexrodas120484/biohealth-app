import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET, PATCH } from '@/app/api/admin/base-conocimiento/principios/[id]/route';
import { GET as GET_HISTORIAL } from '@/app/api/admin/base-conocimiento/principios/[id]/historial/route';

const USUARIO = { id: 'auth-1' };
const TITULAR_ROW = { data: { tenant_id: 'tenant-1', rol: 'medico_titular' }, error: null };
const INVITADO_ROW = { data: { tenant_id: 'tenant-1', rol: 'medico_invitado' }, error: null };
const ID_VALIDO = '99999999-9999-4999-8999-999999999999';

function usarMock(user: { id: string } | null, queue: any[]) {
  const { client, from } = crearSupabaseMock(user, queue);
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client);
  return from;
}

function paramsCon(id: string) {
  return { params: Promise.resolve({ id }) };
}

function getReq() {
  return new NextRequest('http://localhost/x');
}

function patchReq(body: unknown) {
  return new NextRequest('http://localhost/x', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

function principio(estado: string) {
  return { data: { id: ID_VALIDO, estado, nombre_canonico: 'Ingrediente X' }, error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /principios/[id] — seguridad', () => {
  it('devuelve 404 si el id no es un UUID válido, sin tocar la base', async () => {
    const from = usarMock(USUARIO, []);
    const res = await GET(getReq(), paramsCon('no-uuid'));
    expect(res.status).toBe(404);
    expect(from).not.toHaveBeenCalled();
  });

  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(401);
  });

  it('devuelve 403 si el usuario no tiene rol autorizado', async () => {
    usarMock(USUARIO, [INVITADO_ROW]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(403);
  });

  it('devuelve 404 si el principio no existe o pertenece a otro tenant (aislamiento)', async () => {
    const from = usarMock(USUARIO, [TITULAR_ROW, { data: null, error: null }]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
    const builder = from.mock.results[1].value;
    expect(builder.or).toHaveBeenCalledWith('tenant_id.is.null,tenant_id.eq.tenant-1');
  });

  it('devuelve el detalle completo, incluso de un principio archivado', async () => {
    usarMock(USUARIO, [TITULAR_ROW, principio('archivado')]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.principio.estado).toBe('archivado');
  });
});

describe('PATCH /principios/[id] — transición de estado', () => {
  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await PATCH(patchReq({ transicion: { estado: 'en_revision' } }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(401);
  });

  it('devuelve 403 si el usuario no tiene rol autorizado', async () => {
    usarMock(USUARIO, [INVITADO_ROW]);
    const res = await PATCH(patchReq({ transicion: { estado: 'en_revision' } }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(403);
  });

  it('devuelve 422 si el cuerpo no es JSON válido', async () => {
    usarMock(USUARIO, [TITULAR_ROW]);
    const req = new NextRequest('http://localhost/x', { method: 'PATCH', body: '{roto' });
    const res = await PATCH(req, paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('devuelve 404 si el principio no existe', async () => {
    usarMock(USUARIO, [TITULAR_ROW, { data: null, error: null }]);
    const res = await PATCH(patchReq({ transicion: { estado: 'en_revision' } }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('permite pasar de borrador a en_revision', async () => {
    usarMock(USUARIO, [TITULAR_ROW, principio('borrador'), { data: null, error: null }, { data: null, error: null }]);
    const res = await PATCH(patchReq({ transicion: { estado: 'en_revision' } }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
  });

  it('devuelve 409 si intenta saltar directo de borrador a validado', async () => {
    usarMock(USUARIO, [TITULAR_ROW, principio('borrador')]);
    const res = await PATCH(patchReq({ transicion: { estado: 'validado' } }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(409);
  });

  it('permite validar un principio que está en_revision', async () => {
    usarMock(USUARIO, [TITULAR_ROW, principio('en_revision'), { data: null, error: null }, { data: null, error: null }]);
    const res = await PATCH(patchReq({ transicion: { estado: 'validado' } }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
  });

  it('devuelve 409 si intenta transicionar un principio archivado a validado', async () => {
    usarMock(USUARIO, [TITULAR_ROW, principio('archivado')]);
    const res = await PATCH(patchReq({ transicion: { estado: 'validado' } }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(409);
  });

  it('devuelve 422 si el estado de la transición es inválido', async () => {
    usarMock(USUARIO, [TITULAR_ROW, principio('borrador')]);
    const res = await PATCH(patchReq({ transicion: { estado: 'no_existe' } }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });
});

describe('PATCH /principios/[id] — edición de campos y protección de datos validados', () => {
  it('devuelve 409 si intenta editar campos de un principio validado sin forzar sobrescritura', async () => {
    usarMock(USUARIO, [TITULAR_ROW, principio('validado')]);
    const res = await PATCH(patchReq({ campos: { descripcion: 'nueva' } }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(409);
  });

  it('permite editar un principio validado si se envía forzarSobrescritura, y lo regresa a en_revision', async () => {
    const from = usarMock(USUARIO, [TITULAR_ROW, principio('validado'), { data: null, error: null }, { data: null, error: null }]);
    const res = await PATCH(patchReq({ campos: { descripcion: 'nueva' }, forzarSobrescritura: true }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const updateBuilder = from.mock.results[2].value;
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ estado: 'en_revision' }));
  });

  it('permite editar campos de un principio en borrador sin forzar nada', async () => {
    usarMock(USUARIO, [TITULAR_ROW, principio('borrador'), { data: null, error: null }, { data: null, error: null }]);
    const res = await PATCH(patchReq({ campos: { descripcion: 'actualizada' } }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
  });

  it('devuelve 422 si no se envía ni transicion ni campos', async () => {
    usarMock(USUARIO, [TITULAR_ROW, principio('borrador')]);
    const res = await PATCH(patchReq({}), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });
});

describe('GET /principios/[id]/historial — historial de cambios', () => {
  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await GET_HISTORIAL(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(401);
  });

  it('devuelve 403 si el rol no está autorizado', async () => {
    usarMock(USUARIO, [INVITADO_ROW]);
    const res = await GET_HISTORIAL(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(403);
  });

  it('devuelve 404 si el principio no existe o es de otro tenant', async () => {
    usarMock(USUARIO, [TITULAR_ROW, { data: null, error: null }]);
    const res = await GET_HISTORIAL(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('devuelve el historial de cambios ordenado, sin poder alterarlo (sólo lectura)', async () => {
    const historialFilas = [
      { id: 'h2', accion: 'validado', created_at: '2026-01-02' },
      { id: 'h1', accion: 'creado', created_at: '2026-01-01' },
    ];
    const from = usarMock(USUARIO, [TITULAR_ROW, { data: { id: ID_VALIDO }, error: null }, { data: historialFilas, error: null }]);
    const res = await GET_HISTORIAL(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.historial).toEqual(historialFilas);
    const historialBuilder = from.mock.results[2].value;
    expect(historialBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});
