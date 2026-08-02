import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET, PUT } from '@/app/api/pacientes/[id]/formulacion/route';

const USUARIO = { id: 'auth-1', email: 'medico@test.com' };
const TENANT_ROW = { data: { tenant_id: 'tenant-1' }, error: null };
const SIN_TENANT_ROW = { data: { tenant_id: null }, error: null };
const PACIENTE_ROW = {
  data: { id: 'p1', medicamentos_actuales: null, alergias: null, antecedentes_personales: null, antecedentes_familiares: null },
  error: null,
};
const OBJETIVOS_CONFIRMADOS = { data: { fase: 'restore', objetivos: ['Disminuir inflamación'], confirmado: true }, error: null };
const SIN_FORMULA = { data: null, error: null };
const SIN_CATALOGO = { data: [], error: null };
const SIN_PLAN = { data: null, error: null };
const ID_VALIDO = '66666666-6666-4666-8666-666666666666';

function usarMock(user: { id: string; email?: string } | null, queue: any[], opciones?: { signInWithPasswordError?: unknown }) {
  const { client, from } = crearSupabaseMock(user, queue, opciones);
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client);
  return from;
}

function paramsCon(id: string) {
  return { params: Promise.resolve({ id }) };
}

function getReq(qs = '') {
  return new NextRequest(`http://localhost/x${qs}`);
}

function putReq(body: unknown) {
  return new NextRequest('http://localhost/x', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

const ITEM_BASE = { id: 'i1', nombre: 'Omega-3', dosis: '1000mg', indicacion: 'Con la cena', observaciones: '' };
const REVISION_BASE = {
  pesoKg: '70', embarazoLactancia: 'no-aplica', funcionRenal: '', funcionHepatica: '', laboratorios: '', diagnosticoConfirmado: false,
};

function datosBase(overrides: Record<string, unknown> = {}) {
  return {
    items: [ITEM_BASE], revisionClinica: REVISION_BASE, seguridadRevisada: false, firmar: false, password: '',
    ...overrides,
  };
}

function catalogoCon(filas: any[]) {
  return { data: filas, error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/pacientes/[id]/formulacion — seguridad', () => {
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
});

describe('PUT /api/pacientes/[id]/formulacion — seguridad y validación', () => {
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

  it('devuelve 409 si los objetivos terapéuticos no están confirmados', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, { data: { fase: 'restore', objetivos: [], confirmado: false }, error: null }]);
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

describe('PUT /api/pacientes/[id]/formulacion — borrador y aprobación', () => {
  it('crea un borrador sin firmar (estado permanece en borrador)', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, OBJETIVOS_CONFIRMADOS, SIN_CATALOGO, { error: null }]);
    const res = await PUT(putReq(datosBase()), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.estado).toBe('borrador');
    expect(body.firmadaEn).toBeNull();

    const formulaBuilder = from.mock.results[4].value;
    const [payload] = formulaBuilder.upsert.mock.calls[0];
    expect(payload.firmada).toBe(false);
    expect(payload.estado).toBe('borrador');
  });

  it('ninguna fórmula queda aprobada automáticamente: sin firmar, el estado nunca es "aprobada"', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, OBJETIVOS_CONFIRMADOS, SIN_CATALOGO, { error: null }]);
    const res = await PUT(putReq(datosBase({ estado: undefined })), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.estado).not.toBe('aprobada');
  });

  it('rechaza estado "aprobada" si no se firma en la misma solicitud', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, OBJETIVOS_CONFIRMADOS]);
    const res = await PUT(putReq(datosBase({ estado: 'aprobada', firmar: false })), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('aprueba (firma) la fórmula con contraseña correcta', async () => {
    const from = usarMock(
      USUARIO,
      [TENANT_ROW, PACIENTE_ROW, OBJETIVOS_CONFIRMADOS, SIN_CATALOGO, { error: null }],
    );
    const res = await PUT(
      putReq(datosBase({
        estado: 'aprobada', firmar: true, seguridadRevisada: true, password: 'clave-correcta',
        revisionClinica: { ...REVISION_BASE, diagnosticoConfirmado: true },
      })),
      paramsCon(ID_VALIDO)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.estado).toBe('aprobada');
    expect(body.firmadaEn).not.toBeNull();

    const formulaBuilder = from.mock.results[4].value;
    const [payload] = formulaBuilder.upsert.mock.calls[0];
    expect(payload.firmada).toBe(true);
    expect(payload.firmada_por).toBe(USUARIO.id);
  });

  it('devuelve 401 si la contraseña de firma es incorrecta', async () => {
    usarMock(
      USUARIO,
      [TENANT_ROW, PACIENTE_ROW, OBJETIVOS_CONFIRMADOS],
      { signInWithPasswordError: { message: 'Invalid login credentials' } }
    );
    const res = await PUT(
      putReq(datosBase({
        estado: 'aprobada', firmar: true, seguridadRevisada: true, password: 'clave-mala',
        revisionClinica: { ...REVISION_BASE, diagnosticoConfirmado: true },
      })),
      paramsCon(ID_VALIDO)
    );
    expect(res.status).toBe(401);
  });

  it('actualiza mediante upsert sin duplicar', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, OBJETIVOS_CONFIRMADOS, SIN_CATALOGO, { error: null }]);
    await PUT(putReq(datosBase()), paramsCon(ID_VALIDO));
    const formulaBuilder = from.mock.results[4].value;
    expect(formulaBuilder.upsert).toHaveBeenCalledTimes(1);
    const [, opciones] = formulaBuilder.upsert.mock.calls[0];
    expect(opciones).toEqual({ onConflict: 'tenant_id,paciente_id' });
  });
});

describe('PUT /api/pacientes/[id]/formulacion — motor de reglas', () => {
  const ingredientesBase = [
    { id: 'ing-1', nombre: 'Magnesio', dosisPorTomaMg: 2500, vecesPorDia: 2, horario: 'cena' },
  ];

  it('calcula el número de cápsulas por toma y la carga total (regla 1-2-12)', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, OBJETIVOS_CONFIRMADOS, SIN_CATALOGO, { error: null }]);
    const res = await PUT(putReq(datosBase({ ingredientes: ingredientesBase })), paramsCon(ID_VALIDO));
    const body = await res.json();
    const prep = body.preparaciones[0];
    // sin catálogo, capacidad por defecto 1000mg: 2500/1000 -> 3 cápsulas
    expect(prep.ingredientes[0].capsulasPorToma).toBe(3);
    expect(prep.cargaTotalMg).toBe(2500);
  });

  it('sugiere sobre cuando la toma supera 2 cápsulas (regla 3)', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, OBJETIVOS_CONFIRMADOS, SIN_CATALOGO, { error: null }]);
    const res = await PUT(putReq(datosBase({ ingredientes: ingredientesBase })), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.preparaciones[0].ingredientes[0].presentacionSugerida).toBe('sobre');
  });

  it('no cambia a sobre automáticamente cuando el catálogo marca el principio muy amargo (regla 4)', async () => {
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, OBJETIVOS_CONFIRMADOS,
      catalogoCon([{ nombre: 'Magnesio', sinonimos: [], capacidad_capsula_mg: 500, amargor: 4, soluble_en_agua: true, presentacion_preferida: 'individualizar', incompatibilidades: [], dosis_referencia_max: null, limite_superior_referencia: null }]),
      { error: null },
    ]);
    const res = await PUT(putReq(datosBase({ ingredientes: ingredientesBase })), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.preparaciones[0].ingredientes[0].presentacionSugerida).toBe('capsula');
    expect(body.preparaciones[0].requiereEnmascararSabor).toBe(true);
  });

  it('agrupa por horario (regla 6)', async () => {
    const ingredientes = [
      { id: 'a', nombre: 'A', dosisPorTomaMg: 100, vecesPorDia: 1, horario: 'ayunas' },
      { id: 'b', nombre: 'B', dosisPorTomaMg: 100, vecesPorDia: 1, horario: 'antes_de_dormir' },
    ];
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, OBJETIVOS_CONFIRMADOS, SIN_CATALOGO, { error: null }]);
    const res = await PUT(putReq(datosBase({ ingredientes })), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.preparaciones.map((p: any) => p.horario)).toEqual(['ayunas', 'antes_de_dormir']);
  });

  it('separa ingredientes incompatibles en preparaciones distintas (regla 5)', async () => {
    const ingredientes = [
      { id: 'fe', nombre: 'Hierro', dosisPorTomaMg: 100, vecesPorDia: 1, horario: 'desayuno' },
      { id: 'ca', nombre: 'Calcio', dosisPorTomaMg: 100, vecesPorDia: 1, horario: 'desayuno' },
    ];
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, OBJETIVOS_CONFIRMADOS,
      catalogoCon([
        { nombre: 'Hierro', sinonimos: [], capacidad_capsula_mg: 500, amargor: 0, soluble_en_agua: true, presentacion_preferida: 'individualizar', incompatibilidades: ['Calcio'], dosis_referencia_max: null, limite_superior_referencia: null },
        { nombre: 'Calcio', sinonimos: [], capacidad_capsula_mg: 500, amargor: 0, soluble_en_agua: true, presentacion_preferida: 'individualizar', incompatibilidades: [], dosis_referencia_max: null, limite_superior_referencia: null },
      ]),
      { error: null },
    ]);
    const res = await PUT(putReq(datosBase({ ingredientes })), paramsCon(ID_VALIDO));
    const body = await res.json();
    const preparacionesDesayuno = body.preparaciones.filter((p: any) => p.horario === 'desayuno');
    expect(preparacionesDesayuno).toHaveLength(2);
  });

  it('calcula la dosis diaria total (dosis por toma × veces por día)', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, OBJETIVOS_CONFIRMADOS, SIN_CATALOGO, { error: null }]);
    const res = await PUT(putReq(datosBase({ ingredientes: ingredientesBase })), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.preparaciones[0].ingredientes[0].dosisDiariaTotalMg).toBe(5000); // 2500 * 2
  });
});

describe('PUT /api/pacientes/[id]/formulacion — alertas', () => {
  it('alerta por duplicación del mismo principio activo', async () => {
    const ingredientes = [
      { id: 'a', nombre: 'Zinc', dosisPorTomaMg: 15, vecesPorDia: 1, horario: 'desayuno' },
      { id: 'b', nombre: 'Zinc', dosisPorTomaMg: 15, vecesPorDia: 1, horario: 'cena' },
    ];
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, OBJETIVOS_CONFIRMADOS, SIN_CATALOGO, { error: null }]);
    const res = await PUT(putReq(datosBase({ ingredientes })), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.alertas.some((a: any) => a.codigo === 'duplicado-Zinc')).toBe(true);
  });

  it('alerta por medicación actual registrada', async () => {
    usarMock(USUARIO, [
      TENANT_ROW,
      { data: { ...PACIENTE_ROW.data, medicamentos_actuales: 'Warfarina 5mg' }, error: null },
      OBJETIVOS_CONFIRMADOS, SIN_CATALOGO, { error: null },
    ]);
    const res = await PUT(putReq(datosBase()), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.alertas.some((a: any) => a.codigo === 'medicacion-actual')).toBe(true);
    expect(body.alertas.some((a: any) => a.codigo === 'anticoagulantes')).toBe(true);
  });

  it('alerta por alergia registrada', async () => {
    usarMock(USUARIO, [
      TENANT_ROW,
      { data: { ...PACIENTE_ROW.data, alergias: 'Penicilina' }, error: null },
      OBJETIVOS_CONFIRMADOS, SIN_CATALOGO, { error: null },
    ]);
    const res = await PUT(putReq(datosBase()), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.alertas.some((a: any) => a.codigo === 'alergias')).toBe(true);
  });
});

describe('advertencia visible', () => {
  it('la respuesta de PUT siempre incluye la advertencia de apoyo clínico', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, OBJETIVOS_CONFIRMADOS, SIN_CATALOGO, { error: null }]);
    const res = await PUT(putReq(datosBase()), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.advertencia).toMatch(/no prescribe ni aprueba automáticamente/i);
  });
});
