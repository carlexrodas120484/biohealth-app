import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET, PUT } from '@/app/api/pacientes/[id]/objetivos/route';

const USUARIO = { id: 'auth-1' };
const PACIENTE_ID = '77777777-7777-4777-8777-777777777777';

const TENANT_ROW = { data: { tenant_id: 'tenant-1' }, error: null };
const SIN_TENANT_ROW = { data: { tenant_id: null }, error: null };
const PACIENTE_ROW = { data: { id: PACIENTE_ID }, error: null };
const PACIENTE_NO_ENCONTRADO = { data: null, error: null };
const FASE_CONFIRMADA = { data: { fase_seleccionada: 'restore', confirmado: true }, error: null };
const FASE_NO_CONFIRMADA = { data: { fase_seleccionada: 'restore', confirmado: false }, error: null };
const SIN_OBJETIVOS_GUARDADOS = { data: null, error: null };

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

function putReq(body: unknown) {
  return new NextRequest('http://localhost/x', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('objetivos — seguridad', () => {
  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await GET(getReq(), paramsCon(PACIENTE_ID));
    expect(res.status).toBe(401);
  });

  it('devuelve 403 si el usuario no tiene tenant asignado', async () => {
    usarMock(USUARIO, [SIN_TENANT_ROW]);
    const res = await GET(getReq(), paramsCon(PACIENTE_ID));
    expect(res.status).toBe(403);
  });

  it('devuelve 404 si el paciente no existe o pertenece a otro tenant', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_NO_ENCONTRADO]);
    const res = await GET(getReq(), paramsCon(PACIENTE_ID));
    expect(res.status).toBe(404);
  });
});

describe('objetivos — auto-generación (flujo automático)', () => {
  it('sin objetivos guardados, GET pre-selecciona TODOS los objetivos de la fase confirmada', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_OBJETIVOS_GUARDADOS]);
    const res = await GET(getReq(), paramsCon(PACIENTE_ID));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.objetivos).toEqual(body.objetivosDisponibles);
    expect(body.objetivos.length).toBeGreaterThan(0);
    expect(body.confirmado).toBe(false);
  });

  it('devuelve 409 si la fase todavía no está confirmada (no puede autogenerar objetivos sin fase)', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_NO_CONFIRMADA]);
    const res = await GET(getReq(), paramsCon(PACIENTE_ID));
    expect(res.status).toBe(409);
  });

  it('respeta los objetivos ya guardados por el médico en vez de autogenerar de nuevo', async () => {
    const GUARDADOS = { data: { fase: 'restore', objetivos: ['Reparar mucosa intestinal'], semanas_previstas: 6, confirmado: true }, error: null };
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, GUARDADOS]);
    const res = await GET(getReq(), paramsCon(PACIENTE_ID));
    const body = await res.json();
    expect(body.objetivos).toEqual(['Reparar mucosa intestinal']);
    expect(body.confirmado).toBe(true);
  });

  it('si cambió la fase desde el último guardado, vuelve a autogenerar todos los objetivos de la fase nueva', async () => {
    const GUARDADOS_DE_OTRA_FASE = { data: { fase: 'repair', objetivos: ['Reducir estrés oxidativo'], semanas_previstas: 8, confirmado: true }, error: null };
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, GUARDADOS_DE_OTRA_FASE]);
    const res = await GET(getReq(), paramsCon(PACIENTE_ID));
    const body = await res.json();
    expect(body.objetivos).toEqual(body.objetivosDisponibles);
    expect(body.confirmado).toBe(false);
  });
});

describe('objetivos — guardado', () => {
  it('PUT confirma los objetivos y semanas previstas', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, { data: null, error: null }]);
    const res = await PUT(putReq({ objetivos: ['Reparar mucosa intestinal'], semanasPrevistas: 6, confirmado: true }), paramsCon(PACIENTE_ID));
    expect(res.status).toBe(200);
    expect(from).toHaveBeenCalledWith('objetivos_terapeuticos');
  });

  it('PUT rechaza un objetivo que no pertenece a la fase confirmada', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA]);
    const res = await PUT(putReq({ objetivos: ['Objetivo inventado'], semanasPrevistas: 6, confirmado: true }), paramsCon(PACIENTE_ID));
    expect(res.status).toBe(409);
  });

  it('PUT rechaza si la fase no está confirmada', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_NO_CONFIRMADA]);
    const res = await PUT(putReq({ objetivos: ['Reparar mucosa intestinal'], semanasPrevistas: 6, confirmado: true }), paramsCon(PACIENTE_ID));
    expect(res.status).toBe(409);
  });

  it('PUT rechaza semanas por debajo del mínimo de la fase', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA]);
    const res = await PUT(putReq({ objetivos: ['Reparar mucosa intestinal'], semanasPrevistas: 1, confirmado: true }), paramsCon(PACIENTE_ID));
    expect(res.status).toBe(422);
  });
});
