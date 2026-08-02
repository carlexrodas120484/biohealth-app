import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET, PUT } from '@/app/api/pacientes/[id]/plan-terapeutico/route';

const USUARIO = { id: 'auth-1' };
const TENANT_ROW = { data: { tenant_id: 'tenant-1' }, error: null };
const SIN_TENANT_ROW = { data: { tenant_id: null }, error: null };
const PACIENTE_ROW = {
  data: { id: 'p1', antecedentes_personales: null, antecedentes_familiares: null, medicamentos_actuales: null, alergias: null },
  error: null,
};
const SIN_PLAN = { data: null, error: null };
const SIN_DIAGNOSTICO = { data: null, error: null };
const SIN_HISTORIA = { data: null, error: null };
const ID_VALIDO = '55555555-5555-4555-8555-555555555555';

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
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

function diagnosticoCon(patrones: any[]) {
  return { data: { patrones }, error: null };
}

const PATRON_TIROIDES_CONFIRMADO = {
  codigo: 'tiroides-funcional', nombre: 'x', descripcion: 'x', puntaje: 80, nivel: 'muy_alta',
  prioridad: 'urgente', evidencias: [], fechaCalculo: '2026-01-01T00:00:00Z', version: 1,
  estado: 'confirmado', observacionesMedico: '',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/pacientes/[id]/plan-terapeutico — seguridad', () => {
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

describe('GET /api/pacientes/[id]/plan-terapeutico — cálculo', () => {
  it('sin datos disponibles, no sugiere ninguna fase pero muestra la advertencia', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_PLAN, SIN_DIAGNOSTICO, SIN_HISTORIA]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fases).toEqual([]);
    expect(body.advertencia).toMatch(/apoyo clínico/i);
  });

  it('sugiere una fase a partir de un patrón funcional confirmado en diagnóstico', async () => {
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, SIN_PLAN,
      diagnosticoCon([PATRON_TIROIDES_CONFIRMADO]),
      SIN_HISTORIA,
    ]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.fases.find((f: any) => f.codigo === 'metabolico-hormonal')).toBeDefined();
  });

  it('ignora patrones sólo sugeridos (no confirmados) al calcular el plan', async () => {
    const sugerido = { ...PATRON_TIROIDES_CONFIRMADO, estado: 'sugerido' };
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_PLAN, diagnosticoCon([sugerido]), SIN_HISTORIA]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.fases).toEqual([]);
  });

  it('devuelve las fases ordenadas de mayor a menor prioridad', async () => {
    const leve = { ...PATRON_TIROIDES_CONFIRMADO, codigo: 'hormonal', puntaje: 25, nivel: 'leve' };
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, SIN_PLAN,
      diagnosticoCon([leve, { ...PATRON_TIROIDES_CONFIRMADO, codigo: 'digestivo-alto' }]),
      SIN_HISTORIA,
    ]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.fases[0].codigo).toBe('digestivo-intestinal'); // el confirmado muy_alta va primero
    expect(body.fases[0].orden).toBe(1);
  });

  it('ninguna fase llega activada automáticamente: todas nacen "sugerida"', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_PLAN, diagnosticoCon([PATRON_TIROIDES_CONFIRMADO]), SIN_HISTORIA]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.fases.every((f: any) => f.estado === 'sugerida')).toBe(true);
  });

  it('bandera de seguridad por alergia registrada', async () => {
    usarMock(USUARIO, [
      TENANT_ROW,
      { data: { ...PACIENTE_ROW.data, alergias: 'Penicilina' }, error: null },
      SIN_PLAN, SIN_DIAGNOSTICO, SIN_HISTORIA,
    ]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.banderasSeguridad.some((b: any) => b.fuente === 'alergias')).toBe(true);
  });

  it('bandera de seguridad por medicación actual registrada', async () => {
    usarMock(USUARIO, [
      TENANT_ROW,
      { data: { ...PACIENTE_ROW.data, medicamentos_actuales: 'Warfarina' }, error: null },
      SIN_PLAN, SIN_DIAGNOSTICO, SIN_HISTORIA,
    ]);
    const res = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.banderasSeguridad.some((b: any) => b.fuente === 'medicacion')).toBe(true);
  });
});

describe('PUT /api/pacientes/[id]/plan-terapeutico — seguridad y validación', () => {
  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await PUT(req({ decisionesFases: [] }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(401);
  });

  it('devuelve 422 si el body no es JSON válido', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const badReq = new NextRequest('http://localhost/x', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{ mal' });
    const res = await PUT(badReq, paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('devuelve 422 con un código de fase que no existe en el catálogo', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const res = await PUT(req({ decisionesFases: [{ codigo: 'fase-inventada', estado: 'activa' }] }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('devuelve 404 si el paciente es de otro tenant', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await PUT(req({ decisionesFases: [] }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
    expect(from).toHaveBeenCalledTimes(2);
  });
});

describe('PUT /api/pacientes/[id]/plan-terapeutico — flujo médico', () => {
  it('aprueba (activa) una fase sugerida', async () => {
    const from = usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, SIN_PLAN, diagnosticoCon([PATRON_TIROIDES_CONFIRMADO]), SIN_HISTORIA,
      { error: null },
    ]);
    const res = await PUT(req({ decisionesFases: [{ codigo: 'metabolico-hormonal', estado: 'activa' }] }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fases.find((f: any) => f.codigo === 'metabolico-hormonal').estado).toBe('activa');

    const planBuilder = from.mock.results[5].value;
    const [payload] = planBuilder.upsert.mock.calls[0];
    expect(payload.fases.find((f: any) => f.codigo === 'metabolico-hormonal').estado).toBe('activa');
  });

  it('rechaza (descarta) una fase sugerida', async () => {
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, SIN_PLAN, diagnosticoCon([PATRON_TIROIDES_CONFIRMADO]), SIN_HISTORIA,
      { error: null },
    ]);
    const res = await PUT(
      req({ decisionesFases: [{ codigo: 'metabolico-hormonal', estado: 'descartada', observacionesMedico: 'No aplica por ahora.' }] }),
      paramsCon(ID_VALIDO)
    );
    const body = await res.json();
    const fase = body.fases.find((f: any) => f.codigo === 'metabolico-hormonal');
    expect(fase.estado).toBe('descartada');
    expect(fase.observacionesMedico).toBe('No aplica por ahora.');
  });

  it('reordena las fases mediante el campo orden', async () => {
    const otroPatron = { ...PATRON_TIROIDES_CONFIRMADO, codigo: 'digestivo-alto' };
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, SIN_PLAN,
      diagnosticoCon([PATRON_TIROIDES_CONFIRMADO, otroPatron]),
      SIN_HISTORIA,
      { error: null },
    ]);
    const res = await PUT(
      req({ decisionesFases: [{ codigo: 'metabolico-hormonal', orden: 1 }, { codigo: 'digestivo-intestinal', orden: 2 }] }),
      paramsCon(ID_VALIDO)
    );
    const body = await res.json();
    expect(body.fases[0].codigo).toBe('metabolico-hormonal');
    expect(body.fases[0].orden).toBe(1);
    expect(body.fases[1].codigo).toBe('digestivo-intestinal');
  });

  it('agrega manualmente una fase que el motor no sugirió (sin evidencia)', async () => {
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, SIN_PLAN, SIN_DIAGNOSTICO, SIN_HISTORIA,
      { error: null },
    ]);
    const res = await PUT(req({ decisionesFases: [{ codigo: 'reparacion-mantenimiento', estado: 'activa' }] }), paramsCon(ID_VALIDO));
    const body = await res.json();
    const fase = body.fases.find((f: any) => f.codigo === 'reparacion-mantenimiento');
    expect(fase).toBeDefined();
    expect(fase.estado).toBe('activa');
    expect(fase.evidencias).toEqual([]);
  });

  it('conserva una fase activa y sus observaciones aunque la evidencia recalculada ya no la sustente', async () => {
    const previoActivo = {
      codigo: 'metabolico-hormonal', nombre: 'Metabólico y hormonal', objetivo: 'x', prioridad: 'alta',
      duracionEstimadaSemanas: 8, criteriosInicio: [], criteriosAvance: [], criteriosPausa: [], riesgos: [],
      evidencias: ['Patrón confirmado: tiroides-funcional (80%)'], observacionesMedico: 'Iniciada con endocrinología.',
      estado: 'activa', orden: 1, fechaCalculo: '2026-01-01T00:00:00Z', version: 1,
    };
    const from = usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW,
      { data: { fases: [previoActivo] }, error: null }, // ya no hay patrones confirmados que la sustenten
      SIN_DIAGNOSTICO, SIN_HISTORIA,
      { error: null },
    ]);
    const res = await PUT(req({ decisionesFases: [] }), paramsCon(ID_VALIDO));
    const body = await res.json();
    const fase = body.fases.find((f: any) => f.codigo === 'metabolico-hormonal');
    expect(fase.estado).toBe('activa');
    expect(fase.observacionesMedico).toBe('Iniciada con endocrinología.');

    const planBuilder = from.mock.results[5].value;
    const [payload] = planBuilder.upsert.mock.calls[0];
    expect(payload.fases.find((f: any) => f.codigo === 'metabolico-hormonal').estado).toBe('activa');
  });

  it('actualiza mediante upsert sin duplicar', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_PLAN, SIN_DIAGNOSTICO, SIN_HISTORIA, { error: null }]);
    await PUT(req({ decisionesFases: [] }), paramsCon(ID_VALIDO));
    const planBuilder = from.mock.results[5].value;
    expect(planBuilder.upsert).toHaveBeenCalledTimes(1);
    const [, opciones] = planBuilder.upsert.mock.calls[0];
    expect(opciones).toEqual({ onConflict: 'tenant_id,paciente_id' });
  });
});

describe('advertencia visible', () => {
  it('la respuesta de GET y PUT siempre incluyen la advertencia de apoyo clínico', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_PLAN, SIN_DIAGNOSTICO, SIN_HISTORIA]);
    const getRes = await GET(new NextRequest('http://localhost/x'), paramsCon(ID_VALIDO));
    expect((await getRes.json()).advertencia).toMatch(/se activa automáticamente/i);

    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_PLAN, SIN_DIAGNOSTICO, SIN_HISTORIA, { error: null }]);
    const putRes = await PUT(req({ decisionesFases: [] }), paramsCon(ID_VALIDO));
    expect((await putRes.json()).advertencia).toMatch(/se activa automáticamente/i);
  });
});
