import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET, POST } from '@/app/api/pacientes/route';

const USUARIO = { id: 'auth-1' };
const TENANT_ROW = { data: { tenant_id: 'tenant-1' }, error: null };
const SIN_TENANT_ROW = { data: { tenant_id: null }, error: null };

function usarMock(user: { id: string } | null, queue: any[]) {
  const { client, from } = crearSupabaseMock(user, queue);
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client);
  return from;
}

const PACIENTE_VALIDO = {
  nombre: 'Ana',
  apellido: 'Pérez',
  sexo: 'femenino',
  documento: 'QA-0001',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/pacientes', () => {
  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await GET(new NextRequest('http://localhost/api/pacientes'));
    expect(res.status).toBe(401);
  });

  it('devuelve 403 si el usuario no tiene tenant asignado', async () => {
    usarMock(USUARIO, [SIN_TENANT_ROW]);
    const res = await GET(new NextRequest('http://localhost/api/pacientes'));
    expect(res.status).toBe(403);
  });

  it('lista pacientes activos del tenant del usuario', async () => {
    const pacientes = [{ id: 'p1', nombre: 'Ana', apellido: 'Pérez', documento: 'QA-0001', telefono: null, fecha_nacimiento: null }];
    const from = usarMock(USUARIO, [TENANT_ROW, { data: pacientes, error: null }]);
    const res = await GET(new NextRequest('http://localhost/api/pacientes'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pacientes).toEqual(pacientes);
    expect(from).toHaveBeenNthCalledWith(2, 'pacientes');
  });

  it('sanitiza caracteres especiales en la búsqueda antes de armar el filtro OR', async () => {
    const { client, from } = crearSupabaseMock(USUARIO, [TENANT_ROW, { data: [], error: null }]);
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const terminoPeligroso = `Ana%,apellido.ilike.%),(malicious`;
    const req = new NextRequest(`http://localhost/api/pacientes?q=${encodeURIComponent(terminoPeligroso)}`);
    const res = await GET(req);
    expect(res.status).toBe(200);

    const pacientesBuilder = from.mock.results[1].value;
    expect(pacientesBuilder.or).toHaveBeenCalledTimes(1);
    const [expresion] = pacientesBuilder.or.mock.calls[0];
    // el término sanitizado no debe poder inyectar condiciones OR nuevas
    // ni romper el agrupado del filtro
    expect(expresion.split('%').length - 1).toBe(6); // 3 columnas * 2 (%term%)
    expect(expresion).not.toContain('(');
    expect(expresion).not.toContain(')');
    expect(expresion.split(',').length).toBe(3); // exactamente 3 condiciones (nombre/apellido/documento)
  });

  it('no rompe con una búsqueda vacía tras sanitizar (solo símbolos)', async () => {
    const { client, from } = crearSupabaseMock(USUARIO, [TENANT_ROW, { data: [], error: null }]);
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const req = new NextRequest(`http://localhost/api/pacientes?q=${encodeURIComponent(',(),%')}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const pacientesBuilder = from.mock.results[1].value;
    expect(pacientesBuilder.or).not.toHaveBeenCalled();
  });
});

describe('POST /api/pacientes', () => {
  function req(body: unknown) {
    return new NextRequest('http://localhost/api/pacientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await POST(req(PACIENTE_VALIDO));
    expect(res.status).toBe(401);
  });

  it('devuelve 422 con datos inválidos', async () => {
    usarMock(USUARIO, []);
    const res = await POST(req({ nombre: '', apellido: '', sexo: 'x' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.detalles).toBeDefined();
  });

  it('devuelve 403 si el usuario no tiene tenant asignado', async () => {
    usarMock(USUARIO, [SIN_TENANT_ROW]);
    const res = await POST(req(PACIENTE_VALIDO));
    expect(res.status).toBe(403);
  });

  it('crea el paciente cuando los datos son válidos', async () => {
    const creado = { id: 'p1', tenant_id: 'tenant-1', ...PACIENTE_VALIDO };
    usarMock(USUARIO, [TENANT_ROW, { data: creado, error: null }]);
    const res = await POST(req(PACIENTE_VALIDO));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.paciente).toEqual(creado);
  });

  it('devuelve 409 si el documento ya existe en el tenant', async () => {
    usarMock(USUARIO, [TENANT_ROW, { data: null, error: { code: '23505', message: 'duplicate key' } }]);
    const res = await POST(req(PACIENTE_VALIDO));
    expect(res.status).toBe(409);
  });

  it('devuelve 422 si el body no es JSON válido', async () => {
    usarMock(USUARIO, []);
    const badReq = new NextRequest('http://localhost/api/pacientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ esto no es json',
    });
    const res = await POST(badReq);
    expect(res.status).toBe(422);
  });
});
