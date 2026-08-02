import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';
import { PREGUNTAS_SCREENING } from '../../lib/clinica/cuestionario';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET, PUT } from '@/app/api/pacientes/[id]/diagnostico/route';

const USUARIO = { id: 'auth-1' };
const TENANT_ROW = { data: { tenant_id: 'tenant-1' }, error: null };
const SIN_TENANT_ROW = { data: { tenant_id: null }, error: null };
const PACIENTE_ROW = {
  data: {
    id: 'p1', sexo: 'femenino', antecedentes_personales: null,
    antecedentes_familiares: null, medicamentos_actuales: null, alergias: null,
  },
  error: null,
};
const SIN_DIAGNOSTICO = { data: null, error: null };
const SIN_HISTORIA = { data: null, error: null };
const SIN_BIOESCANER = { data: null, error: null };
const ID_VALIDO = '44444444-4444-4444-8444-444444444444';

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

function idsSistema(sistema: string) {
  return PREGUNTAS_SCREENING.filter(p => p.sistema === sistema).map(p => p.id);
}

const DATOS_MANUAL_VACIOS = { alteraciones: [], perpetuadores: [], deficits: [], impresion: '', estudios: '', confirmado: false };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/pacientes/[id]/diagnostico — seguridad', () => {
  it('devuelve 404 si el id no es un UUID válido, sin tocar la base', async () => {
    const from = usarMock(USUARIO, []);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon('no-uuid'));
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

  it('devuelve 404 si el paciente no existe', async () => {
    usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('devuelve 404 si el paciente es de otro tenant (aislamiento entre tenants)', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
    const pacientesBuilder = from.mock.results[1].value;
    expect(pacientesBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
  });

  it('devuelve 404 si el paciente está eliminado', async () => {
    usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/pacientes/[id]/diagnostico — cálculo', () => {
  it('sin datos disponibles, no sugiere ningún patrón pero muestra la advertencia', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_DIAGNOSTICO, SIN_HISTORIA, SIN_BIOESCANER]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.patrones).toEqual([]);
    expect(body.advertencia).toBe('Resultado de cribado funcional. No sustituye diagnóstico médico.');
  });

  it('calcula un patrón a partir del cuestionario', async () => {
    const respuestas = Object.fromEntries(idsSistema('Tiroides').map(id => [id, 4]));
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, SIN_DIAGNOSTICO,
      { data: { historia: {}, respuestas }, error: null },
      SIN_BIOESCANER,
    ]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    const body = await res.json();
    const tiroides = body.patrones.find((p: any) => p.codigo === 'tiroides-funcional');
    expect(tiroides).toBeDefined();
    expect(tiroides.puntaje).toBe(100);
  });

  it('calcula un patrón a partir de la historia clínica', async () => {
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, SIN_DIAGNOSTICO,
      { data: { historia: { dolorToracico: true }, respuestas: {} }, error: null },
      SIN_BIOESCANER,
    ]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    const body = await res.json();
    const cardio = body.patrones.find((p: any) => p.codigo === 'riesgo-cardiovascular');
    expect(cardio).toBeDefined();
    expect(cardio.evidencias.some((e: any) => e.fuente === 'historia')).toBe(true);
  });

  it('combina cuestionario, historia y bioescáner en el mismo cálculo', async () => {
    const respuestas = Object.fromEntries(idsSistema('Intestinal').map(id => [id, 3]));
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, SIN_DIAGNOSTICO,
      { data: { historia: { bristol: 7 }, respuestas }, error: null },
      { data: { hallazgos: [{ id: '1', parametro: 'Disbiosis intestinal', valor: '', severidad: 'alto' }] }, error: null },
    ]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    const body = await res.json();
    const intestinal = body.patrones.find((p: any) => p.codigo === 'intestinal');
    expect(intestinal.evidencias.map((e: any) => e.fuente).sort()).toEqual(['bioescaner', 'cuestionario', 'historia']);
  });

  it('devuelve los patrones ordenados de mayor a menor prioridad (puntaje)', async () => {
    const respuestasTiroides = Object.fromEntries(idsSistema('Tiroides').map(id => [id, 1]));
    const respuestasCardio = Object.fromEntries(idsSistema('Cardiovascular').map(id => [id, 4]));
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, SIN_DIAGNOSTICO,
      { data: { historia: {}, respuestas: { ...respuestasTiroides, ...respuestasCardio } }, error: null },
      SIN_BIOESCANER,
    ]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    const body = await res.json();
    const puntajes = body.patrones.map((p: any) => p.puntaje);
    expect(puntajes).toEqual([...puntajes].sort((a, b) => b - a));
    expect(body.patrones[0].codigo).toBe('riesgo-cardiovascular');
  });
});

describe('PUT /api/pacientes/[id]/diagnostico — seguridad y validación', () => {
  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await PUT(req(DATOS_MANUAL_VACIOS), paramsCon(ID_VALIDO));
    expect(res.status).toBe(401);
  });

  it('devuelve 422 si el body no es JSON válido', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const badReq = new NextRequest('http://localhost/x', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{ mal',
    });
    const res = await PUT(badReq, paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('devuelve 422 con un código de patrón inexistente en decisionesPatrones', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const res = await PUT(
      req({ ...DATOS_MANUAL_VACIOS, decisionesPatrones: [{ codigo: 'no-existe', estado: 'confirmado' }] }),
      paramsCon(ID_VALIDO)
    );
    expect(res.status).toBe(422);
  });

  it('devuelve 404 si el paciente es de otro tenant', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await PUT(req(DATOS_MANUAL_VACIOS), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
    expect(from).toHaveBeenCalledTimes(2);
  });
});

describe('PUT /api/pacientes/[id]/diagnostico — decisiones médicas', () => {
  it('confirma un patrón sugerido y lo persiste en el upsert', async () => {
    const respuestas = Object.fromEntries(idsSistema('Tiroides').map(id => [id, 4]));
    const from = usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW,
      SIN_DIAGNOSTICO, // previo (select patrones)
      { data: { historia: {}, respuestas }, error: null }, // historia
      SIN_BIOESCANER,
      { error: null }, // upsert final
    ]);
    const res = await PUT(
      req({ ...DATOS_MANUAL_VACIOS, decisionesPatrones: [{ codigo: 'tiroides-funcional', estado: 'confirmado' }] }),
      paramsCon(ID_VALIDO)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const tiroides = body.patrones.find((p: any) => p.codigo === 'tiroides-funcional');
    expect(tiroides.estado).toBe('confirmado');

    const diagnosticoBuilder = from.mock.results[5].value;
    const [payload] = diagnosticoBuilder.upsert.mock.calls[0];
    expect(payload.patrones.find((p: any) => p.codigo === 'tiroides-funcional').estado).toBe('confirmado');
  });

  it('descarta un patrón sugerido', async () => {
    const respuestas = Object.fromEntries(idsSistema('Tiroides').map(id => [id, 4]));
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, SIN_DIAGNOSTICO,
      { data: { historia: {}, respuestas }, error: null }, SIN_BIOESCANER,
      { error: null },
    ]);
    const res = await PUT(
      req({ ...DATOS_MANUAL_VACIOS, decisionesPatrones: [{ codigo: 'tiroides-funcional', estado: 'descartado', observacionesMedico: 'Ya en tratamiento previo.' }] }),
      paramsCon(ID_VALIDO)
    );
    const body = await res.json();
    const tiroides = body.patrones.find((p: any) => p.codigo === 'tiroides-funcional');
    expect(tiroides.estado).toBe('descartado');
    expect(tiroides.observacionesMedico).toBe('Ya en tratamiento previo.');
  });

  it('conserva una confirmación previa y sus observaciones aunque el nuevo guardado no la mencione', async () => {
    const previoConfirmado = {
      codigo: 'tiroides-funcional', nombre: 'Alteración tiroidea funcional', descripcion: 'x',
      puntaje: 75, nivel: 'alta', prioridad: 'alta', evidencias: [], fechaCalculo: '2026-01-01T00:00:00Z',
      version: 1, estado: 'confirmado', observacionesMedico: 'Derivar a endocrinología.',
    };
    // esta vez el cuestionario ya no tiene respuestas para Tiroides (la evidencia fresca cae),
    // pero la confirmación médica previa debe conservarse igual.
    const from = usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW,
      { data: { patrones: [previoConfirmado] }, error: null }, // previo
      SIN_HISTORIA, SIN_BIOESCANER,
      { error: null },
    ]);
    const res = await PUT(req({ ...DATOS_MANUAL_VACIOS, decisionesPatrones: [] }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    const tiroides = body.patrones.find((p: any) => p.codigo === 'tiroides-funcional');
    expect(tiroides).toBeDefined();
    expect(tiroides.estado).toBe('confirmado');
    expect(tiroides.observacionesMedico).toBe('Derivar a endocrinología.');

    const diagnosticoBuilder = from.mock.results[5].value;
    const [payload] = diagnosticoBuilder.upsert.mock.calls[0];
    expect(payload.patrones.find((p: any) => p.codigo === 'tiroides-funcional').estado).toBe('confirmado');
  });

  it('el motor nunca marca un patrón como confirmado por sí solo: nace en "sugerido"', async () => {
    const respuestas = Object.fromEntries(idsSistema('Tiroides').map(id => [id, 4]));
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, SIN_DIAGNOSTICO,
      { data: { historia: {}, respuestas }, error: null }, SIN_BIOESCANER,
      { error: null },
    ]);
    // no se manda ninguna decisión: el patrón recién calculado debe quedar "sugerido"
    const res = await PUT(req(DATOS_MANUAL_VACIOS), paramsCon(ID_VALIDO));
    const body = await res.json();
    const tiroides = body.patrones.find((p: any) => p.codigo === 'tiroides-funcional');
    expect(tiroides.estado).toBe('sugerido');
  });
});

describe('PUT /api/pacientes/[id]/diagnostico — persistencia', () => {
  it('actualiza mediante upsert sin duplicar (mismo onConflict de siempre)', async () => {
    const from = usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, SIN_DIAGNOSTICO, SIN_HISTORIA, SIN_BIOESCANER, { error: null },
    ]);
    await PUT(req(DATOS_MANUAL_VACIOS), paramsCon(ID_VALIDO));
    const diagnosticoBuilder = from.mock.results[5].value;
    expect(diagnosticoBuilder.upsert).toHaveBeenCalledTimes(1);
    const [, opciones] = diagnosticoBuilder.upsert.mock.calls[0];
    expect(opciones).toEqual({ onConflict: 'tenant_id,paciente_id' });
  });

  it('conserva la cascada de alteraciones manual (compatibilidad con IPT/Fase)', async () => {
    const from = usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, SIN_DIAGNOSTICO, SIN_HISTORIA, SIN_BIOESCANER, { error: null },
    ]);
    const alteracion = { id: 'a1', nombre: 'Disbiosis', nivel: 'primaria', dominio: 'Digestivo', justificacion: 'x' };
    await PUT(req({ ...DATOS_MANUAL_VACIOS, alteraciones: [alteracion] }), paramsCon(ID_VALIDO));
    const diagnosticoBuilder = from.mock.results[5].value;
    const [payload] = diagnosticoBuilder.upsert.mock.calls[0];
    expect(payload.alteraciones).toEqual([alteracion]);
  });
});

describe('advertencia de cribado', () => {
  it('la respuesta de GET y de PUT siempre incluyen la advertencia', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_DIAGNOSTICO, SIN_HISTORIA, SIN_BIOESCANER]);
    const getRes = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    const getBody = await getRes.json();
    expect(getBody.advertencia).toMatch(/no sustituye diagnóstico médico/i);

    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_DIAGNOSTICO, SIN_HISTORIA, SIN_BIOESCANER, { error: null }]);
    const putRes = await PUT(req(DATOS_MANUAL_VACIOS), paramsCon(ID_VALIDO));
    const putBody = await putRes.json();
    expect(putBody.advertencia).toMatch(/no sustituye diagnóstico médico/i);
  });
});
