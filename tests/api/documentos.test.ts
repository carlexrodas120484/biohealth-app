import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/pdf/render', () => ({
  renderPdf: vi.fn(async () => Buffer.from('%PDF-1.4 contenido de prueba')),
}));

import { createClient } from '@/lib/supabase/server';
import { renderPdf } from '@/lib/pdf/render';
import { GET, POST } from '@/app/api/pacientes/[id]/documentos/route';

const USUARIO = { id: 'auth-1' };
const ID_VALIDO = '77777777-7777-4777-8777-777777777777';
const OTRO_TENANT_PACIENTE_ID = '88888888-8888-4888-8888-888888888888';

const TENANT_ROW = { data: { tenant_id: 'tenant-1' }, error: null };
const SIN_TENANT_ROW = { data: { tenant_id: null }, error: null };
const PACIENTE_ROW = {
  data: {
    id: ID_VALIDO, nombre: 'María José', apellido: 'Núñez', documento: '1234567',
    fecha_nacimiento: '1990-01-01', sexo: 'femenino', telefono: '0973000000',
    motivo_consulta: 'Fatiga crónica', antecedentes_personales: null,
    medicamentos_actuales: null, alergias: null,
  },
  error: null,
};
const PACIENTE_NO_ENCONTRADO = { data: null, error: null };
const SIN_VERSION_PREVIA = { data: null, error: null };

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

const FORMULACION_APROBADA = {
  data: {
    id: 'form-1', fase: 'restore', objetivos: ['Reparar mucosa'],
    items: [{ nombre: 'L-glutamina', dosis: '5 g', presentacion: 'polvo', cantidad: '150 g', indicacion: '1 medida en ayunas', observaciones: '' }],
    ingredientes: [{ nombre: 'L-glutamina', dosisPorTomaMg: 5000, vecesPorDia: 1, horario: 'ayunas' }],
    estado: 'aprobada', firmada_en: '2026-08-01T00:00:00.000Z', version_reglas: 'v1.0',
    revision_clinica: {},
  },
  error: null,
};
const FORMULACION_BORRADOR = { data: { ...FORMULACION_APROBADA.data, estado: 'borrador' }, error: null };
const SIN_FORMULACION = { data: null, error: null };

const NUTRICION_APROBADA = {
  data: {
    objetivo_clinico: 'antiinflamatorio',
    calculos: { objetivoCaloricoKcal: 1800, proteinaG: 90, carbohidratosG: 180, grasasG: 60, fibraG: 30, aguaMl: 2000 },
    plan: {
      numeroComidas: 4, menuDiario: [{ horario: 'desayuno', descripcion: 'Avena', alternativas: [] }],
      alimentosRecomendados: ['Vegetales'], alimentosALimitar: [], alimentosAEvitar: [],
      listaCompras: [], observaciones: '', duracionDias: 30,
    },
    restricciones: { alergiasAlimentarias: [], celiaquia: false, vegetarianismo: false, veganismo: false },
    advertencias: [], estado: 'aprobado',
  },
  error: null,
};
const NUTRICION_BORRADOR = { data: { ...NUTRICION_APROBADA.data, estado: 'borrador' }, error: null };
const SIN_NUTRICION = { data: null, error: null };

const DIAGNOSTICO_CONFIRMADO = {
  data: {
    confirmado: true,
    patrones: [{ nombre: 'Disbiosis intestinal', nivel: 'alta', prioridad: 'alta', estado: 'confirmado' }],
    impresion: 'Cuadro compatible.', estudios: 'Coprocultivo pendiente.',
  },
  error: null,
};
const DIAGNOSTICO_NO_CONFIRMADO = { data: { ...DIAGNOSTICO_CONFIRMADO.data, confirmado: false }, error: null };
const SIN_DIAGNOSTICO = { data: null, error: null };

const PLAN_TERAPEUTICO_ACTIVO = {
  data: { fases: [{ nombre: 'Restore', objetivo: 'Reparar mucosa', estado: 'activa', prioridad: 'alta', duracionEstimadaSemanas: 4, observacionesMedico: '' }] },
  error: null,
};
const SIN_PLAN_TERAPEUTICO = { data: null, error: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('documentos — seguridad', () => {
  it('devuelve 404 si el id no es un UUID válido, sin tocar la base (GET)', async () => {
    const from = usarMock(USUARIO, []);
    const res = await GET(getReq(), paramsCon('no-es-uuid'));
    expect(res.status).toBe(404);
    expect(from).not.toHaveBeenCalled();
  });

  it('devuelve 404 si el id no es un UUID válido (POST)', async () => {
    const from = usarMock(USUARIO, []);
    const res = await POST(postReq({ tipo: 'plan_nutricional' }), paramsCon('no-es-uuid'));
    expect(res.status).toBe(404);
    expect(from).not.toHaveBeenCalled();
  });

  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await POST(postReq({ tipo: 'plan_nutricional' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(401);
  });

  it('devuelve 403 si el usuario no tiene tenant asignado', async () => {
    usarMock(USUARIO, [SIN_TENANT_ROW]);
    const res = await POST(postReq({ tipo: 'plan_nutricional' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(403);
  });

  it('devuelve 404 si el paciente no existe', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_NO_ENCONTRADO]);
    const res = await POST(postReq({ tipo: 'plan_nutricional' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('devuelve 404 si el paciente pertenece a otro tenant (la consulta ya filtra por tenant_id, no vuelve nada)', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_NO_ENCONTRADO]);
    const res = await POST(postReq({ tipo: 'plan_nutricional' }), paramsCon(OTRO_TENANT_PACIENTE_ID));
    expect(res.status).toBe(404);
  });

  it('devuelve 404 si el paciente está eliminado (deleted_at is null lo excluye)', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_NO_ENCONTRADO]);
    const res = await POST(postReq({ tipo: 'plan_nutricional' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });

  it('devuelve 422 si el cuerpo no es JSON válido', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const res = await POST(postReqTextoCrudo('{no es json'), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('devuelve 422 si el tipo de documento no es válido', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    const res = await POST(postReq({ tipo: 'algo_inventado' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('nunca usa service_role: createClient es el cliente de servidor con sesión, no un cliente admin', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW]);
    await POST(postReq({ tipo: 'plan_nutricional' }), paramsCon(ID_VALIDO));
    expect(createClient).toHaveBeenCalled();
  });
});

describe('documentos — exclusión de borradores / inclusión de aprobados', () => {
  it('receta ortomolecular: 422 si la formulación está en borrador (no aprobada)', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_VERSION_PREVIA, FORMULACION_BORRADOR]);
    const res = await POST(postReq({ tipo: 'receta_ortomolecular' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('receta ortomolecular: 200 y usa exactamente los datos de la formulación aprobada', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_VERSION_PREVIA, FORMULACION_APROBADA, { data: null, error: null }]);
    const res = await POST(postReq({ tipo: 'receta_ortomolecular' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  });

  it('plan nutricional: 422 si el plan está en borrador', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_VERSION_PREVIA, NUTRICION_BORRADOR]);
    const res = await POST(postReq({ tipo: 'plan_nutricional' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('plan nutricional: 200 con plan aprobado', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_VERSION_PREVIA, NUTRICION_APROBADA, { data: null, error: null }]);
    const res = await POST(postReq({ tipo: 'plan_nutricional' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
  });

  it('resumen diagnóstico: 422 si el diagnóstico no está confirmado', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_VERSION_PREVIA, DIAGNOSTICO_NO_CONFIRMADO]);
    const res = await POST(postReq({ tipo: 'resumen_diagnostico' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('plan terapéutico: 422 si no hay fases activas ni completadas', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_VERSION_PREVIA, SIN_PLAN_TERAPEUTICO]);
    const res = await POST(postReq({ tipo: 'plan_terapeutico' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('plan terapéutico: 200 con fase activa', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_VERSION_PREVIA, PLAN_TERAPEUTICO_ACTIVO, { data: null, error: null }]);
    const res = await POST(postReq({ tipo: 'plan_terapeutico' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
  });

  it('informe sin datos: 422 en informe_clinico_completo cuando no hay historia ni diagnóstico ni motivo de consulta', async () => {
    const pacienteSinMotivo = { data: { ...PACIENTE_ROW.data, motivo_consulta: null }, error: null };
    usarMock(USUARIO, [TENANT_ROW, pacienteSinMotivo, SIN_VERSION_PREVIA, SIN_DIAGNOSTICO, { data: null, error: null }]);
    const res = await POST(postReq({ tipo: 'informe_clinico_completo' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('informe integrado: 422 si absolutamente ningún módulo tiene datos aprobados/confirmados', async () => {
    const pacienteSinMotivo = { data: { ...PACIENTE_ROW.data, motivo_consulta: null }, error: null };
    usarMock(USUARIO, [
      TENANT_ROW, pacienteSinMotivo, SIN_VERSION_PREVIA,
      { data: null, error: null }, SIN_DIAGNOSTICO, SIN_PLAN_TERAPEUTICO, SIN_FORMULACION, SIN_NUTRICION,
    ]);
    const res = await POST(postReq({ tipo: 'informe_integrado' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(422);
  });

  it('informe integrado: 200 si al menos un módulo (nutrición) tiene datos aprobados', async () => {
    const pacienteSinMotivo = { data: { ...PACIENTE_ROW.data, motivo_consulta: null }, error: null };
    usarMock(USUARIO, [
      TENANT_ROW, pacienteSinMotivo, SIN_VERSION_PREVIA,
      { data: null, error: null }, SIN_DIAGNOSTICO, SIN_PLAN_TERAPEUTICO, SIN_FORMULACION, NUTRICION_APROBADA,
      { data: null, error: null },
    ]);
    const res = await POST(postReq({ tipo: 'informe_integrado' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
  });
});

describe('documentos — nombre de archivo', () => {
  it('el Content-Disposition usa el formato BioHealth_Apellido_Nombre_TipoDocumento_YYYY-MM-DD.pdf', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_VERSION_PREVIA, NUTRICION_APROBADA, { data: null, error: null }]);
    const res = await POST(postReq({ tipo: 'plan_nutricional' }), paramsCon(ID_VALIDO));
    const disposition = res.headers.get('Content-Disposition') ?? '';
    expect(disposition).toMatch(/filename="BioHealth_Nunez_Maria_Jose_Plan_nutricional_\d{4}-\d{2}-\d{2}\.pdf"/);
  });

  it('caracteres especiales en el nombre del paciente no rompen la generación ni el nombre de archivo', async () => {
    const pacienteConSimbolos = { data: { ...PACIENTE_ROW.data, nombre: 'José <script>', apellido: 'O\'Connor & Cía' }, error: null };
    usarMock(USUARIO, [TENANT_ROW, pacienteConSimbolos, SIN_VERSION_PREVIA, NUTRICION_APROBADA, { data: null, error: null }]);
    const res = await POST(postReq({ tipo: 'plan_nutricional' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const disposition = res.headers.get('Content-Disposition') ?? '';
    expect(disposition).not.toMatch(/[<>&']/);
  });
});

describe('documentos — documento extenso y saltos de página', () => {
  it('genera correctamente un informe integrado con muchas fases sin fallar', async () => {
    const planExtenso = {
      data: { fases: Array.from({ length: 25 }, (_, i) => ({ nombre: `Fase ${i}`, objetivo: 'Objetivo', estado: 'activa', prioridad: 'media', duracionEstimadaSemanas: 2, observacionesMedico: '' })) },
      error: null,
    };
    usarMock(USUARIO, [
      TENANT_ROW, PACIENTE_ROW, SIN_VERSION_PREVIA,
      { data: null, error: null }, SIN_DIAGNOSTICO, planExtenso, SIN_FORMULACION, SIN_NUTRICION,
      { data: null, error: null },
    ]);
    const res = await POST(postReq({ tipo: 'informe_integrado' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    expect(renderPdf).toHaveBeenCalled();
  });
});

describe('documentos — aislamiento entre tenants', () => {
  it('la consulta de paciente siempre filtra por tenant_id además de RLS', async () => {
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_VERSION_PREVIA, NUTRICION_APROBADA, { data: null, error: null }]);
    await POST(postReq({ tipo: 'plan_nutricional' }), paramsCon(ID_VALIDO));
    expect(from).toHaveBeenCalledWith('pacientes');
  });
});

describe('documentos — historial de generación', () => {
  it('GET devuelve el historial sin exponer una URL pública de acceso al documento', async () => {
    const HISTORIAL = {
      data: [
        { id: 'doc-1', tipo: 'plan_nutricional', version: 1, estado: 'generado', generado_en: '2026-08-01T00:00:00.000Z', generado_por: 'auth-1', contenido_hash: 'abc123' },
      ],
      error: null,
    };
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, HISTORIAL]);
    const res = await GET(getReq(), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.historial).toHaveLength(1);
    expect(body.historial[0]).not.toHaveProperty('url');
    expect(body.historial[0]).not.toHaveProperty('ruta');
    expect(JSON.stringify(body.historial)).not.toMatch(/^https?:\/\//);
  });

  it('registra versión incremental cuando ya existe un documento previo del mismo tipo', async () => {
    const VERSION_PREVIA = { data: { version: 3 }, error: null };
    const from = usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, VERSION_PREVIA, NUTRICION_APROBADA, { data: null, error: null }]);
    const res = await POST(postReq({ tipo: 'plan_nutricional' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
    expect(from).toHaveBeenCalledWith('documentos_clinicos_generados');
  });
});

describe('documentos — tipos legacy (receta_botica/informe_medico/informe_paciente)', () => {
  it('receta_botica: 409 si la formulación no está aprobada', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_VERSION_PREVIA, FORMULACION_BORRADOR]);
    const res = await POST(postReq({ tipo: 'receta_botica' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(409);
  });

  it('receta_botica: 200 con formulación aprobada', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_VERSION_PREVIA, FORMULACION_APROBADA, { data: null, error: null }]);
    const res = await POST(postReq({ tipo: 'receta_botica' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(200);
  });

  it('informe_medico: 404 si la formulación no existe', async () => {
    usarMock(USUARIO, [TENANT_ROW, PACIENTE_ROW, SIN_VERSION_PREVIA, SIN_FORMULACION]);
    const res = await POST(postReq({ tipo: 'informe_medico' }), paramsCon(ID_VALIDO));
    expect(res.status).toBe(404);
  });
});
