import { describe, it, expect, vi } from 'vitest';
import {
  prioridadTerapeuticaDesdeIPT, prioridadPorObjetivo, separarObjetivosPrincipalesYSecundarios,
  construirCandidatosParaObjetivo, excluirPorContraindicaciones, consolidarDuplicados,
  excluirAlternativasIncompatiblesPorObjetivo, completarSeleccion, agruparPreparados, ordenarTerapeuticamente,
  generarProtocoloSugerido, type CandidatoMPI, type PrincipioSeleccionMPI,
} from '@/lib/clinica/mpi';
import type { PrincipioFarmacotecnico, PreferenciasPaciente } from '@/lib/repositorios/baseFarmacotecnica';
import type { ConocimientoClinico } from '@/lib/repositorios/conocimientoClinico';
import type { FlagsContraindicacion } from '@/lib/repositorios/protocolo';
import type { ResultadoIPT } from '@/lib/algoritmo/ipt';
import { REGLAS_FORMULACION_DEFECTO } from '@/lib/clinica/formulacion';
import { crearSupabaseMock } from '../helpers/supabaseMock';

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

function conocimientoBase(overrides: Partial<ConocimientoClinico> = {}): ConocimientoClinico {
  return {
    id: 'ck1', tenantId: null, principioActivoId: 'p1', objetivoTerapeutico: 'Disminuir inflamación', fase: 'restore',
    prioridad: 'media', evidencia: null, nivelEvidencia: null,
    dosisHabitual: null, dosisMinima: null, dosisMaxima: null, unidadDosis: null,
    horario: null, observaciones: null, contraindicaciones: [], interacciones: [],
    requiereSobre: false, requiereCapsula: false, ordenSugerido: 0,
    estado: 'validado', pendienteValidacion: false, createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  };
}

function candidatoBase(overrides: Partial<CandidatoMPI> = {}): CandidatoMPI {
  return {
    nombre: 'Principio X', objetivos: ['Disminuir inflamación'], esObjetivoPrincipal: true,
    disponibleEnBaseValidada: true, principio: principioBase(), prioridad: 'media', ordenSugerido: 0,
    dosisConocimiento: null, horarioRecomendado: null, advertenciasIniciales: [],
    ...overrides,
  };
}

describe('prioridadTerapeuticaDesdeIPT', () => {
  it('devuelve null si no hay resultados', () => {
    expect(prioridadTerapeuticaDesdeIPT([])).toBeNull();
  });
  it('toma la banda del resultado con mayor puntaje final', () => {
    const resultado: ResultadoIPT[] = [
      { alteracionId: 'a1', base: 10, jerarquico: 10, final: 40, banda: 'media' },
      { alteracionId: 'a2', base: 10, jerarquico: 10, final: 90, banda: 'critica' },
      { alteracionId: 'a3', base: 10, jerarquico: 10, final: 60, banda: 'alta' },
    ];
    expect(prioridadTerapeuticaDesdeIPT(resultado)).toBe('critica');
  });
});

describe('prioridadPorObjetivo y separarObjetivosPrincipalesYSecundarios', () => {
  it('objetivo sin conocimiento_clinico validado queda sin prioridad de catálogo', () => {
    const mapa = prioridadPorObjetivo(['Objetivo A'], new Map());
    expect(mapa.get('Objetivo A')).toBeNull();
  });

  it('toma la máxima prioridad entre las indicaciones validadas de un objetivo', () => {
    const conocimiento = new Map([['Objetivo A', [conocimientoBase({ prioridad: 'media' }), conocimientoBase({ id: 'ck2', prioridad: 'urgente' })]]]);
    const mapa = prioridadPorObjetivo(['Objetivo A'], conocimiento);
    expect(mapa.get('Objetivo A')).toBe('urgente');
  });

  it('sin ningún dato de prioridad cargado, usa la primera mitad del orden confirmado como principal', () => {
    const objetivos = ['A', 'B', 'C', 'D'];
    const split = separarObjetivosPrincipalesYSecundarios(objetivos, new Map(objetivos.map(o => [o, null])));
    expect(split.principales).toEqual(['A', 'B']);
    expect(split.secundarios).toEqual(['C', 'D']);
  });

  it('con datos de prioridad, principal = alta/urgente en la Base de Conocimiento validada', () => {
    const objetivos = ['A', 'B', 'C'];
    const prioridades = new Map<string, 'baja' | 'media' | 'alta' | 'urgente' | null>([['A', 'urgente'], ['B', 'baja'], ['C', 'media']]);
    const split = separarObjetivosPrincipalesYSecundarios(objetivos, prioridades);
    expect(split.principales).toEqual(['A']);
    expect(split.secundarios).toEqual(['B', 'C']);
  });

  it('si hay datos pero ninguno califica alta/urgente, cae al criterio de orden en vez de dejar el protocolo sin objetivo principal', () => {
    const objetivos = ['A', 'B'];
    const prioridades = new Map<string, 'baja' | 'media' | 'alta' | 'urgente' | null>([['A', 'media'], ['B', 'baja']]);
    const split = separarObjetivosPrincipalesYSecundarios(objetivos, prioridades);
    expect(split.principales.length).toBeGreaterThan(0);
  });
});

describe('construirCandidatosParaObjetivo', () => {
  it('usa conocimiento_clinico validado cuando existe, con su propia dosis/horario/prioridad', () => {
    const principio = principioBase({ id: 'p1', nombreCanonico: 'Curcumina' });
    const ck = conocimientoBase({ principioActivoId: 'p1', prioridad: 'alta', horario: 'desayuno', dosisHabitual: 500, unidadDosis: 'mg' });
    const candidatos = construirCandidatosParaObjetivo('Disminuir inflamación', true, [ck], new Map([['p1', principio]]), new Map());
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].nombre).toBe('Curcumina');
    expect(candidatos[0].prioridad).toBe('alta');
    expect(candidatos[0].horarioRecomendado).toBe('desayuno');
    expect(candidatos[0].dosisConocimiento?.habitual).toBe(500);
  });

  it('cae en la lista heredada (SUGERENCIAS_POR_OBJETIVO) cuando no hay conocimiento_clinico validado', () => {
    const candidatos = construirCandidatosParaObjetivo('Disminuir inflamación', true, [], new Map(), new Map());
    expect(candidatos.length).toBeGreaterThan(0);
    expect(candidatos.every(c => c.disponibleEnBaseValidada === false)).toBe(true);
  });

  it('marca advertencia si el principio referenciado por conocimiento_clinico ya no está validado', () => {
    const ck = conocimientoBase({ principioActivoId: 'no-existe' });
    const candidatos = construirCandidatosParaObjetivo('Disminuir inflamación', true, [ck], new Map(), new Map());
    expect(candidatos[0].disponibleEnBaseValidada).toBe(false);
    expect(candidatos[0].advertenciasIniciales.length).toBeGreaterThan(0);
  });
});

describe('excluirPorContraindicaciones — Regla 5', () => {
  it('excluye un candidato contraindicado en oncológico si el paciente tiene antecedentes compatibles', () => {
    const c = candidatoBase();
    const flags: FlagsContraindicacion = { contraindicadoEmbarazo: null, contraindicadoLactancia: null, contraindicadoOncologico: true, precaucionAnticoagulacion: false, precaucionAntihipertensivos: false, precaucionHipoglucemiantes: false };
    const r = excluirPorContraindicaciones([c], { alergias: null, medicamentosActuales: null, antecedentesPersonales: 'Paciente oncológico en quimioterapia', antecedentesFamiliares: null }, new Map([['p1', flags]]));
    expect(r.incluidos).toHaveLength(0);
    expect(r.excluidos).toHaveLength(1);
    expect(r.excluidos[0].tipo).toBe('contraindicacion');
  });

  it('excluye por contraindicación de embarazo cuando los antecedentes lo registran', () => {
    const c = candidatoBase();
    const flags: FlagsContraindicacion = { contraindicadoEmbarazo: true, contraindicadoLactancia: null, contraindicadoOncologico: null, precaucionAnticoagulacion: false, precaucionAntihipertensivos: false, precaucionHipoglucemiantes: false };
    const r = excluirPorContraindicaciones([c], { alergias: null, medicamentosActuales: null, antecedentesPersonales: 'Paciente cursando embarazo', antecedentesFamiliares: null }, new Map([['p1', flags]]));
    expect(r.incluidos).toHaveLength(0);
  });

  it('no excluye por precaución de anticoagulación: sólo agrega advertencia', () => {
    const c = candidatoBase();
    const flags: FlagsContraindicacion = { contraindicadoEmbarazo: null, contraindicadoLactancia: null, contraindicadoOncologico: null, precaucionAnticoagulacion: true, precaucionAntihipertensivos: false, precaucionHipoglucemiantes: false };
    const r = excluirPorContraindicaciones([c], { alergias: null, medicamentosActuales: 'Warfarina 5mg', antecedentesPersonales: null, antecedentesFamiliares: null }, new Map([['p1', flags]]));
    expect(r.incluidos).toHaveLength(1);
    expect(r.excluidos).toHaveLength(0);
    expect(r.advertenciasPrecaucion.get('Principio X')).toHaveLength(1);
  });

  it('incluye sin cambios si no hay contexto de contraindicaciones', () => {
    const r = excluirPorContraindicaciones([candidatoBase()], null, new Map());
    expect(r.incluidos).toHaveLength(1);
  });

  it('incluye sin cambios un candidato sin principio resuelto (no se puede evaluar)', () => {
    const c = candidatoBase({ principio: null, disponibleEnBaseValidada: false });
    const r = excluirPorContraindicaciones([c], { alergias: null, medicamentosActuales: null, antecedentesPersonales: 'oncologico', antecedentesFamiliares: null }, new Map());
    expect(r.incluidos).toHaveLength(1);
  });
});

describe('consolidarDuplicados — Regla 6', () => {
  it('consolida el mismo principio candidato a dos objetivos distintos en una sola entrada', () => {
    const a = candidatoBase({ objetivos: ['Objetivo A'], prioridad: 'media' });
    const b = candidatoBase({ objetivos: ['Objetivo B'], prioridad: 'alta' });
    const r = consolidarDuplicados([a, b]);
    expect(r.consolidados).toHaveLength(1);
    expect(r.consolidados[0].objetivos.sort()).toEqual(['Objetivo A', 'Objetivo B']);
    expect(r.consolidados[0].prioridad).toBe('alta');
    expect(r.excluidos).toHaveLength(1);
    expect(r.excluidos[0].tipo).toBe('duplicidad');
  });

  it('no consolida principios con nombres distintos', () => {
    const a = candidatoBase({ nombre: 'A' });
    const b = candidatoBase({ nombre: 'B' });
    const r = consolidarDuplicados([a, b]);
    expect(r.consolidados).toHaveLength(2);
    expect(r.excluidos).toHaveLength(0);
  });
});

describe('excluirAlternativasIncompatiblesPorObjetivo — Regla 7', () => {
  it('excluye la alternativa de menor prioridad entre dos candidatos incompatibles del mismo objetivo', () => {
    const a = candidatoBase({ nombre: 'A', prioridad: 'alta', principio: principioBase({ nombreCanonico: 'A', incompatibilidadesNombres: ['B'] }) });
    const b = candidatoBase({ nombre: 'B', prioridad: 'baja', principio: principioBase({ nombreCanonico: 'B' }) });
    const r = excluirAlternativasIncompatiblesPorObjetivo([a, b]);
    expect(r.seleccionados.map(c => c.nombre)).toEqual(['A']);
    expect(r.excluidos[0].nombre).toBe('B');
    expect(r.excluidos[0].tipo).toBe('incompatibilidad');
  });

  it('no excluye candidatos compatibles entre sí', () => {
    const a = candidatoBase({ nombre: 'A', principio: principioBase({ nombreCanonico: 'A' }) });
    const b = candidatoBase({ nombre: 'B', principio: principioBase({ nombreCanonico: 'B' }) });
    const r = excluirAlternativasIncompatiblesPorObjetivo([a, b]);
    expect(r.seleccionados).toHaveLength(2);
  });
});

describe('completarSeleccion — Reglas 8, 9, 11, 12', () => {
  it('usa la dosis de conocimiento_clinico cuando está cargada, antes que la del principio', () => {
    const c = candidatoBase({ dosisConocimiento: { habitual: 300, minima: null, maxima: null, unidad: 'mg' } });
    const r = completarSeleccion(c, null, new Map(), new Map(), REGLAS_FORMULACION_DEFECTO);
    expect(r.dosisElegida).toEqual({ valor: 300, unidad: 'mg' });
    expect(r.fuenteDosis).toBe('usual');
  });

  it('cae en la dosis usual del principio si conocimiento_clinico no trae dosis', () => {
    const c = candidatoBase({ principio: principioBase({ dosisUsual: { valor: 250, unidad: 'mg' } }) });
    const r = completarSeleccion(c, null, new Map(), new Map(), REGLAS_FORMULACION_DEFECTO);
    expect(r.dosisElegida).toEqual({ valor: 250, unidad: 'mg' });
  });

  it('agrega advertencia si no hay ninguna dosis disponible', () => {
    const c = candidatoBase();
    const r = completarSeleccion(c, null, new Map(), new Map(), REGLAS_FORMULACION_DEFECTO);
    expect(r.advertencias.some(a => a.codigo.startsWith('sin-dosis'))).toBe(true);
  });

  it('toma la duración sugerida del mapa de duraciones habituales por principio', () => {
    const c = candidatoBase({ principio: principioBase({ id: 'p1', dosisUsual: { valor: 100, unidad: 'mg' } }) });
    const r = completarSeleccion(c, null, new Map([['p1', '8 semanas']]), new Map(), REGLAS_FORMULACION_DEFECTO);
    expect(r.duracionSugerida).toBe('8 semanas');
  });

  it('adjunta advertencias de precaución ya calculadas', () => {
    const c = candidatoBase({ nombre: 'Principio X', principio: principioBase({ dosisUsual: { valor: 100, unidad: 'mg' } }) });
    const advertencias = new Map([['Principio X', [{ codigo: 'precaucion-x', descripcion: 'aviso', fuente: 'precaucion' }]]]);
    const r = completarSeleccion(c, null, new Map(), advertencias, REGLAS_FORMULACION_DEFECTO);
    expect(r.advertencias.some(a => a.codigo === 'precaucion-x')).toBe(true);
  });

  it('sin principio resuelto, no calcula presentación ni sabor', () => {
    const c = candidatoBase({ principio: null, disponibleEnBaseValidada: false });
    const r = completarSeleccion(c, null, new Map(), new Map(), REGLAS_FORMULACION_DEFECTO);
    expect(r.decisionPresentacion).toBeNull();
    expect(r.decisionSabor).toBeNull();
  });
});

describe('agruparPreparados — Regla 10', () => {
  function seleccion(overrides: Partial<PrincipioSeleccionMPI> = {}): PrincipioSeleccionMPI {
    return {
      ...candidatoBase(), dosisElegida: null, fuenteDosis: 'sin_dato', duracionSugerida: null,
      decisionPresentacion: null, decisionSabor: null, advertencias: [],
      ...overrides,
    };
  }

  it('agrupa por horario recomendado', () => {
    const a = seleccion({ nombre: 'A', horarioRecomendado: 'desayuno', principio: principioBase({ nombreCanonico: 'A' }) });
    const b = seleccion({ nombre: 'B', horarioRecomendado: 'cena', principio: principioBase({ nombreCanonico: 'B' }) });
    const preparados = agruparPreparados([a, b]);
    expect(preparados).toHaveLength(2);
    expect(preparados.find(p => p.horario === 'desayuno')?.principios).toEqual(['A']);
    expect(preparados.find(p => p.horario === 'cena')?.principios).toEqual(['B']);
  });

  it('dentro del mismo horario, separa incompatibles en preparados distintos', () => {
    const a = seleccion({ nombre: 'A', horarioRecomendado: 'desayuno', principio: principioBase({ nombreCanonico: 'A', incompatibilidadesNombres: ['B'] }) });
    const b = seleccion({ nombre: 'B', horarioRecomendado: 'desayuno', principio: principioBase({ nombreCanonico: 'B' }) });
    const preparados = agruparPreparados([a, b]);
    const delDesayuno = preparados.filter(p => p.horario === 'desayuno');
    expect(delDesayuno).toHaveLength(2);
  });
});

describe('ordenarTerapeuticamente — Regla 13', () => {
  function seleccion(overrides: Partial<PrincipioSeleccionMPI> = {}): PrincipioSeleccionMPI {
    return {
      ...candidatoBase(), dosisElegida: null, fuenteDosis: 'sin_dato', duracionSugerida: null,
      decisionPresentacion: null, decisionSabor: null, advertencias: [],
      ...overrides,
    };
  }

  it('ordena objetivo principal antes que secundario', () => {
    const secundario = seleccion({ nombre: 'Secundario', esObjetivoPrincipal: false });
    const principal = seleccion({ nombre: 'Principal', esObjetivoPrincipal: true });
    expect(ordenarTerapeuticamente([secundario, principal])).toEqual(['Principal', 'Secundario']);
  });

  it('dentro del mismo carácter principal/secundario, ordena por prioridad descendente', () => {
    const baja = seleccion({ nombre: 'Baja', prioridad: 'baja' });
    const urgente = seleccion({ nombre: 'Urgente', prioridad: 'urgente' });
    expect(ordenarTerapeuticamente([baja, urgente])).toEqual(['Urgente', 'Baja']);
  });

  it('a igual prioridad, respeta orden_sugerido ascendente', () => {
    const segundo = seleccion({ nombre: 'Segundo', ordenSugerido: 2 });
    const primero = seleccion({ nombre: 'Primero', ordenSugerido: 1 });
    expect(ordenarTerapeuticamente([segundo, primero])).toEqual(['Primero', 'Segundo']);
  });
});

function usarMock(queue: any[]) {
  const { client } = crearSupabaseMock({ id: 'user-1' }, queue);
  return client as any;
}

describe('generarProtocoloSugerido — orquestación de sólo lectura', () => {
  it('no disponible si los objetivos no están confirmados, sin consultar el resto de las fuentes', async () => {
    const client = usarMock([
      { data: null, error: null }, // diagnostico
      { data: null, error: null }, // ipt
      { data: null, error: null }, // fase
      { data: { fase: 'restore', objetivos: ['Disminuir inflamación'], confirmado: false }, error: null }, // objetivos
    ]);
    const protocolo = await generarProtocoloSugerido(client, 'tenant-1', 'paciente-1');
    expect(protocolo.disponible).toBe(false);
    expect(protocolo.motivoNoDisponible).toMatch(/objetivos/);
  });

  it('no disponible si la fase no está confirmada', async () => {
    const client = usarMock([
      { data: null, error: null },
      { data: null, error: null },
      { data: { fase_seleccionada: 'restore', confirmado: false }, error: null },
      { data: { fase: 'restore', objetivos: ['Disminuir inflamación'], confirmado: true }, error: null },
    ]);
    const protocolo = await generarProtocoloSugerido(client, 'tenant-1', 'paciente-1');
    expect(protocolo.disponible).toBe(false);
    expect(protocolo.motivoNoDisponible).toMatch(/fase/);
  });

  it('genera un protocolo cuando fase y objetivos están confirmados, con prioridadTerapeutica desde el IPT confirmado', async () => {
    const client = usarMock([
      { data: null, error: null }, // diagnostico
      { data: null, error: null }, // ipt (contexto clínico: sólo confirmado, acá null)
      { data: { fase_seleccionada: 'restore', confirmado: true }, error: null }, // fase
      { data: { fase: 'restore', objetivos: ['Disminuir inflamación'], confirmado: true }, error: null }, // objetivos
      { data: [], error: null }, // principios_activos validados (ninguno)
      { data: null, error: null }, // preferencias
      { data: { alergias: null, medicamentos_actuales: null, antecedentes_personales: null, antecedentes_familiares: null }, error: null }, // pacientes (contraindicaciones)
      { data: { confirmado: true, resultado: [{ alteracionId: 'a1', base: 1, jerarquico: 1, final: 70, banda: 'alta' }] }, error: null }, // ipt_evaluaciones (resultado completo)
      { data: [], error: null }, // conocimiento_clinico para el único objetivo
      { data: [], error: null }, // obtenerFlagsContraindicacion (ids vacíos -> igual pasa por el mock)
      { data: [], error: null }, // obtenerDuracionesHabituales
    ]);
    const protocolo = await generarProtocoloSugerido(client, 'tenant-1', 'paciente-1');
    expect(protocolo.disponible).toBe(true);
    expect(protocolo.prioridadTerapeutica).toBe('alta');
    expect(protocolo.objetivosPrincipales.length + protocolo.objetivosSecundarios.length).toBe(1);
    expect(protocolo.principiosSeleccionados.length).toBeGreaterThan(0);
    expect(protocolo.principiosSeleccionados.every(p => !p.disponibleEnBaseValidada)).toBe(true);
    expect(protocolo.ordenTerapeutico.length).toBe(protocolo.principiosSeleccionados.length);
  });

  it('prioridadTerapeutica queda en null si el IPT no está confirmado, sin bloquear el resto del protocolo', async () => {
    const client = usarMock([
      { data: null, error: null },
      { data: null, error: null },
      { data: { fase_seleccionada: 'restore', confirmado: true }, error: null },
      { data: { fase: 'restore', objetivos: ['Disminuir inflamación'], confirmado: true }, error: null },
      { data: [], error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: { confirmado: false, resultado: [] }, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]);
    const protocolo = await generarProtocoloSugerido(client, 'tenant-1', 'paciente-1');
    expect(protocolo.disponible).toBe(true);
    expect(protocolo.prioridadTerapeutica).toBeNull();
  });
});
