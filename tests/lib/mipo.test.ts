import { describe, it, expect, vi, beforeEach } from 'vitest';
import { crearSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/lib/clinica/mpi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/clinica/mpi')>();
  return { ...actual, generarProtocoloSugerido: vi.fn() };
});

import { generarProtocoloSugerido } from '@/lib/clinica/mpi';
import { generarPrescripcionSugerida } from '@/lib/clinica/mipo';
import type { ProtocoloSugerido, PrincipioSeleccionMPI } from '@/lib/clinica/mpi';
import type { PrincipioFarmacotecnico } from '@/lib/repositorios/baseFarmacotecnica';

function principioBase(overrides: Partial<PrincipioFarmacotecnico> = {}): PrincipioFarmacotecnico {
  return {
    id: 'p1', nombreCanonico: 'Principio X', nombreCientifico: null, sinonimos: [], categorias: [],
    dosisMinima: null, dosisUsual: null, dosisMaxima: null,
    capacidadCapsulaMg: 500, tamanoCapsula: null, maxCapsulasPorToma: null, presentacionIdeal: 'capsula',
    farmacotecnia: { compatibleSobres: null, compatibleLiquidos: null, compatibleCapsulas: null, higroscopico: null, fotosensible: null, sensibleCalor: null },
    perfilOrganoleptico: { tipoSabor: null, intensidad: null, facilidadEnmascarar: null, intensidadNumerica: null, estabilidad: null },
    saboresCompatibles: [], incompatibilidadesNombres: [], compatibilidadesNombres: [],
    ...overrides,
  };
}

function seleccionBase(overrides: Partial<PrincipioSeleccionMPI> = {}): PrincipioSeleccionMPI {
  return {
    nombre: 'Principio X', objetivos: ['Disminuir inflamación'], esObjetivoPrincipal: true,
    disponibleEnBaseValidada: true, principio: principioBase(), prioridad: 'media', ordenSugerido: 0,
    dosisConocimiento: null, horarioRecomendado: 'desayuno', advertenciasIniciales: [],
    dosisElegida: { valor: 300, unidad: 'mg' }, fuenteDosis: 'usual', duracionSugerida: null,
    decisionPresentacion: { presentacionSugerida: 'capsula', capsulasPorToma: 1, limiteCapsulasAplicado: 2, superaLimite: false, alternativasEvaluadas: [], motivo: 'x' },
    decisionSabor: { sabor: 'limon', motivo: 'x' }, advertencias: [],
    ...overrides,
  };
}

function protocoloBase(overrides: Partial<ProtocoloSugerido> = {}): ProtocoloSugerido {
  return {
    pacienteId: 'paciente-1', disponible: true, motivoNoDisponible: null, prioridadTerapeutica: null, fase: 'restore',
    objetivosPrincipales: ['Disminuir inflamación'], objetivosSecundarios: [],
    principiosSeleccionados: [seleccionBase()], excluidos: [], preparados: [{ horario: 'desayuno', principios: ['Principio X'] }],
    ordenTerapeutico: ['Principio X'], version: 1, advertenciaLegal: 'x',
    ...overrides,
  };
}

const PACIENTE_SIN_CONTEXTO = { data: { alergias: null, medicamentos_actuales: null, antecedentes_personales: null, antecedentes_familiares: null }, error: null };

function usarMock(queue: any[]) {
  const { client, from } = crearSupabaseMock({ id: 'user-1' }, queue);
  return { client: client as any, from };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generarPrescripcionSugerida — protocolo no disponible', () => {
  it('propaga disponible=false y motivoNoDisponible sin consultar interacciones ni contraindicaciones', async () => {
    (generarProtocoloSugerido as any).mockResolvedValue({ ...protocoloBase(), disponible: false, motivoNoDisponible: 'Objetivos no confirmados.', principiosSeleccionados: [] });
    const { client, from } = usarMock([]);
    const resultado = await generarPrescripcionSugerida(client, 'tenant-1', 'paciente-1');
    expect(resultado.disponible).toBe(false);
    expect(resultado.motivoNoDisponible).toBe('Objetivos no confirmados.');
    expect(resultado.interacciones).toEqual([]);
    expect(resultado.ingredientesSugeridos).toEqual([]);
    expect(resultado.itemsSugeridos).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('incluye igualmente el resultadoVCI (VCI se degrada con gracia ante un protocolo no disponible)', async () => {
    (generarProtocoloSugerido as any).mockResolvedValue({ ...protocoloBase(), disponible: false, motivoNoDisponible: 'Fase no confirmada.', principiosSeleccionados: [] });
    const { client } = usarMock([]);
    const resultado = await generarPrescripcionSugerida(client, 'tenant-1', 'paciente-1');
    expect(resultado.resultadoVCI.disponible).toBe(false);
  });
});

describe('generarPrescripcionSugerida — protocolo vacío', () => {
  it('protocolo disponible sin candidatos produce una prescripción vacía, sin lanzar', async () => {
    (generarProtocoloSugerido as any).mockResolvedValue(protocoloBase({ principiosSeleccionados: [], preparados: [] }));
    const { client } = usarMock([PACIENTE_SIN_CONTEXTO]);
    const resultado = await generarPrescripcionSugerida(client, 'tenant-1', 'paciente-1');
    expect(resultado.disponible).toBe(true);
    expect(resultado.explicaciones).toEqual([]);
    expect(resultado.ingredientesSugeridos).toEqual([]);
    expect(resultado.itemsSugeridos).toEqual([]);
    expect(resultado.interacciones).toEqual([]);
  });
});

describe('generarPrescripcionSugerida — interacciones', () => {
  it('detecta una interacción principio-principio entre dos seleccionados', async () => {
    const a = seleccionBase({ nombre: 'A', principio: principioBase({ id: 'p-a', nombreCanonico: 'A' }) });
    const b = seleccionBase({ nombre: 'B', principio: principioBase({ id: 'p-b', nombreCanonico: 'B' }) });
    (generarProtocoloSugerido as any).mockResolvedValue(protocoloBase({ principiosSeleccionados: [a, b], preparados: [{ horario: 'desayuno', principios: ['A', 'B'] }] }));
    const { client } = usarMock([
      PACIENTE_SIN_CONTEXTO,
      { data: [{ id: 'i1', principio_id: 'p-a', principio_relacionado_id: 'p-b', sustancia_externa: null, tipo: 'sinergia', descripcion: 'Interactúan.', severidad: 'moderada' }], error: null },
      { data: [], error: null },
    ]);
    const resultado = await generarPrescripcionSugerida(client, 'tenant-1', 'paciente-1');
    expect(resultado.interacciones).toHaveLength(1);
    expect(resultado.interacciones[0].fuente).toBe('interacciones_principios');
  });

  it('detecta una interacción con medicación externa registrada del paciente', async () => {
    const a = seleccionBase({ nombre: 'A', principio: principioBase({ id: 'p-a', nombreCanonico: 'A' }) });
    (generarProtocoloSugerido as any).mockResolvedValue(protocoloBase({ principiosSeleccionados: [a], preparados: [{ horario: 'desayuno', principios: ['A'] }] }));
    const { client } = usarMock([
      { data: { alergias: null, medicamentos_actuales: 'Warfarina 5mg', antecedentes_personales: null, antecedentes_familiares: null }, error: null },
      { data: [{ id: 'i1', principio_id: 'p-a', principio_relacionado_id: null, sustancia_externa: 'warfarina', tipo: 'riesgo', descripcion: 'Aumenta riesgo hemorrágico.', severidad: 'alta' }], error: null },
      { data: [], error: null },
    ]);
    const resultado = await generarPrescripcionSugerida(client, 'tenant-1', 'paciente-1');
    expect(resultado.interacciones).toHaveLength(1);
    expect(resultado.interacciones[0].fuente).toBe('medicacion-externa');
  });

  it('sin interacciones cargadas, devuelve una lista vacía sin lanzar', async () => {
    const a = seleccionBase({ principio: principioBase({ id: 'p-a' }) });
    (generarProtocoloSugerido as any).mockResolvedValue(protocoloBase({ principiosSeleccionados: [a] }));
    const { client } = usarMock([PACIENTE_SIN_CONTEXTO, { data: [], error: null }, { data: [], error: null }]);
    const resultado = await generarPrescripcionSugerida(client, 'tenant-1', 'paciente-1');
    expect(resultado.interacciones).toEqual([]);
  });
});

describe('generarPrescripcionSugerida — explicación y adaptación', () => {
  it('genera una explicación por cada principio seleccionado', async () => {
    const a = seleccionBase({ nombre: 'A', principio: principioBase({ id: 'p-a', nombreCanonico: 'A' }) });
    const b = seleccionBase({ nombre: 'B', principio: null, disponibleEnBaseValidada: false });
    (generarProtocoloSugerido as any).mockResolvedValue(protocoloBase({ principiosSeleccionados: [a, b] }));
    const { client } = usarMock([PACIENTE_SIN_CONTEXTO, { data: [], error: null }, { data: [], error: null }]);
    const resultado = await generarPrescripcionSugerida(client, 'tenant-1', 'paciente-1');
    expect(resultado.explicaciones).toHaveLength(2);
  });

  it('adapta correctamente a IngredienteFormula[]: sólo candidatos con dosis y principio resuelto', async () => {
    const conDosis = seleccionBase({ nombre: 'Con dosis', principio: principioBase({ id: 'p1', nombreCanonico: 'Con dosis' }), dosisElegida: { valor: 300, unidad: 'mg' } });
    const sinDosis = seleccionBase({ nombre: 'Sin dosis', principio: principioBase({ id: 'p2', nombreCanonico: 'Sin dosis' }), dosisElegida: null });
    (generarProtocoloSugerido as any).mockResolvedValue(protocoloBase({ principiosSeleccionados: [conDosis, sinDosis] }));
    const { client } = usarMock([PACIENTE_SIN_CONTEXTO, { data: [], error: null }, { data: [], error: null }]);
    const resultado = await generarPrescripcionSugerida(client, 'tenant-1', 'paciente-1');
    expect(resultado.ingredientesSugeridos).toHaveLength(1);
    expect(resultado.ingredientesSugeridos[0].nombre).toBe('Con dosis');
  });

  it('adapta correctamente a ItemLegacy[]: incluye todos los candidatos, incluso sin dosis', async () => {
    const conDosis = seleccionBase({ nombre: 'Con dosis', principio: principioBase({ id: 'p1' }) });
    const sinDosis = seleccionBase({ nombre: 'Sin dosis', principio: principioBase({ id: 'p2' }), dosisElegida: null });
    (generarProtocoloSugerido as any).mockResolvedValue(protocoloBase({ principiosSeleccionados: [conDosis, sinDosis] }));
    const { client } = usarMock([PACIENTE_SIN_CONTEXTO, { data: [], error: null }, { data: [], error: null }]);
    const resultado = await generarPrescripcionSugerida(client, 'tenant-1', 'paciente-1');
    expect(resultado.itemsSugeridos).toHaveLength(2);
  });
});

describe('generarPrescripcionSugerida — integración con VCI', () => {
  it('el resultadoVCI se calcula a partir del mismo protocolo del MPI', async () => {
    const dup1 = seleccionBase({ nombre: 'Dup', principio: principioBase({ id: 'p1', nombreCanonico: 'Dup' }) });
    const dup2 = seleccionBase({ nombre: 'Dup', principio: principioBase({ id: 'p1', nombreCanonico: 'Dup' }) });
    (generarProtocoloSugerido as any).mockResolvedValue(protocoloBase({ principiosSeleccionados: [dup1, dup2] }));
    const { client } = usarMock([PACIENTE_SIN_CONTEXTO, { data: [], error: null }, { data: [], error: null }]);
    const resultado = await generarPrescripcionSugerida(client, 'tenant-1', 'paciente-1');
    expect(resultado.resultadoVCI.alertasCriticas.some(a => a.categoria === 'redundancia')).toBe(true);
  });
});

describe('generarPrescripcionSugerida — garantías estructurales', () => {
  it('no muta el protocolo devuelto por el MPI', async () => {
    const protocolo = Object.freeze(protocoloBase({ principiosSeleccionados: [seleccionBase({ principio: principioBase({ id: 'p1' }) })] }));
    (generarProtocoloSugerido as any).mockResolvedValue(protocolo);
    const { client } = usarMock([PACIENTE_SIN_CONTEXTO, { data: [], error: null }, { data: [], error: null }]);
    await expect(generarPrescripcionSugerida(client, 'tenant-1', 'paciente-1')).resolves.toBeDefined();
  });

  it('no persiste nada: ninguna consulta llama a insert/update/upsert', async () => {
    const a = seleccionBase({ principio: principioBase({ id: 'p1' }) });
    (generarProtocoloSugerido as any).mockResolvedValue(protocoloBase({ principiosSeleccionados: [a] }));
    const { client, from } = usarMock([PACIENTE_SIN_CONTEXTO, { data: [], error: null }, { data: [], error: null }]);
    await generarPrescripcionSugerida(client, 'tenant-1', 'paciente-1');
    for (const resultado of from.mock.results) {
      expect(resultado.value.insert).not.toHaveBeenCalled();
      expect(resultado.value.update).not.toHaveBeenCalled();
      expect(resultado.value.upsert).not.toHaveBeenCalled();
    }
  });

  it('es determinista: la misma entrada produce el mismo resultado', async () => {
    const a = seleccionBase({ nombre: 'A', principio: principioBase({ id: 'p-a', nombreCanonico: 'A' }) });

    (generarProtocoloSugerido as any).mockResolvedValue(protocoloBase({ principiosSeleccionados: [a] }));
    const { client: cliente1 } = usarMock([PACIENTE_SIN_CONTEXTO, { data: [], error: null }, { data: [], error: null }]);
    const r1 = await generarPrescripcionSugerida(cliente1, 'tenant-1', 'paciente-1');

    (generarProtocoloSugerido as any).mockResolvedValue(protocoloBase({ principiosSeleccionados: [a] }));
    const { client: cliente2 } = usarMock([PACIENTE_SIN_CONTEXTO, { data: [], error: null }, { data: [], error: null }]);
    const r2 = await generarPrescripcionSugerida(cliente2, 'tenant-1', 'paciente-1');

    expect(r1.ingredientesSugeridos).toEqual(r2.ingredientesSugeridos);
    expect(r1.itemsSugeridos).toEqual(r2.itemsSugeridos);
    expect(r1.resultadoVCI.scoreGlobal).toEqual(r2.resultadoVCI.scoreGlobal);
    expect(r1.explicaciones).toEqual(r2.explicaciones);
  });

  it('la advertencia legal indica que es una sugerencia sujeta a revisión y aprobación médica', async () => {
    (generarProtocoloSugerido as any).mockResolvedValue(protocoloBase({ principiosSeleccionados: [] }));
    const { client } = usarMock([PACIENTE_SIN_CONTEXTO]);
    const resultado = await generarPrescripcionSugerida(client, 'tenant-1', 'paciente-1');
    expect(resultado.advertenciaLegal).toMatch(/revisión/);
    expect(resultado.advertenciaLegal).toMatch(/aprobación médica/);
  });
});
