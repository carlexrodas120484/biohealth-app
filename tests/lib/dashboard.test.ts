import { describe, it, expect } from 'vitest';
import {
  clasificarIMC, clasificarCintura, clasificarPresionArterial, clasificarGlucemia, clasificarHbA1c,
  clasificarTrigliceridos, clasificarHDL, clasificarLDL, clasificarVitaminaD, clasificarHOMA, clasificarPCR, clasificarFerritina,
  construirIndicadores, calcularRiesgoCardiovascular, calcularRiesgoMetabolico, calcularInflamacion,
  calcularEstadoIntestinal, calcularEstadoHormonal, calcularEstadoMitocondrial,
  generarAlertasClinicas, detectarInconsistencias, priorizarProblemas, generarRecordatorios, sugerirProximoControl,
  type ContextoDashboard,
} from '@/lib/clinica/dashboard';
import type { PatronFuncional } from '@/lib/clinica/patrones';

function patron(overrides: Partial<PatronFuncional> = {}): PatronFuncional {
  return {
    codigo: 'intestinal', nombre: 'Disbiosis o alteración intestinal', puntaje: 80,
    nivel: 'alta', prioridad: 'alta', evidencias: [], estado: 'confirmado',
    ...overrides,
  } as PatronFuncional;
}

describe('lib/clinica/dashboard — clasificadores individuales', () => {
  it('IMC: verde en rango normal, amarillo en sobrepeso, rojo en obesidad severa', () => {
    expect(clasificarIMC(65, 170).semaforo).toBe('verde');
    expect(clasificarIMC(80, 170).semaforo).toBe('amarillo');
    expect(clasificarIMC(110, 170).semaforo).toBe('rojo');
  });

  it('Cintura: usa umbrales distintos por sexo', () => {
    expect(clasificarCintura(90, 'masculino').semaforo).toBe('verde');
    expect(clasificarCintura(90, 'femenino').semaforo).toBe('rojo');
  });

  it('Presión arterial: normal/elevada/hipertensión', () => {
    expect(clasificarPresionArterial(110, 70).semaforo).toBe('verde');
    expect(clasificarPresionArterial(125, 82).semaforo).toBe('amarillo');
    expect(clasificarPresionArterial(150, 95).semaforo).toBe('rojo');
  });

  it('Glucemia: normal/prediabetes/diabetes', () => {
    expect(clasificarGlucemia(90).semaforo).toBe('verde');
    expect(clasificarGlucemia(110).semaforo).toBe('amarillo');
    expect(clasificarGlucemia(140).semaforo).toBe('rojo');
  });

  it('HbA1c: normal/prediabetes/diabetes', () => {
    expect(clasificarHbA1c(5.2).semaforo).toBe('verde');
    expect(clasificarHbA1c(6.0).semaforo).toBe('amarillo');
    expect(clasificarHbA1c(7.0).semaforo).toBe('rojo');
  });

  it('Triglicéridos, HDL, LDL, Vitamina D, HOMA, PCR, Ferritina cubren las 3 zonas', () => {
    expect(clasificarTrigliceridos(100).semaforo).toBe('verde');
    expect(clasificarTrigliceridos(170).semaforo).toBe('amarillo');
    expect(clasificarTrigliceridos(250).semaforo).toBe('rojo');

    expect(clasificarHDL(55, 'masculino').semaforo).toBe('verde');
    expect(clasificarHDL(37, 'masculino').semaforo).toBe('amarillo');
    expect(clasificarHDL(20, 'masculino').semaforo).toBe('rojo');

    expect(clasificarLDL(80).semaforo).toBe('verde');
    expect(clasificarLDL(120).semaforo).toBe('amarillo');
    expect(clasificarLDL(180).semaforo).toBe('rojo');

    expect(clasificarVitaminaD(40).semaforo).toBe('verde');
    expect(clasificarVitaminaD(25).semaforo).toBe('amarillo');
    expect(clasificarVitaminaD(10).semaforo).toBe('rojo');

    expect(clasificarHOMA(1.5).semaforo).toBe('verde');
    expect(clasificarHOMA(3).semaforo).toBe('amarillo');
    expect(clasificarHOMA(5).semaforo).toBe('rojo');

    expect(clasificarPCR(0.5).semaforo).toBe('verde');
    expect(clasificarPCR(2).semaforo).toBe('amarillo');
    expect(clasificarPCR(5).semaforo).toBe('rojo');

    expect(clasificarFerritina(100, 'masculino').semaforo).toBe('verde');
    expect(clasificarFerritina(15, 'masculino').semaforo).toBe('amarillo');
    expect(clasificarFerritina(5, 'masculino').semaforo).toBe('rojo');
  });

  it('cada clasificación incluye una explicación clínica no vacía', () => {
    expect(clasificarGlucemia(140).explicacion.length).toBeGreaterThan(10);
    expect(clasificarPCR(5).explicacion).toContain('mg/L');
  });
});

describe('lib/clinica/dashboard — construirIndicadores', () => {
  it('devuelve los 13 indicadores en sin_datos cuando no hay ningún registro de laboratorio', () => {
    const indicadores = construirIndicadores(null, 'femenino');
    expect(indicadores).toHaveLength(13);
    expect(indicadores.every(i => i.semaforo === 'sin_datos')).toBe(true);
  });

  it('marca sin_datos sólo los campos faltantes cuando el registro es parcial', () => {
    const indicadores = construirIndicadores({ fecha: '2026-01-01', glucemiaMgDl: 95 }, 'masculino');
    const glucemia = indicadores.find(i => i.codigo === 'glucemia')!;
    const pcr = indicadores.find(i => i.codigo === 'pcr')!;
    expect(glucemia.semaforo).not.toBe('sin_datos');
    expect(pcr.semaforo).toBe('sin_datos');
  });

  it('calcula IMC sólo si hay peso y talla juntos', () => {
    const soloPeso = construirIndicadores({ fecha: '2026-01-01', pesoKg: 70 }, 'femenino');
    expect(soloPeso.find(i => i.codigo === 'imc')!.semaforo).toBe('sin_datos');

    const ambos = construirIndicadores({ fecha: '2026-01-01', pesoKg: 70, tallaCm: 170 }, 'femenino');
    expect(ambos.find(i => i.codigo === 'imc')!.valor).toBeCloseTo(24.2, 1);
  });
});

describe('lib/clinica/dashboard — semáforos de sistema', () => {
  it('riesgo cardiovascular combina indicadores + patrón confirmado', () => {
    const indicadores = construirIndicadores({ fecha: '2026-01-01', presionSistolica: 150, presionDiastolica: 95 }, 'masculino');
    const r = calcularRiesgoCardiovascular(indicadores, []);
    expect(r.semaforo).toBe('rojo');
    expect(r.explicacion).toContain('mmHg');
  });

  it('riesgo metabólico sube a rojo con glucemia diabética', () => {
    const indicadores = construirIndicadores({ fecha: '2026-01-01', glucemiaMgDl: 140 }, 'femenino');
    const r = calcularRiesgoMetabolico(indicadores, []);
    expect(r.semaforo).toBe('rojo');
  });

  it('inflamación usa PCR y el patrón inflamacion-sistemica', () => {
    const indicadores = construirIndicadores(null, 'femenino');
    const r = calcularInflamacion(indicadores, [patron({ codigo: 'inflamacion-sistemica', nivel: 'muy_alta' })]);
    expect(r.semaforo).toBe('rojo');
    expect(r.explicacion).toContain('inflamación sistémica');
  });

  it('estado intestinal/hormonal/mitocondrial devuelven sin_datos sin patrones confirmados', () => {
    expect(calcularEstadoIntestinal([]).semaforo).toBe('sin_datos');
    expect(calcularEstadoHormonal([]).semaforo).toBe('sin_datos');
    expect(calcularEstadoMitocondrial([]).semaforo).toBe('sin_datos');
  });

  it('estado intestinal en rojo con patrón intestinal confirmado de nivel alto', () => {
    const r = calcularEstadoIntestinal([patron({ codigo: 'intestinal', nivel: 'alta' })]);
    expect(r.semaforo).toBe('rojo');
    expect(r.indicadoresConsiderados).toContain('intestinal');
  });

  it('estado hormonal ignora patrones sugeridos (no confirmados)', () => {
    const r = calcularEstadoHormonal([patron({ codigo: 'hormonal', estado: 'sugerido' })]);
    expect(r.semaforo).toBe('sin_datos');
  });
});

function contextoBase(overrides: Partial<ContextoDashboard> = {}): ContextoDashboard {
  return {
    paciente: { sexo: 'femenino' },
    historiaCompletada: true,
    diagnosticoConfirmado: true,
    patrones: [],
    fasesActivas: 1,
    fasesSugeridas: 1,
    formulacionEstado: 'aprobada',
    nutricionEstado: 'aprobado',
    indicadores: construirIndicadores(null, 'femenino'),
    ...overrides,
  };
}

describe('lib/clinica/dashboard — alertas, inconsistencias y priorización', () => {
  it('genera una alerta por cada indicador rojo/amarillo', () => {
    const indicadores = construirIndicadores({ fecha: '2026-01-01', glucemiaMgDl: 140, pcrMgL: 5 }, 'femenino');
    const alertas = generarAlertasClinicas(contextoBase({ indicadores }));
    expect(alertas.some(a => a.codigo === 'indicador-glucemia')).toBe(true);
    expect(alertas.some(a => a.codigo === 'indicador-pcr')).toBe(true);
  });

  it('genera una alerta por patrón confirmado de nivel alto/muy alto', () => {
    const alertas = generarAlertasClinicas(contextoBase({ patrones: [patron({ nivel: 'muy_alta' })] }));
    expect(alertas.some(a => a.codigo === 'patron-intestinal' && a.severidad === 'rojo')).toBe(true);
  });

  it('detecta inconsistencia: formulación aprobada sin diagnóstico confirmado', () => {
    const inc = detectarInconsistencias(contextoBase({ diagnosticoConfirmado: false }));
    expect(inc.some(i => i.codigo === 'inconsistencia-formulacion-sin-diagnostico')).toBe(true);
  });

  it('detecta inconsistencia: nutrición aprobada con historia incompleta', () => {
    const inc = detectarInconsistencias(contextoBase({ historiaCompletada: false }));
    expect(inc.some(i => i.codigo === 'inconsistencia-nutricion-sin-historia')).toBe(true);
  });

  it('detecta inconsistencia: fases sugeridas pero ninguna activa, con diagnóstico confirmado', () => {
    const inc = detectarInconsistencias(contextoBase({ fasesActivas: 0, fasesSugeridas: 2 }));
    expect(inc.some(i => i.codigo === 'inconsistencia-plan-sin-activar')).toBe(true);
  });

  it('detecta inconsistencia: diagnóstico confirmado sin ningún patrón confirmado', () => {
    const inc = detectarInconsistencias(contextoBase({ patrones: [patron({ estado: 'sugerido' })] }));
    expect(inc.some(i => i.codigo === 'inconsistencia-diagnostico-sin-patrones')).toBe(true);
  });

  it('no genera inconsistencias en un contexto perfectamente consistente', () => {
    const inc = detectarInconsistencias(contextoBase({ patrones: [patron()] }));
    expect(inc).toHaveLength(0);
  });

  it('prioriza problemas: los rojos van antes que los amarillos, cada uno con porQue y recomendación', () => {
    const indicadores = construirIndicadores({ fecha: '2026-01-01', glucemiaMgDl: 140, ldlMgDl: 120 }, 'femenino');
    const problemas = priorizarProblemas(contextoBase({ indicadores, diagnosticoConfirmado: false }));
    expect(problemas.length).toBeGreaterThan(0);
    expect(problemas[0].severidad).toBe('rojo');
    for (const p of problemas) {
      expect(p.porQue.length).toBeGreaterThan(0);
      expect(p.recomendacion.length).toBeGreaterThan(0);
      expect(p.prioridad).toBeGreaterThan(0);
    }
    // orden no decreciente de severidad
    const ordenSemaforo = { rojo: 3, amarillo: 2, verde: 1, sin_datos: 0 };
    for (let i = 1; i < problemas.length; i++) {
      expect(ordenSemaforo[problemas[i - 1].severidad]).toBeGreaterThanOrEqual(ordenSemaforo[problemas[i].severidad]);
    }
  });

  it('dashboard vacío: sin indicadores, con un patrón leve confirmado y todo consistente -> sin alertas', () => {
    const problemas = priorizarProblemas(contextoBase({ patrones: [patron({ nivel: 'leve' })] }));
    expect(problemas).toHaveLength(0);
  });
});

describe('lib/clinica/dashboard — recordatorios y próximo control', () => {
  it('recuerda completar historia y confirmar diagnóstico cuando faltan', () => {
    const recordatorios = generarRecordatorios(contextoBase({ historiaCompletada: false, diagnosticoConfirmado: false, fasesActivas: 0, formulacionEstado: 'borrador', nutricionEstado: 'borrador' }));
    expect(recordatorios).toContain('Completar la historia clínica.');
    expect(recordatorios).toContain('Confirmar el diagnóstico funcional.');
    expect(recordatorios.some(r => r.includes('formulación'))).toBe(true);
    expect(recordatorios.some(r => r.includes('nutricional'))).toBe(true);
  });

  it('sin pendientes cuando todo está confirmado/aprobado', () => {
    const recordatorios = generarRecordatorios(contextoBase());
    expect(recordatorios).toHaveLength(0);
  });

  it('sugiere próximo control según la fase activa, acotado a 4 semanas', () => {
    const sugerencia = sugerirProximoControl([{ estado: 'activa', duracionEstimadaSemanas: 12 }], new Date('2026-01-01'));
    expect(sugerencia).not.toBeNull();
    expect(sugerencia!.semanas).toBe(4);
    expect(sugerencia!.fecha).toBe('2026-01-29');
  });

  it('devuelve null si no hay ninguna fase activa', () => {
    expect(sugerirProximoControl([{ estado: 'sugerida', duracionEstimadaSemanas: 6 }])).toBeNull();
  });
});
