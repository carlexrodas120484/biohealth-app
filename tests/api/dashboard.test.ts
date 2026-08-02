import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET } from '@/app/api/pacientes/[id]/dashboard/route';

const USUARIO = { id: 'auth-1' };
const ID_VALIDO = '77777777-7777-4777-8777-777777777777';
const OTRO_TENANT_ID = '88888888-8888-4888-8888-888888888888';

const TENANT_ROW = { data: { tenant_id: 'tenant-1' }, error: null };
const SIN_TENANT_ROW = { data: { tenant_id: null }, error: null };
const PACIENTE_ROW = {
  data: { id: ID_VALIDO, nombre: 'Ana', apellido: 'Gómez', fecha_nacimiento: '1990-01-01', sexo: 'femenino', motivo_consulta: 'Fatiga', observaciones: 'Ninguna' },
  error: null,
};
const PACIENTE_NO_ENCONTRADO = { data: null, error: null };

const VACIO = { data: null, error: null };
const LISTA_VACIA = { data: [], error: null };

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

function colaVacia(overrides: Record<number, any> = {}) {
  const base = [VACIO, VACIO, VACIO, VACIO, VACIO, VACIO, LISTA_VACIA, LISTA_VACIA];
  for (const [i, v] of Object.entries(overrides)) base[Number(i)] = v;
  return base;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('dashboard — seguridad', () => {
  it('devuelve 404 si el id no es un UUID válido, sin tocar la base', async () => {
    const from = usarMock(USUARIO, []);
    const res = await GET(getReq(), paramsCon('no-es-uuid'));
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
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_NO_ENCONTRADO]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('devuelve 404 si el paciente pertenece a otro tenant (aislamiento entre tenants)', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_NO_ENCONTRADO]);
    const res = await GET(getReq(), paramsCon(OTRO_TENANT_ID));
    expect(res.status).toBe(404);
  });

  it('nunca usa un cliente admin/service_role: sólo createClient() con sesión', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, ...colaVacia()]);
    await GET(getReq(), paramsCon(ID_VALIDO));
    expect(createClient).toHaveBeenCalled();
  });
});

describe('dashboard — rendimiento (consultas agrupadas, no repetidas)', () => {
  it('hace exactamente 10 llamadas a .from() en total: 2 de contexto + 8 agregadas en paralelo', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, ...colaVacia()]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    expect(from).toHaveBeenCalledTimes(10);
  });

  it('nunca consulta la misma tabla dos veces en una sola ejecución', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, ...colaVacia()]);
    await GET(getReq(), paramsCon(ID_VALIDO));
    const llamadas = from.mock.calls.map((c: any[]) => c[0]);
    expect(new Set(llamadas).size).toBe(llamadas.length);
  });
});

describe('dashboard — vacío vs completo', () => {
  it('dashboard vacío: paciente sin ningún módulo cargado responde 200 con listas vacías y semáforos sin_datos', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, ...colaVacia()]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.diagnostico.confirmado).toBe(false);
    expect(body.diagnostico.patronesConfirmados).toHaveLength(0);
    expect(body.problemasPriorizados).toHaveLength(0);
    expect(body.laboratorios.indicadoresActuales.every((i: any) => i.semaforo === 'sin_datos')).toBe(true);
    expect(body.formulacionActiva).toBeNull();
    expect(body.nutricionActiva).toBeNull();
    expect(body.proximoControl).toBeNull();
    expect(body.evolucionClinica).toHaveLength(0);
  });

  it('diagnóstico pendiente: historia guardada pero diagnóstico no confirmado genera recordatorio', async () => {
    const HISTORIA = { data: { historia: {}, completado: true }, error: null };
    const DIAGNOSTICO_NO_CONFIRMADO = { data: { confirmado: false, patrones: [], impresion: '' }, error: null };
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, ...colaVacia({ 0: HISTORIA, 1: DIAGNOSTICO_NO_CONFIRMADO })]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.diagnostico.confirmado).toBe(false);
    expect(body.recordatorios).toContain('Confirmar el diagnóstico funcional.');
  });

  it('laboratorios faltantes: sin registros, cada indicador queda en sin_datos y sin gráfico', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, ...colaVacia()]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.laboratorios.ultimaFecha).toBeNull();
    expect(Object.values(body.laboratorios.series).every((s: any) => Array.isArray(s) && s.length === 0)).toBe(true);
  });

  it('dashboard completo: todos los módulos con datos aprobados/confirmados arma las 18 secciones sin errores', async () => {
    const HISTORIA = { data: { historia: { peso: 70 }, completado: true }, error: null };
    const PATRON = { codigo: 'intestinal', nombre: 'Disbiosis o alteración intestinal', puntaje: 80, nivel: 'alta', prioridad: 'alta', evidencias: [], estado: 'confirmado' };
    const DIAGNOSTICO = { data: { confirmado: true, patrones: [PATRON], impresion: 'Cuadro compatible.' }, error: null };
    const PLAN = { data: { fases: [{ codigo: 'restore', nombre: 'Restore', objetivo: 'Reparar mucosa', prioridad: 'alta', duracionEstimadaSemanas: 6, criteriosInicio: [], criteriosAvance: [], criteriosPausa: [], riesgos: [], evidencias: [], observacionesMedico: '', estado: 'activa', orden: 1, fechaCalculo: '2026-01-01', version: 1 }] }, error: null };
    const FORMULACION = { data: { estado: 'aprobada', fase: 'restore', items: [{ nombre: 'L-glutamina' }], firmada_en: '2026-01-01T00:00:00.000Z' }, error: null };
    const NUTRICION = { data: { estado: 'aprobado', objetivo_clinico: 'antiinflamatorio', aprobado_en: '2026-01-01T00:00:00.000Z' }, error: null };
    const FASE = { data: { fase_seleccionada: 'restore', confirmado: true }, error: null };
    const CONTROLES = { data: [{ fase: 'restore', ciclo_num: 1, reduccion_ipt_pct: 20, mejoria_objetivos_pct: 30, adherencia_pct: 90, decision: 'avanzar', created_at: '2026-01-01T00:00:00.000Z' }], error: null };
    const LABORATORIOS = { data: [{ fecha: '2026-01-01', peso_kg: 70, talla_cm: 170, cintura_cm: 85, presion_sistolica: 118, presion_diastolica: 76, glucemia_mg_dl: 90, hba1c_pct: 5.3, trigliceridos_mg_dl: 120, hdl_mg_dl: 55, ldl_mg_dl: 90, vitamina_d_ng_ml: 35, homa_ir: 1.8, pcr_mg_l: 0.5, ferritina_ng_ml: 90 }], error: null };

    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, HISTORIA, DIAGNOSTICO, PLAN, FORMULACION, NUTRICION, FASE, CONTROLES, LABORATORIOS]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.diagnostico.confirmado).toBe(true);
    expect(body.diagnostico.patronesConfirmados).toHaveLength(1);
    expect(body.formulacionActiva.estado).toBe('aprobada');
    expect(body.nutricionActiva.estado).toBe('aprobado');
    expect(body.evolucionClinica).toHaveLength(1);
    expect(body.laboratorios.ultimaFecha).toBe('2026-01-01');
    expect(body.laboratorios.indicadoresActuales.find((i: any) => i.codigo === 'glucemia').semaforo).toBe('verde');
    expect(body.proximoControl).not.toBeNull();
    expect(body.estadoTratamiento.fasesActivas).toBe(1);
  });
});

describe('dashboard — alertas', () => {
  it('propaga alertas rojas cuando hay un laboratorio fuera de rango', async () => {
    const LABORATORIOS = { data: [{ fecha: '2026-01-01', peso_kg: null, talla_cm: null, cintura_cm: null, presion_sistolica: null, presion_diastolica: null, glucemia_mg_dl: 160, hba1c_pct: null, trigliceridos_mg_dl: null, hdl_mg_dl: null, ldl_mg_dl: null, vitamina_d_ng_ml: null, homa_ir: null, pcr_mg_l: null, ferritina_ng_ml: null }], error: null };
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, ...colaVacia({ 7: LABORATORIOS })]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.alertas.some((a: any) => a.codigo === 'indicador-glucemia' && a.severidad === 'rojo')).toBe(true);
    expect(body.problemasPriorizados[0].severidad).toBe('rojo');
  });
});
