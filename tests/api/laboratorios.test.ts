import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET, POST } from '@/app/api/pacientes/[id]/laboratorios/route';

const USUARIO = { id: 'auth-1' };
const ID_VALIDO = '77777777-7777-4777-8777-777777777777';

const TENANT_ROW = { data: { tenant_id: 'tenant-1' }, error: null };
const SIN_TENANT_ROW = { data: { tenant_id: null }, error: null };
const PACIENTE_ROW = { data: { id: ID_VALIDO }, error: null };
const PACIENTE_NO_ENCONTRADO = { data: null, error: null };

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

function postReq(body: unknown) {
  return new NextRequest('http://localhost/x', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

function postReqTextoCrudo(texto: string) {
  return new NextRequest('http://localhost/x', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: texto,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('laboratorios — seguridad', () => {
  it('devuelve 404 si el id no es un UUID válido', async () => {
    const from = usarMock(USUARIO, []);
    const res = await GET(getReq(), paramsCon('no-es-uuid'));
    expect(res.status).toBe(404);
    expect(from).not.toHaveBeenCalled();
  });

  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await POST(postReq({ fecha: '2026-01-01', glucemiaMgDl: 90 }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(401);
  });

  it('devuelve 403 si el usuario no tiene tenant asignado', async () => {
    usarMock(USUARIO, [SIN_TENANT_ROW]);
    const res = await POST(postReq({ fecha: '2026-01-01' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(403);
  });

  it('devuelve 404 si el paciente no existe o pertenece a otro tenant', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_NO_ENCONTRADO]);
    const res = await POST(postReq({ fecha: '2026-01-01' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('devuelve 422 si el cuerpo no es JSON válido', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const res = await POST(postReqTextoCrudo('{no es json'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('devuelve 422 si un valor está fuera de rango razonable', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const res = await POST(postReq({ fecha: '2026-01-01', glucemiaMgDl: 99999 }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('devuelve 422 si la fecha es inválida', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const res = await POST(postReq({ fecha: 'no-es-fecha' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });
});

describe('laboratorios — creación y listado', () => {
  it('201 al crear un registro con datos parciales (sólo algunos valores)', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, { data: null, error: null }]);
    const res = await POST(postReq({ fecha: '2026-01-01', glucemiaMgDl: 90, pesoKg: 70 }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(201);
    expect(from).toHaveBeenCalledWith('laboratorios_clinicos');
  });

  it('GET devuelve la lista ordenada, sin exponer datos de otro paciente/tenant', async () => {
    const REGISTROS = { data: [{ id: 'lab-1', fecha: '2026-01-01', glucemia_mg_dl: 90 }], error: null };
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, REGISTROS]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.registros).toHaveLength(1);
  });
});
