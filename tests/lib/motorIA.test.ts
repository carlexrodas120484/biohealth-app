import { describe, it, expect } from 'vitest';
import {
  generarResumenClinico, calcularPrioridadClinica, generarRecomendacionesOrtomoleculares,
  detectarEstudiosFaltantes, clasificarAlertasFormulacion, sugerirProximoPaso, generarInformeIA,
  VERSION_MOTOR_IA, ADVERTENCIA_IA, type ContextoMotorIA,
} from '@/lib/clinica/motorIA';
import { construirIndicadores } from '@/lib/clinica/dashboard';
import type { PatronFuncional } from '@/lib/clinica/patrones';
import type { Alerta } from '@/lib/clinica/formulacion';

function patron(overrides: Partial<PatronFuncional> = {}): PatronFuncional {
  return {
    codigo: 'metabolico-glucemico', nombre: 'Alteración glucémica o metabólica', puntaje: 80,
    nivel: 'alta', prioridad: 'alta', evidencias: [], estado: 'confirmado',
    ...overrides,
  } as PatronFuncional;
}

function contextoBase(overrides: Partial<ContextoMotorIA> = {}): ContextoMotorIA {
  return {
    paciente: {
      nombreCompleto: 'Ana Gómez', edad: 35, sexo: 'femenino', motivoConsulta: 'Fatiga crónica',
      alergias: null, medicamentosActuales: null, antecedentesPersonales: null, antecedentesFamiliares: null,
    },
    historiaCompletada: true,
    resumenCuestionario: null,
    diagnosticoConfirmado: true,
    impresionDiagnostica: '',
    patrones: [],
    objetivosConfirmados: [],
    fases: [],
    formulacion: null,
    nutricion: null,
    indicadores: construirIndicadores(null, 'femenino'),
    ultimoControl: null,
    ...overrides,
  };
}

describe('motorIA — generarResumenClinico', () => {
  it('incluye datos básicos, motivo de consulta y estado de historia', () => {
    const resumen = generarResumenClinico(contextoBase());
    expect(resumen[0]).toContain('Ana Gómez');
    expect(resumen.some(l => l.includes('Fatiga crónica'))).toBe(true);
    expect(resumen.some(l => l.includes('Historia clínica completa'))).toBe(true);
  });

  it('refleja historia incompleta y diagnóstico pendiente', () => {
    const resumen = generarResumenClinico(contextoBase({ historiaCompletada: false, diagnosticoConfirmado: false }));
    expect(resumen.some(l => l.includes('incompleta'))).toBe(true);
    expect(resumen.some(l => l.includes('pendiente de confirmación'))).toBe(true);
  });

  it('incluye sistemas alterados del cuestionario cuando existen', () => {
    const resumen = generarResumenClinico(contextoBase({ resumenCuestionario: { sistemasAlterados: ['Digestivo', 'Hormonal'], topSintomas: [] } }));
    expect(resumen.some(l => l.includes('Digestivo') && l.includes('Hormonal'))).toBe(true);
  });

  it('nunca inventa datos: sin motivo de consulta, no aparece esa línea', () => {
    const resumen = generarResumenClinico(contextoBase({ paciente: { ...contextoBase().paciente, motivoConsulta: null } }));
    expect(resumen.some(l => l.startsWith('Motivo de consulta'))).toBe(false);
  });
});

describe('motorIA — calcularPrioridadClinica', () => {
  it('prioridad alta cuando un indicador está en rojo', () => {
    const indicadores = construirIndicadores({ fecha: '2026-01-01', glucemiaMgDl: 160 }, 'femenino');
    const r = calcularPrioridadClinica(contextoBase({ indicadores }));
    expect(r.prioridad).toBe('alta');
    expect(r.porQue.length).toBeGreaterThan(0);
  });

  it('prioridad alta cuando hay bandera roja nueva en el último control, aunque los indicadores estén verdes', () => {
    const r = calcularPrioridadClinica(contextoBase({ ultimoControl: { decision: 'reformular', banderaRojaNueva: true } }));
    expect(r.prioridad).toBe('alta');
    expect(r.porQue).toContain('bandera roja');
  });

  it('prioridad media cuando el peor semáforo es amarillo', () => {
    const indicadores = construirIndicadores({ fecha: '2026-01-01', ldlMgDl: 120 }, 'femenino');
    const r = calcularPrioridadClinica(contextoBase({ indicadores }));
    expect(r.prioridad).toBe('media');
  });

  it('prioridad baja sin datos ni alertas', () => {
    const r = calcularPrioridadClinica(contextoBase());
    expect(r.prioridad).toBe('baja');
  });
});

describe('motorIA — recomendaciones ortomoleculares', () => {
  it('sugiere principios activos por cada objetivo confirmado, sin proponer dosis', () => {
    const recomendaciones = generarRecomendacionesOrtomoleculares(contextoBase({ objetivosConfirmados: ['Reparar mucosa intestinal', 'Disminuir inflamación'] }));
    expect(recomendaciones.length).toBeGreaterThan(0);
    expect(recomendaciones.some(r => r.nombre === 'L-glutamina')).toBe(true);
    expect(recomendaciones.some(r => r.nombre === 'Omega-3 (EPA + DHA)')).toBe(true);
    for (const r of recomendaciones) {
      expect(r).not.toHaveProperty('dosis');
      expect(r.precaucion.length).toBeGreaterThan(0);
    }
  });

  it('sin objetivos confirmados no sugiere nada', () => {
    expect(generarRecomendacionesOrtomoleculares(contextoBase())).toHaveLength(0);
  });
});

describe('motorIA — estudios faltantes', () => {
  it('recomienda el estudio cuando el patrón está confirmado y no hay indicador que lo respalde', () => {
    const faltantes = detectarEstudiosFaltantes(contextoBase({ patrones: [patron({ codigo: 'metabolico-glucemico' })] }));
    expect(faltantes.some(f => f.includes('HbA1c'))).toBe(true);
  });

  it('no recomienda el estudio si ya hay un indicador de laboratorio cargado para ese patrón', () => {
    const indicadores = construirIndicadores({ fecha: '2026-01-01', glucemiaMgDl: 95 }, 'femenino');
    const faltantes = detectarEstudiosFaltantes(contextoBase({ patrones: [patron({ codigo: 'metabolico-glucemico' })], indicadores }));
    expect(faltantes.some(f => f.includes('HbA1c'))).toBe(false);
  });

  it('ignora patrones sugeridos (no confirmados)', () => {
    const faltantes = detectarEstudiosFaltantes(contextoBase({ patrones: [patron({ estado: 'sugerido' })] }));
    expect(faltantes).toHaveLength(0);
  });
});

describe('motorIA — interacciones y contraindicaciones', () => {
  it('clasifica alertas de medicación/incompatibilidad como interacciones', () => {
    const alertas: Alerta[] = [
      { codigo: 'anticoagulantes', descripcion: 'Revisar anticoagulantes.', fuente: 'medicacion' },
      { codigo: 'incompatible-x', descripcion: 'Incompatibles.', fuente: 'incompatibilidad' },
    ];
    const { interacciones, contraindicaciones } = clasificarAlertasFormulacion(alertas);
    expect(interacciones).toHaveLength(2);
    expect(contraindicaciones).toHaveLength(0);
  });

  it('clasifica alertas de alergias/antecedentes como contraindicaciones', () => {
    const alertas: Alerta[] = [
      { codigo: 'alergias', descripcion: 'Alergia registrada.', fuente: 'alergias' },
      { codigo: 'hepatopatia', descripcion: 'Antecedente hepático.', fuente: 'antecedentes' },
    ];
    const { interacciones, contraindicaciones } = clasificarAlertasFormulacion(alertas);
    expect(contraindicaciones).toHaveLength(2);
    expect(interacciones).toHaveLength(0);
  });

  it('lista vacía sin alertas', () => {
    const { interacciones, contraindicaciones } = clasificarAlertasFormulacion([]);
    expect(interacciones).toHaveLength(0);
    expect(contraindicaciones).toHaveLength(0);
  });
});

describe('motorIA — próximo paso sugerido', () => {
  it('prioriza completar la historia si está incompleta', () => {
    const paso = sugerirProximoPaso(contextoBase({ historiaCompletada: false }));
    expect(paso.titulo).toBe('Completar la historia clínica');
  });

  it('luego confirmar el diagnóstico', () => {
    const paso = sugerirProximoPaso(contextoBase({ diagnosticoConfirmado: false }));
    expect(paso.titulo).toBe('Confirmar el diagnóstico funcional');
  });

  it('luego activar una fase del plan', () => {
    const paso = sugerirProximoPaso(contextoBase({ fases: [{ nombre: 'Restore', estado: 'sugerida', objetivo: 'x' }] }));
    expect(paso.titulo).toBe('Activar una fase del plan terapéutico');
  });

  it('luego aprobar la formulación pendiente', () => {
    const paso = sugerirProximoPaso(contextoBase({
      fases: [{ nombre: 'Restore', estado: 'activa', objetivo: 'x' }],
      formulacion: { estado: 'revisada', ingredientesNombres: [], alertasMotor: [] },
    }));
    expect(paso.titulo).toBe('Revisar y aprobar la formulación ortomolecular');
  });

  it('luego aprobar el plan nutricional pendiente', () => {
    const paso = sugerirProximoPaso(contextoBase({
      fases: [{ nombre: 'Restore', estado: 'activa', objetivo: 'x' }],
      formulacion: { estado: 'aprobada', ingredientesNombres: [], alertasMotor: [] },
      nutricion: { estado: 'borrador', objetivoClinico: null },
    }));
    expect(paso.titulo).toBe('Revisar y aprobar el plan nutricional');
  });

  it('cuando todo está al día, sugiere continuar con el control habitual', () => {
    const paso = sugerirProximoPaso(contextoBase({ fases: [{ nombre: 'Restore', estado: 'activa', objetivo: 'x' }] }));
    expect(paso.titulo).toBe('Continuar con el control de seguimiento habitual');
  });
});

describe('motorIA — generarInformeIA (integración)', () => {
  it('arma un informe completo con los 10 componentes pedidos, todo como sugerencia', () => {
    const informe = generarInformeIA(contextoBase({ patrones: [patron()], objetivosConfirmados: ['Disminuir inflamación'] }));
    expect(informe.version).toBe(VERSION_MOTOR_IA);
    expect(informe.advertencia).toBe(ADVERTENCIA_IA);
    expect(Array.isArray(informe.resumenClinico)).toBe(true);
    expect(Array.isArray(informe.principalesProblemas)).toBe(true);
    expect(['alta', 'media', 'baja']).toContain(informe.prioridadClinica);
    expect(informe.porQuePrioridad.length).toBeGreaterThan(0);
    expect(Array.isArray(informe.recomendacionesOrtomoleculares)).toBe(true);
    expect(Array.isArray(informe.estudiosFaltantes)).toBe(true);
    expect(Array.isArray(informe.interaccionesPosibles)).toBe(true);
    expect(Array.isArray(informe.contraindicaciones)).toBe(true);
    expect(Array.isArray(informe.alertas)).toBe(true);
    expect(informe.proximoPaso.titulo.length).toBeGreaterThan(0);
  });

  it('con un contexto totalmente vacío no lanza excepciones y devuelve estructuras vacías coherentes', () => {
    const informe = generarInformeIA(contextoBase({ diagnosticoConfirmado: false }));
    expect(informe.principalesProblemas).toHaveLength(0);
    expect(informe.recomendacionesOrtomoleculares).toHaveLength(0);
    expect(informe.estudiosFaltantes).toHaveLength(0);
    expect(informe.interaccionesPosibles).toHaveLength(0);
    expect(informe.contraindicaciones).toHaveLength(0);
  });

  it('la advertencia deja explícito que no reemplaza el criterio médico ni actúa automáticamente', () => {
    expect(ADVERTENCIA_IA.toLowerCase()).toContain('no reemplaza');
    expect(ADVERTENCIA_IA.toLowerCase()).toContain('no se aplican automáticamente');
  });
});
