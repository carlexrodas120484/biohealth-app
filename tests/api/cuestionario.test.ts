import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';
import { PREGUNTAS_SCREENING } from '../../lib/clinica/cuestionario';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET, PUT } from '@/app/api/pacientes/[id]/historia/route';

const USUARIO = { id: 'auth-1' };
const TENANT_ROW = { data: { tenant_id: 'tenant-1' }, error: null };
const SIN_TENANT_ROW = { data: { tenant_id: null }, error: null };
const PACIENTE_ROW = { data: { id: 'p1' }, error: null };
const ID_VALIDO = '22222222-2222-4222-8222-222222222222';
const ID_OTRO_PACIENTE = '33333333-3333-4333-8333-333333333333';

function usarMock(user: { id: string } | null, queue: any[]) {
  const { client, from } = crearSupabaseMock(user, queue);
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client);
  return from;
}

function paramsCon(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req(body: unknown) {
  return new NextRequest('http://localhost/x', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Cuestionario funcional — carga', () => {
  it('devuelve respuestas y resumen vacíos cuando el paciente no tiene cuestionario cargado', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, { data: null, error: null }]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.respuestas).toEqual({});
    // sin respuestas, todos los sistemas con preguntas quedan en 0%
    // (siguen apareciendo: "sin datos" también es información para el
    // médico); el que no tiene preguntas todavía no aparece.
    expect(body.resumen.sistemas.every((s: { porcentaje: number }) => s.porcentaje === 0)).toBe(true);
    expect(body.resumen.sistemas.find((s: { sistema: string }) => s.sistema === 'Hábitos y estilo de vida')).toBeUndefined();
    expect(body.resumen.topSintomas).toEqual([]);
  });
});

describe('Cuestionario funcional — guardado de respuestas', () => {
  it('devuelve 422 si una respuesta corresponde a una pregunta inexistente', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const res = await PUT(req({ respuestas: { 'pregunta-que-no-existe': 2 } }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.detalles.respuestas).toBeDefined();
  });

  it('devuelve 422 si el valor de una respuesta está fuera de 0–4', async () => {
    const idReal = PREGUNTAS_SCREENING[0].id;
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const res = await PUT(req({ respuestas: { [idReal]: 5 } }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('devuelve 422 si el valor de una respuesta es negativo', async () => {
    const idReal = PREGUNTAS_SCREENING[0].id;
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const res = await PUT(req({ respuestas: { [idReal]: -1 } }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('guarda un cuestionario incompleto (algunas respuestas, completado:false) sin rechazarlo', async () => {
    const [p1, p2] = PREGUNTAS_SCREENING;
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, { data: { updated_at: '2026-03-01T00:00:00Z' }, error: null }]);
    const res = await PUT(req({ respuestas: { [p1.id]: 2, [p2.id]: 1 }, completado: false }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const historiasBuilder = from.mock.results[2].value;
    const [payload] = historiasBuilder.upsert.mock.calls[0];
    expect(payload.completado).toBe(false);
    expect(payload.respuestas).toEqual({ [p1.id]: 2, [p2.id]: 1 });
    expect(payload.version).toBeDefined();
  });

  it('calcula el puntaje y el porcentaje correctamente al guardar', async () => {
    const preguntasCardio = PREGUNTAS_SCREENING.filter(p => p.sistema === 'Cardiovascular');
    const respuestas: Record<string, number> = {};
    respuestas[preguntasCardio[0].id] = 4;
    respuestas[preguntasCardio[1].id] = 4;

    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, { data: { updated_at: '2026-03-01T00:00:00Z' }, error: null }]);
    const res = await PUT(req({ respuestas }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.puntajes['Cardiovascular'].puntos).toBe(8);
    expect(body.puntajes['Cardiovascular'].maximo).toBe(preguntasCardio.length * 4);
  });

  it('finaliza el cuestionario (completado:true) y persiste la versión', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, { data: { updated_at: '2026-03-02T00:00:00Z' }, error: null }]);
    const res = await PUT(req({ respuestas: {}, completado: true }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const historiasBuilder = from.mock.results[2].value;
    const [payload] = historiasBuilder.upsert.mock.calls[0];
    expect(payload.completado).toBe(true);
  });

  it('actualizar un cuestionario existente reutiliza el mismo upsert (no duplica filas)', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, { data: { updated_at: '2026-03-03T00:00:00Z' }, error: null }]);
    await PUT(req({ respuestas: { [PREGUNTAS_SCREENING[0].id]: 3 } }), paramsCon(ID_VALIDO));
    const historiasBuilder = from.mock.results[2].value;
    expect(historiasBuilder.upsert).toHaveBeenCalledTimes(1);
    const [, opciones] = historiasBuilder.upsert.mock.calls[0];
    expect(opciones).toEqual({ onConflict: 'tenant_id,paciente_id' });
  });
});

describe('Cuestionario funcional — aislamiento entre tenants', () => {
  it('no permite guardar respuestas en el cuestionario de un paciente de otro tenant', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await PUT(req({ respuestas: { [PREGUNTAS_SCREENING[0].id]: 2 } }), paramsCon(ID_OTRO_PACIENTE));
    expect(res.status).toBe(404);
    // nunca se llega a construir/enviar el upsert
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('la resolución de paciente siempre queda acotada al tenant_id resuelto del usuario autenticado', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, { data: null, error: null }]);
    await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    const pacientesBuilder = from.mock.results[1].value;
    expect(pacientesBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
  });
});
