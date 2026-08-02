import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET } from '@/app/api/pacientes/[id]/ia/route';

const USUARIO = { id: 'auth-1' };
const ID_VALIDO = '77777777-7777-4777-8777-777777777777';
const OTRO_TENANT_ID = '88888888-8888-4888-8888-888888888888';

const TENANT_ROW = { data: { tenant_id: 'tenant-1' }, error: null };
const SIN_TENANT_ROW = { data: { tenant_id: null }, error: null };
const PACIENTE_ROW = {
  data: {
    id: ID_VALIDO, nombre: 'Ana', apellido: 'Gómez', fecha_nacimiento: '1990-01-01', sexo: 'femenino',
    motivo_consulta: 'Fatiga', alergias: null, medicamentos_actuales: null, antecedentes_personales: null, antecedentes_familiares: null,
  },
  error: null,
};
const PACIENTE_NO_ENCONTRADO = { data: null, error: null };
const VACIO = { data: null, error: null };

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
  const base = [VACIO, VACIO, VACIO, VACIO, VACIO, VACIO, VACIO, VACIO];
  for (const [i, v] of Object.entries(overrides)) base[Number(i)] = v;
  return base;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ia — seguridad', () => {
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

  it('nunca usa un cliente admin/service_role', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, ...colaVacia()]);
    await GET(getReq(), paramsCon(ID_VALIDO));
    expect(createClient).toHaveBeenCalled();
  });

  it('sólo expone GET: el módulo de la ruta no exporta POST/PUT/DELETE (nunca modifica datos)', async () => {
    const modulo = await import('@/app/api/pacientes/[id]/ia/route');
    expect(modulo.POST).toBeUndefined();
    expect(modulo.PUT).toBeUndefined();
    expect(modulo.DELETE).toBeUndefined();
    expect(modulo.PATCH).toBeUndefined();
  });
});

describe('ia — rendimiento (consultas agrupadas)', () => {
  it('hace exactamente 10 llamadas a .from(): 2 de contexto + 8 agregadas en paralelo', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, ...colaVacia()]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    expect(from).toHaveBeenCalledTimes(10);
  });
});

describe('ia — informe vacío vs completo', () => {
  it('paciente sin ningún módulo cargado responde 200 con las 10 secciones presentes y prioridad baja', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, ...colaVacia()]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.prioridadClinica).toBe('baja');
    expect(body.principalesProblemas).toHaveLength(0);
    expect(body.recomendacionesOrtomoleculares).toHaveLength(0);
    expect(body.estudiosFaltantes).toHaveLength(0);
    expect(body.interaccionesPosibles).toHaveLength(0);
    expect(body.contraindicaciones).toHaveLength(0);
    expect(body.proximoPaso.titulo).toBeTruthy();
    expect(body.resumenClinico.length).toBeGreaterThan(0);
  });

  it('diagnóstico pendiente: próximo paso sugiere confirmar el diagnóstico', async () => {
    const HISTORIA = { data: { respuestas: {}, completado: true }, error: null };
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, ...colaVacia({ 0: HISTORIA })]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.proximoPaso.titulo).toBe('Confirmar el diagnóstico funcional');
  });

  it('laboratorios faltantes: prioridad se calcula igual, sin lanzar error, todos los indicadores sin_datos', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, ...colaVacia()]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.prioridadClinica).toBe('baja');
  });

  it('informe completo: diagnóstico confirmado + objetivos + formulación con alertas arma las 10 secciones sin errores', async () => {
    const HISTORIA = { data: { respuestas: {}, completado: true }, error: null };
    const PATRON = { codigo: 'metabolico-glucemico', nombre: 'Alteración glucémica o metabólica', puntaje: 80, nivel: 'alta', prioridad: 'alta', evidencias: [], estado: 'confirmado' };
    const DIAGNOSTICO = { data: { confirmado: true, patrones: [PATRON], impresion: 'Cuadro metabólico.' }, error: null };
    const PLAN = { data: { fases: [{ nombre: 'Restore', estado: 'activa', objetivo: 'Reparar mucosa', duracionEstimadaSemanas: 6 }] }, error: null };
    const FORMULACION = {
      data: {
        estado: 'aprobada', ingredientes: [{ nombre: 'Omega-3' }],
        alertas: [{ codigo: 'anticoagulantes', descripcion: 'Revisar anticoagulantes.', fuente: 'medicacion' }, { codigo: 'alergias', descripcion: 'Alergia registrada.', fuente: 'alergias' }],
      },
      error: null,
    };
    const NUTRICION = { data: { estado: 'aprobado', objetivo_clinico: 'antiinflamatorio' }, error: null };
    const OBJETIVOS = { data: { objetivos: ['Disminuir inflamación'], confirmado: true }, error: null };
    const CONTROL = { data: { decision: 'avanzar', bandera_roja_nueva: false }, error: null };
    const LABORATORIO = { data: { fecha: '2026-01-01', peso_kg: 70, talla_cm: 170, cintura_cm: 85, presion_sistolica: 118, presion_diastolica: 76, glucemia_mg_dl: 90, hba1c_pct: 5.2, trigliceridos_mg_dl: 120, hdl_mg_dl: 55, ldl_mg_dl: 90, vitamina_d_ng_ml: 35, homa_ir: 1.5, pcr_mg_l: 0.5, ferritina_ng_ml: 90 }, error: null };

    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, HISTORIA, DIAGNOSTICO, PLAN, FORMULACION, NUTRICION, OBJETIVOS, CONTROL, LABORATORIO]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.recomendacionesOrtomoleculares.length).toBeGreaterThan(0);
    expect(body.interaccionesPosibles.length).toBeGreaterThan(0);
    expect(body.contraindicaciones.length).toBeGreaterThan(0);
    expect(body.proximoPaso.titulo).toBe('Continuar con el control de seguimiento habitual');
  });
});

describe('ia — alertas', () => {
  it('propaga alertas rojas y sube la prioridad clínica a alta cuando hay un laboratorio fuera de rango', async () => {
    const LABORATORIO = { data: { fecha: '2026-01-01', peso_kg: null, talla_cm: null, cintura_cm: null, presion_sistolica: null, presion_diastolica: null, glucemia_mg_dl: 180, hba1c_pct: null, trigliceridos_mg_dl: null, hdl_mg_dl: null, ldl_mg_dl: null, vitamina_d_ng_ml: null, homa_ir: null, pcr_mg_l: null, ferritina_ng_ml: null }, error: null };
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, ...colaVacia({ 7: LABORATORIO })]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body.prioridadClinica).toBe('alta');
    expect(body.alertas.some((a: any) => a.codigo === 'indicador-glucemia')).toBe(true);
  });
});

describe('ia — nunca modifica datos', () => {
  it('la respuesta es siempre un informe de sugerencias, nunca un resultado de escritura (sin ok/id de inserción)', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, ...colaVacia()]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    const body = await res.json();
    expect(body).not.toHaveProperty('ok');
    expect(body).toHaveProperty('advertencia');
    expect(body.advertencia).toContain('no se aplican automáticamente');
  });
});
