import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET, PUT } from '@/app/api/pacientes/[id]/nutricion/route';

const USUARIO = { id: 'auth-1' };
const TENANT_ROW = { data: { tenant_id: 'tenant-1' }, error: null };
const SIN_TENANT_ROW = { data: { tenant_id: null }, error: null };
const PACIENTE_ROW = {
  data: {
    id: 'p1', sexo: 'femenino', fecha_nacimiento: '1990-01-01',
    alergias: null, medicamentos_actuales: null, antecedentes_personales: null, antecedentes_familiares: null,
  },
  error: null,
};
const FASE_CONFIRMADA = { data: { fase_seleccionada: 'restore', confirmado: true }, error: null };
const FASE_NO_CONFIRMADA = { data: { fase_seleccionada: 'restore', confirmado: false }, error: null };
const SIN_PLAN = { data: null, error: null };
const SIN_FORMULA = { data: null, error: null };
const SIN_HISTORIA = { data: null, error: null };
const ID_VALIDO = '77777777-7777-4777-8777-777777777777';

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

const PLAN_BASE = {
  numeroComidas: 4, menuDiario: [], menuSemanal: {}, alimentosRecomendados: [], alimentosALimitar: [],
  alimentosAEvitar: [], listaCompras: [], observaciones: '', duracionDias: 30,
};
const RESTRICCIONES_BASE = { alergiasAlimentarias: [], celiaquia: false, vegetarianismo: false, veganismo: false };

function datosBase(overrides: Record<string, unknown> = {}) {
  return {
    objetivoClinico: 'mantenimiento', pesoKg: 70, tallaCm: 170, nivelActividad: 'moderado',
    restricciones: RESTRICCIONES_BASE, plan: PLAN_BASE,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/pacientes/[id]/nutricion — seguridad', () => {
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

  it('devuelve 403 si el usuario no tiene tenant asignado', async () => {
    usarMock(USUARIO, [SIN_TENANT_ROW]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(403);
  });

  it('devuelve 404 si el paciente no existe', async () => {
    usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('devuelve 404 si el paciente es de otro tenant (aislamiento entre tenants)', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
    const pacientesBuilder = from.mock.results[1].value;
    expect(pacientesBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
  });

  it('devuelve 404 si el paciente está eliminado', async () => {
    usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('devuelve 409 si la fase terapéutica no está confirmada', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_NO_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(409);
  });
});

describe('GET /api/pacientes/[id]/nutricion — cálculos', () => {
  it('calcula IMC, energía y macros por defecto cuando no hay plan guardado', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.calculos.imc).toBeGreaterThan(0);
    expect(body.calculos.gebKcal).toBeGreaterThan(0);
    expect(body.calculos.objetivoCaloricoKcal).toBeGreaterThan(0);
    expect(body.calculos.proteinaG).toBeGreaterThan(0);
    expect(body.estado).toBe('borrador');
  });

  it('expone el catálogo de alimentos locales', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.catalogoAlimentos.some((a: any) => a.codigo === 'mandioca')).toBe(true);
    expect(body.catalogoAlimentos.length).toBeGreaterThanOrEqual(20);
  });

  it('expone los ingredientes de la formulación aprobada para integración', async () => {
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN,
      { data: { firmada: true, estado: 'aprobada', ingredientes: [{ nombre: 'Magnesio' }] }, error: null },
      SIN_HISTORIA,
    ]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.contextoFormulacion.ingredientesAprobados).toEqual(['Magnesio']);
    expect(body.tieneFormula).toBe(true);
  });
});

describe('PUT /api/pacientes/[id]/nutricion — seguridad y validación', () => {
  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await PUT(putReq(datosBase()), paramsCon(ID_VALIDO));
    expect(res.status).toBe(401);
  });

  it('devuelve 422 si el body no es JSON válido', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const badReq = new NextRequest('http://localhost/x', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{ mal' });
    const res = await PUT(badReq, paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('devuelve 422 con un objetivo clínico inexistente', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const res = await PUT(putReq(datosBase({ objetivoClinico: 'objetivo-inventado' })), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('devuelve 409 si la fase terapéutica no está confirmada', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_NO_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA]);
    const res = await PUT(putReq(datosBase()), paramsCon(ID_VALIDO));
    expect(res.status).toBe(409);
  });

  it('devuelve 404 si el paciente es de otro tenant', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, { data: null, error: null }]);
    const res = await PUT(putReq(datosBase()), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
    expect(from).toHaveBeenCalledTimes(2);
  });
});

describe('PUT /api/pacientes/[id]/nutricion — borrador, aprobación y persistencia', () => {
  it('crea un borrador (sin estado explícito, queda en borrador)', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA, { error: null }]);
    const res = await PUT(putReq(datosBase()), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.estado).toBe('borrador');

    const planBuilder = from.mock.results[6].value;
    const [payload] = planBuilder.upsert.mock.calls[0];
    expect(payload.estado).toBe('borrador');
    expect(payload.confirmado).toBe(false);
  });

  it('ningún plan queda aprobado automáticamente', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA, { error: null }]);
    const res = await PUT(putReq(datosBase({ estado: undefined })), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.estado).not.toBe('aprobado');
  });

  it('aprueba el plan cuando el profesional lo indica explícitamente, registrando quién y cuándo', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA, { error: null }]);
    const res = await PUT(putReq(datosBase({ estado: 'aprobado' })), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.estado).toBe('aprobado');

    const planBuilder = from.mock.results[6].value;
    const [payload] = planBuilder.upsert.mock.calls[0];
    expect(payload.aprobado_por).toBe(USUARIO.id);
    expect(payload.aprobado_en).not.toBeNull();
    expect(payload.confirmado).toBe(true);
  });

  it('actualiza mediante upsert sin duplicar', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA, { error: null }]);
    await PUT(putReq(datosBase()), paramsCon(ID_VALIDO));
    const planBuilder = from.mock.results[6].value;
    expect(planBuilder.upsert).toHaveBeenCalledTimes(1);
    const [, opciones] = planBuilder.upsert.mock.calls[0];
    expect(opciones).toEqual({ onConflict: 'tenant_id,paciente_id' });
  });

  it('permite al profesional sobrescribir cualquier valor calculado', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA, { error: null }]);
    const res = await PUT(putReq(datosBase({ calculosOverride: { objetivoCaloricoKcal: 1800, proteinaG: 120 } })), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.calculos.objetivoCaloricoKcal).toBe(1800);
    expect(body.calculos.proteinaG).toBe(120);
  });
});

describe('PUT /api/pacientes/[id]/nutricion — cálculos, restricciones y advertencias', () => {
  it('calcula IMC y energía a partir del peso/talla/actividad enviados', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA, { error: null }]);
    const res = await PUT(putReq(datosBase({ pesoKg: 80, tallaCm: 180 })), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.calculos.imc).toBeCloseTo(80 / 1.8 ** 2, 1);
  });

  it('distribuye macronutrientes según el objetivo clínico', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA, { error: null }]);
    const res = await PUT(putReq(datosBase({ objetivoClinico: 'ganancia-masa-muscular' })), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.calculos.proteinaG).toBeGreaterThan(0);
    expect(body.calculos.carbohidratosG).toBeGreaterThan(0);
    expect(body.calculos.grasasG).toBeGreaterThan(0);
  });

  it('advierte por restricción de alergia alimentaria declarada', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA, { error: null }]);
    const res = await PUT(putReq(datosBase({ restricciones: { ...RESTRICCIONES_BASE, alergiasAlimentarias: ['mani'] } })), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.advertencias.some((a: any) => a.fuente === 'restriccion' && a.descripcion.includes('Maní'))).toBe(true);
  });

  it('advierte por objetivo diabetes tipo 2', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA, { error: null }]);
    const res = await PUT(putReq(datosBase({ objetivoClinico: 'diabetes-tipo-2' })), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.advertencias.some((a: any) => a.codigo === 'objetivo-diabetes-tipo-2')).toBe(true);
  });

  it('advierte por objetivo hipertensión', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA, { error: null }]);
    const res = await PUT(putReq(datosBase({ objetivoClinico: 'hipertension' })), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.advertencias.some((a: any) => a.codigo === 'objetivo-hipertension')).toBe(true);
  });

  it('integración con formulación: advierte si un alimento recomendado duplica un ingrediente ya aprobado', async () => {
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN,
      { data: { firmada: true, estado: 'aprobada', ingredientes: [{ nombre: 'Magnesio' }] }, error: null },
      SIN_HISTORIA,
      { error: null },
    ]);
    const res = await PUT(
      putReq(datosBase({ plan: { ...PLAN_BASE, alimentosRecomendados: ['Magnesio', 'Verduras locales'] } })),
      paramsCon(ID_VALIDO)
    );
    const body = await res.json();
    expect(body.advertencias.some((a: any) => a.fuente === 'formulacion')).toBe(true);
  });

  it('nunca modifica la formulación desde nutrición (no se llama upsert sobre formulaciones_terapeuticas)', async () => {
    const from = usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN,
      { data: { firmada: true, estado: 'aprobada', ingredientes: [{ nombre: 'Magnesio' }] }, error: null },
      SIN_HISTORIA,
      { error: null },
    ]);
    await PUT(putReq(datosBase()), paramsCon(ID_VALIDO));
    const llamadasFormulacion = from.mock.calls.filter(([tabla]: [string]) => tabla === 'formulaciones_terapeuticas');
    expect(llamadasFormulacion).toHaveLength(1); // sólo la lectura, ningún upsert adicional
    const formulaBuilder = from.mock.results[4].value;
    expect(formulaBuilder.upsert).not.toHaveBeenCalled();
  });

  it('guarda la lista de compras y el menú semanal tal como los envía el profesional', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA, { error: null }]);
    const menuSemanal = { lunes: [{ horario: 'desayuno', descripcion: 'Avena con fruta', alternativas: [] }] };
    await PUT(putReq(datosBase({
      plan: { ...PLAN_BASE, listaCompras: ['Avena', 'Huevo'], menuSemanal },
    })), paramsCon(ID_VALIDO));
    const planBuilder = from.mock.results[6].value;
    const [payload] = planBuilder.upsert.mock.calls[0];
    expect(payload.plan.listaCompras).toEqual(['Avena', 'Huevo']);
    expect(payload.plan.menuSemanal).toEqual(menuSemanal);
  });
});

describe('advertencia visible', () => {
  it('la respuesta de GET y PUT siempre incluyen la advertencia de apoyo profesional', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA]);
    const getRes = await GET(getReq(), paramsCon(ID_VALIDO));
    expect((await getRes.json()).advertencia).toMatch(/no reemplaza la evaluación de un profesional/i);

    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, FASE_CONFIRMADA, SIN_PLAN, SIN_FORMULA, SIN_HISTORIA, { error: null }]);
    const putRes = await PUT(putReq(datosBase()), paramsCon(ID_VALIDO));
    expect((await putRes.json()).advertencia).toMatch(/no reemplaza la evaluación de un profesional/i);
  });
});
