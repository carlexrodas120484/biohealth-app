import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET, PATCH, DELETE } from '@/app/api/pacientes/[id]/route';

const USUARIO = { id: 'auth-1' };
const TENANT_ROW = { data: { tenant_id: 'tenant-1' }, error: null };
const SIN_TENANT_ROW = { data: { tenant_id: null }, error: null };
const ID_VALIDO = '11111111-1111-4111-8111-111111111111';

const PACIENTE_VALIDO = {
  nombre: 'Ana',
  apellido: 'Pérez',
  sexo: 'femenino',
  documento: 'QA-0002',
};

function usarMock(user: { id: string } | null, queue: any[]) {
  const { client, from } = crearSupabaseMock(user, queue);
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client);
  return from;
}

function paramsCon(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/pacientes/[id]', () => {
  it('devuelve 404 si el id no es un UUID válido, sin tocar la base', async () => {
    const from = usarMock(USUARIO, []);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon('no-es-un-uuid'));
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

  it('devuelve el detalle cuando el paciente existe y pertenece al tenant', async () => {
    const paciente = { id: ID_VALIDO, tenant_id: 'tenant-1', nombre: 'Ana' };
    usarMock(USUARIO, [TENANT_ROW, { data: paciente, error: null }]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paciente).toEqual(paciente);
  });

  it('devuelve 404 si el paciente no existe, está eliminado o es de otro tenant', async () => {
    usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/pacientes/[id]', () => {
  function req(body: unknown) {
    return new NextRequest('http://localhost/x', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await PATCH(req(PACIENTE_VALIDO), paramsCon(ID_VALIDO));
    expect(res.status).toBe(401);
  });

  it('devuelve 422 con datos inválidos', async () => {
    usarMock(USUARIO, []);
    const res = await PATCH(req({ nombre: '', apellido: '', sexo: 'x' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('devuelve 422 si el body no es JSON válido', async () => {
    usarMock(USUARIO, []);
    const badReq = new NextRequest('http://localhost/x', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'no-json',
    });
    const res = await PATCH(badReq, paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('devuelve 403 si el usuario no tiene tenant asignado', async () => {
    usarMock(USUARIO, [SIN_TENANT_ROW]);
    const res = await PATCH(req(PACIENTE_VALIDO), paramsCon(ID_VALIDO));
    expect(res.status).toBe(403);
  });

  it('edita el paciente cuando los datos son válidos y pertenece al tenant', async () => {
    const actualizado = { id: ID_VALIDO, tenant_id: 'tenant-1', ...PACIENTE_VALIDO };
    const from = usarMock(USUARIO, [TENANT_ROW, { data: actualizado, error: null }]);
    const res = await PATCH(req(PACIENTE_VALIDO), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paciente).toEqual(actualizado);

    const pacientesBuilder = from.mock.results[1].value;
    expect(pacientesBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(pacientesBuilder.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('devuelve 404 al editar un paciente inexistente', async () => {
    usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await PATCH(req(PACIENTE_VALIDO), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('devuelve 404 al editar un paciente de otro tenant (el filtro no matchea ninguna fila)', async () => {
    // el UPDATE con eq(tenant_id) no afecta filas de otro tenant: 0 filas -> data null
    usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await PATCH(req(PACIENTE_VALIDO), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Paciente no encontrado');
  });

  it('devuelve 409 si el nuevo documento choca con otro paciente del tenant', async () => {
    usarMock(USUARIO, [TENANT_ROW, { data: null, error: { code: '23505', message: 'duplicate key' } }]);
    const res = await PATCH(req(PACIENTE_VALIDO), paramsCon(ID_VALIDO));
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/pacientes/[id]', () => {
  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await DELETE(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(401);
  });

  it('devuelve 403 si el usuario no tiene tenant asignado', async () => {
    usarMock(USUARIO, [SIN_TENANT_ROW]);
    const res = await DELETE(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(403);
  });

  it('elimina lógicamente el paciente activo del tenant (count=1)', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, { data: null, error: null, count: 1 }]);
    const res = await DELETE(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    const pacientesBuilder = from.mock.results[1].value;
    expect(pacientesBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) }),
      { count: 'exact' }
    );
    expect(pacientesBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(pacientesBuilder.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('devuelve 404 al eliminar un paciente inexistente (count=0)', async () => {
    usarMock(USUARIO, [TENANT_ROW, { data: null, error: null, count: 0 }]);
    const res = await DELETE(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('devuelve 404 al eliminar un paciente de otro tenant (el filtro no matchea ninguna fila)', async () => {
    usarMock(USUARIO, [TENANT_ROW, { data: null, error: null, count: 0 }]);
    const res = await DELETE(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('la eliminación repetida no devuelve ok:true (segundo intento ya no matchea ninguna fila)', async () => {
    // primer DELETE: éxito
    const from1 = usarMock(USUARIO, [TENANT_ROW, { data: null, error: null, count: 1 }]);
    const res1 = await DELETE(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res1.status).toBe(200);
    expect((await res1.json()).ok).toBe(true);

    // segundo DELETE sobre el mismo id: deleted_at ya no es null, el
    // filtro .is('deleted_at', null) no matchea nada -> count 0
    vi.clearAllMocks();
    const from2 = usarMock(USUARIO, [TENANT_ROW, { data: null, error: null, count: 0 }]);
    const res2 = await DELETE(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res2.status).toBe(404);
    const body2 = await res2.json();
    expect(body2.error).toBe('Paciente no encontrado');
    expect(from1).toBeDefined();
    expect(from2).toBeDefined();
  });

  it('devuelve 404 si el id no es un UUID válido, sin tocar la base', async () => {
    const from = usarMock(USUARIO, []);
    const res = await DELETE(new NextRequest('http://localhost/x'), paramsCon('123'));
    expect(res.status).toBe(404);
    expect(from).not.toHaveBeenCalled();
  });
});
