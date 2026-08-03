import { describe, it, expect } from 'vitest';
import {
  verificarDosisFueraDeRango, verificarDuplicidadTerapeutica, verificarExcesoCapsulas, verificarExcesoGramosPorSobre,
  verificarIncompatibilidadesPresentacion, verificarHorariosImposibles, verificarExcesoPrincipiosPorPreparado,
  verificarRedundancia, evaluarIntegridadYConfianza, clasificarConfianza, calcularScore, validarPrescripcion,
  REGLAS_VCI_DEFECTO, type FactorConfianza, type AlertaVCI,
} from '@/lib/clinica/vci';
import type { PrincipioSeleccionMPI, PreparadoMPI, ProtocoloSugerido } from '@/lib/clinica/mpi';
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
    dosisConocimiento: null, horarioRecomendado: null, advertenciasIniciales: [],
    dosisElegida: { valor: 300, unidad: 'mg' }, fuenteDosis: 'usual', duracionSugerida: null,
    decisionPresentacion: null, decisionSabor: null, advertencias: [],
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

describe('verificarDosisFueraDeRango', () => {
  it('marca crítica cuando la dosis excede el máximo de conocimiento_clinico', () => {
    const c = seleccionBase({ dosisElegida: { valor: 600, unidad: 'mg' }, dosisConocimiento: { habitual: 300, minima: 100, maxima: 500, unidad: 'mg' } });
    const alertas = verificarDosisFueraDeRango([c], REGLAS_VCI_DEFECTO);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidad).toBe('critica');
    expect(alertas[0].categoria).toBe('dosis-fuera-de-rango');
    expect(alertas[0].requiereRevisionAntesDeFirmar).toBe(true);
  });

  it('marca importante cuando la dosis está cerca del máximo (>=90%) sin excederlo', () => {
    const c = seleccionBase({ dosisElegida: { valor: 460, unidad: 'mg' }, dosisConocimiento: { habitual: 300, minima: 100, maxima: 500, unidad: 'mg' } });
    const alertas = verificarDosisFueraDeRango([c], REGLAS_VCI_DEFECTO);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidad).toBe('importante');
    expect(alertas[0].requiereRevisionAntesDeFirmar).toBe(false);
  });

  it('marca importante cuando la dosis está por debajo del mínimo', () => {
    const c = seleccionBase({ dosisElegida: { valor: 50, unidad: 'mg' }, dosisConocimiento: { habitual: 300, minima: 100, maxima: 500, unidad: 'mg' } });
    const alertas = verificarDosisFueraDeRango([c], REGLAS_VCI_DEFECTO);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidad).toBe('importante');
  });

  it('usa el rango de la Base Farmacotécnica si no hay dato de conocimiento_clinico', () => {
    const c = seleccionBase({ dosisElegida: { valor: 900, unidad: 'mg' }, principio: principioBase({ dosisMaxima: { valor: 800, unidad: 'mg' } }) });
    const alertas = verificarDosisFueraDeRango([c], REGLAS_VCI_DEFECTO);
    expect(alertas[0].evidenciaOFuente).toBe('base_farmacotecnica');
  });

  it('no alerta si no hay ningún rango cargado', () => {
    const c = seleccionBase({ dosisElegida: { valor: 900, unidad: 'mg' } });
    expect(verificarDosisFueraDeRango([c], REGLAS_VCI_DEFECTO)).toEqual([]);
  });

  it('no alerta si la unidad no es convertible a mg (UI/ml)', () => {
    const c = seleccionBase({ dosisElegida: { valor: 900, unidad: 'ui' }, dosisConocimiento: { habitual: null, minima: null, maxima: 500, unidad: 'ui' } });
    expect(verificarDosisFueraDeRango([c], REGLAS_VCI_DEFECTO)).toEqual([]);
  });

  it('no alerta si no hay dosis elegida', () => {
    const c = seleccionBase({ dosisElegida: null });
    expect(verificarDosisFueraDeRango([c], REGLAS_VCI_DEFECTO)).toEqual([]);
  });

  it('dentro de rango no genera ninguna alerta', () => {
    const c = seleccionBase({ dosisElegida: { valor: 300, unidad: 'mg' }, dosisConocimiento: { habitual: 300, minima: 100, maxima: 500, unidad: 'mg' } });
    expect(verificarDosisFueraDeRango([c], REGLAS_VCI_DEFECTO)).toEqual([]);
  });
});

describe('verificarDuplicidadTerapeutica', () => {
  it('marca importante cuando dos principios distintos comparten categoría clínica', () => {
    const a = seleccionBase({ nombre: 'A', principio: principioBase({ nombreCanonico: 'A', categorias: ['Antiinflamatorio'] }) });
    const b = seleccionBase({ nombre: 'B', principio: principioBase({ nombreCanonico: 'B', categorias: ['Antiinflamatorio', 'Digestivo'] }) });
    const alertas = verificarDuplicidadTerapeutica([a, b]);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidad).toBe('importante');
    expect(alertas[0].principiosImplicados.sort()).toEqual(['A', 'B']);
  });

  it('no alerta si no comparten ninguna categoría', () => {
    const a = seleccionBase({ nombre: 'A', principio: principioBase({ nombreCanonico: 'A', categorias: ['Antiinflamatorio'] }) });
    const b = seleccionBase({ nombre: 'B', principio: principioBase({ nombreCanonico: 'B', categorias: ['Digestivo'] }) });
    expect(verificarDuplicidadTerapeutica([a, b])).toEqual([]);
  });

  it('no alerta si algún principio no tiene categorías cargadas', () => {
    const a = seleccionBase({ nombre: 'A', principio: principioBase({ nombreCanonico: 'A', categorias: [] }) });
    const b = seleccionBase({ nombre: 'B', principio: principioBase({ nombreCanonico: 'B', categorias: ['Digestivo'] }) });
    expect(verificarDuplicidadTerapeutica([a, b])).toEqual([]);
  });
});

describe('verificarExcesoCapsulas', () => {
  it('alerta importante cuando supera el límite y se mantiene en cápsula', () => {
    const c = seleccionBase({ decisionPresentacion: { presentacionSugerida: 'capsula', capsulasPorToma: 4, limiteCapsulasAplicado: 2, superaLimite: true, alternativasEvaluadas: [], motivo: 'x' } });
    const alertas = verificarExcesoCapsulas([c]);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidad).toBe('importante');
  });

  it('no alerta si ya se convirtió a sobre', () => {
    const c = seleccionBase({ decisionPresentacion: { presentacionSugerida: 'sobre', capsulasPorToma: 4, limiteCapsulasAplicado: 2, superaLimite: true, alternativasEvaluadas: [], motivo: 'x' } });
    expect(verificarExcesoCapsulas([c])).toEqual([]);
  });

  it('no alerta si no supera el límite', () => {
    const c = seleccionBase({ decisionPresentacion: { presentacionSugerida: 'capsula', capsulasPorToma: 1, limiteCapsulasAplicado: 2, superaLimite: false, alternativasEvaluadas: [], motivo: 'x' } });
    expect(verificarExcesoCapsulas([c])).toEqual([]);
  });
});

describe('verificarExcesoGramosPorSobre', () => {
  it('alerta cuando la dosis en sobre supera el umbral', () => {
    const c = seleccionBase({ dosisElegida: { valor: 6, unidad: 'g' }, decisionPresentacion: { presentacionSugerida: 'sobre', capsulasPorToma: null, limiteCapsulasAplicado: 2, superaLimite: true, alternativasEvaluadas: [], motivo: 'x' } });
    const alertas = verificarExcesoGramosPorSobre([c], REGLAS_VCI_DEFECTO);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidad).toBe('importante');
  });

  it('no alerta si la dosis en sobre está dentro del umbral', () => {
    const c = seleccionBase({ dosisElegida: { valor: 3, unidad: 'g' }, decisionPresentacion: { presentacionSugerida: 'sobre', capsulasPorToma: null, limiteCapsulasAplicado: 2, superaLimite: false, alternativasEvaluadas: [], motivo: 'x' } });
    expect(verificarExcesoGramosPorSobre([c], REGLAS_VCI_DEFECTO)).toEqual([]);
  });

  it('no alerta si la presentación es cápsula', () => {
    const c = seleccionBase({ dosisElegida: { valor: 6, unidad: 'g' }, decisionPresentacion: { presentacionSugerida: 'capsula', capsulasPorToma: 1, limiteCapsulasAplicado: 2, superaLimite: false, alternativasEvaluadas: [], motivo: 'x' } });
    expect(verificarExcesoGramosPorSobre([c], REGLAS_VCI_DEFECTO)).toEqual([]);
  });
});

describe('verificarIncompatibilidadesPresentacion', () => {
  it('crítica cuando se sugiere cápsula pero la farmacotecnia dice que no es compatible', () => {
    const c = seleccionBase({
      principio: principioBase({ farmacotecnia: { compatibleSobres: null, compatibleLiquidos: null, compatibleCapsulas: false, higroscopico: null, fotosensible: null, sensibleCalor: null } }),
      decisionPresentacion: { presentacionSugerida: 'capsula', capsulasPorToma: 1, limiteCapsulasAplicado: 2, superaLimite: false, alternativasEvaluadas: [], motivo: 'x' },
    });
    const alertas = verificarIncompatibilidadesPresentacion([c]);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidad).toBe('critica');
    expect(alertas[0].requiereRevisionAntesDeFirmar).toBe(true);
  });

  it('crítica cuando se sugiere sobre pero la farmacotecnia dice que no es compatible', () => {
    const c = seleccionBase({
      principio: principioBase({ farmacotecnia: { compatibleSobres: false, compatibleLiquidos: null, compatibleCapsulas: null, higroscopico: null, fotosensible: null, sensibleCalor: null } }),
      decisionPresentacion: { presentacionSugerida: 'sobre', capsulasPorToma: null, limiteCapsulasAplicado: 2, superaLimite: true, alternativasEvaluadas: [], motivo: 'x' },
    });
    expect(verificarIncompatibilidadesPresentacion([c])).toHaveLength(1);
  });

  it('no alerta si no hay contradicción (dato null = sin información, no incompatible)', () => {
    const c = seleccionBase({ decisionPresentacion: { presentacionSugerida: 'capsula', capsulasPorToma: 1, limiteCapsulasAplicado: 2, superaLimite: false, alternativasEvaluadas: [], motivo: 'x' } });
    expect(verificarIncompatibilidadesPresentacion([c])).toEqual([]);
  });
});

describe('verificarHorariosImposibles', () => {
  it('crítica si el horario recomendado no pertenece al catálogo válido', () => {
    const c = seleccionBase({ horarioRecomendado: 'medianoche' as any });
    const alertas = verificarHorariosImposibles([c], []);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidad).toBe('critica');
  });

  it('importante si el principio quedó agrupado en un preparado con horario distinto al recomendado', () => {
    const c = seleccionBase({ horarioRecomendado: 'cena' });
    const preparados: PreparadoMPI[] = [{ horario: 'desayuno', principios: ['Principio X'] }];
    const alertas = verificarHorariosImposibles([c], preparados);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidad).toBe('importante');
  });

  it('no alerta si el horario coincide con el preparado', () => {
    const c = seleccionBase({ horarioRecomendado: 'desayuno' });
    const preparados: PreparadoMPI[] = [{ horario: 'desayuno', principios: ['Principio X'] }];
    expect(verificarHorariosImposibles([c], preparados)).toEqual([]);
  });

  it('no alerta si no hay horario recomendado (individualizar)', () => {
    const c = seleccionBase({ horarioRecomendado: null });
    expect(verificarHorariosImposibles([c], [{ horario: null, principios: ['Principio X'] }])).toEqual([]);
  });
});

describe('verificarExcesoPrincipiosPorPreparado', () => {
  it('alerta importante si un preparado supera el umbral configurado', () => {
    const preparados: PreparadoMPI[] = [{ horario: 'desayuno', principios: ['A', 'B', 'C', 'D', 'E', 'F'] }];
    const alertas = verificarExcesoPrincipiosPorPreparado(preparados, REGLAS_VCI_DEFECTO);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidad).toBe('importante');
  });

  it('no alerta dentro del umbral', () => {
    const preparados: PreparadoMPI[] = [{ horario: 'desayuno', principios: ['A', 'B'] }];
    expect(verificarExcesoPrincipiosPorPreparado(preparados, REGLAS_VCI_DEFECTO)).toEqual([]);
  });
});

describe('verificarRedundancia', () => {
  it('crítica si el mismo nombre aparece más de una vez', () => {
    const a = seleccionBase({ nombre: 'A' });
    const b = seleccionBase({ nombre: 'A' });
    const alertas = verificarRedundancia([a, b]);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidad).toBe('critica');
    expect(alertas[0].requiereRevisionAntesDeFirmar).toBe(true);
  });

  it('no alerta con nombres distintos', () => {
    const a = seleccionBase({ nombre: 'A' });
    const b = seleccionBase({ nombre: 'B' });
    expect(verificarRedundancia([a, b])).toEqual([]);
  });
});

describe('evaluarIntegridadYConfianza y clasificarConfianza', () => {
  it('sin problemas de datos, confianza alta', () => {
    const c = seleccionBase({
      principio: principioBase({
        farmacotecnia: { compatibleSobres: true, compatibleLiquidos: true, compatibleCapsulas: true, higroscopico: false, fotosensible: false, sensibleCalor: false },
      }),
    });
    const { factores } = evaluarIntegridadYConfianza([c]);
    expect(factores).toEqual([]);
    expect(clasificarConfianza(factores)).toBe('alta');
  });

  it('un principio no validado produce un factor de peso alto y confianza baja', () => {
    const c = seleccionBase({ disponibleEnBaseValidada: false, principio: null });
    const { factores } = evaluarIntegridadYConfianza([c]);
    expect(factores.some(f => f.peso === 'alto')).toBe(true);
    expect(clasificarConfianza(factores)).toBe('baja');
  });

  it('un principio sin dosis elegida produce un factor de peso alto', () => {
    const c = seleccionBase({ dosisElegida: null });
    const { factores } = evaluarIntegridadYConfianza([c]);
    expect(factores.some(f => f.campo.startsWith('dosis:'))).toBe(true);
  });

  it('sin farmacotecnia cargada produce un factor de peso medio', () => {
    const c = seleccionBase();
    const { factores } = evaluarIntegridadYConfianza([c]);
    expect(factores.some(f => f.campo.startsWith('farmacotecnia:') && f.peso === 'medio')).toBe(true);
  });

  it('confianza media con 1-2 factores de peso medio', () => {
    const factores: FactorConfianza[] = [{ campo: 'x', peso: 'medio', descripcion: '' }];
    expect(clasificarConfianza(factores)).toBe('media');
  });

  it('confianza baja con 3 o más factores de peso medio', () => {
    const factores: FactorConfianza[] = [
      { campo: 'a', peso: 'medio', descripcion: '' }, { campo: 'b', peso: 'medio', descripcion: '' }, { campo: 'c', peso: 'medio', descripcion: '' },
    ];
    expect(clasificarConfianza(factores)).toBe('baja');
  });
});

describe('calcularScore', () => {
  it('score 100 sin alertas, con bonificación si la agrupación es adecuada', () => {
    const desglose = calcularScore([], [{ horario: 'desayuno', principios: ['A'] }]);
    expect(desglose.scoreFinal).toBe(100); // clamp: 100 + 2 de bono -> 102 -> clamp a 100
    expect(desglose.huboClamp).toBe(true);
    expect(desglose.componentes.some(c => c.origen === 'bonificacion')).toBe(true);
  });

  it('aplica la penalización exacta declarada en cada alerta', () => {
    const alertas: AlertaVCI[] = [{
      codigo: 'x', categoria: 'dosis-fuera-de-rango', severidad: 'critica', titulo: 't', descripcion: 'd',
      principiosImplicados: [], evidenciaOFuente: 'f', impactoScore: -20, recomendacion: null, requiereRevisionAntesDeFirmar: true,
    }];
    const desglose = calcularScore(alertas, []);
    expect(desglose.scoreFinal).toBe(80);
    expect(desglose.sumaCruda).toBe(80);
    expect(desglose.huboClamp).toBe(false);
  });

  it('nunca baja de 0 aunque la suma cruda sea negativa', () => {
    const alertas: AlertaVCI[] = Array.from({ length: 10 }, (_, i) => ({
      codigo: `x${i}`, categoria: 'dosis-fuera-de-rango' as const, severidad: 'critica' as const, titulo: 't', descripcion: 'd',
      principiosImplicados: [], evidenciaOFuente: 'f', impactoScore: -20, recomendacion: null, requiereRevisionAntesDeFirmar: true,
    }));
    const desglose = calcularScore(alertas, []);
    expect(desglose.scoreFinal).toBe(0);
    expect(desglose.sumaCruda).toBeLessThan(0);
    expect(desglose.huboClamp).toBe(true);
  });

  it('nunca supera 100', () => {
    // Sin alertas graves y con agrupación adecuada, el bono no puede empujar el score sobre 100.
    const desglose = calcularScore([], [{ horario: 'desayuno', principios: ['A'] }, { horario: 'cena', principios: ['B'] }]);
    expect(desglose.scoreFinal).toBeLessThanOrEqual(100);
  });

  it('no aplica bonificación si hay alguna alerta crítica o importante', () => {
    const alertas: AlertaVCI[] = [{
      codigo: 'x', categoria: 'redundancia', severidad: 'critica', titulo: 't', descripcion: 'd',
      principiosImplicados: [], evidenciaOFuente: 'f', impactoScore: -20, recomendacion: null, requiereRevisionAntesDeFirmar: true,
    }];
    const desglose = calcularScore(alertas, [{ horario: 'desayuno', principios: ['A'] }]);
    expect(desglose.componentes.some(c => c.origen === 'bonificacion')).toBe(false);
  });
});

describe('validarPrescripcion — orquestación', () => {
  it('protocolo no disponible produce un resultado no disponible sin alertas', () => {
    const protocolo = protocoloBase({ disponible: false, motivoNoDisponible: 'Objetivos no confirmados.', principiosSeleccionados: [] });
    const resultado = validarPrescripcion(protocolo);
    expect(resultado.disponible).toBe(false);
    expect(resultado.motivoNoDisponible).toBe('Objetivos no confirmados.');
    expect(resultado.alertasCriticas).toEqual([]);
    expect(resultado.scoreGlobal).toBe(0);
  });

  it('clasifica las alertas en los tres arreglos correctos', () => {
    const protocolo = protocoloBase({
      principiosSeleccionados: [
        seleccionBase({ nombre: 'A', principio: principioBase({ nombreCanonico: 'A' }) }),
        seleccionBase({ nombre: 'A', principio: principioBase({ nombreCanonico: 'A' }) }), // redundancia -> critica
      ],
      preparados: [{ horario: 'desayuno', principios: ['A'] }],
    });
    const resultado = validarPrescripcion(protocolo);
    expect(resultado.alertasCriticas.length).toBeGreaterThan(0);
    expect(resultado.alertasCriticas.every(a => a.severidad === 'critica')).toBe(true);
    expect(resultado.alertasImportantes.every(a => a.severidad === 'importante')).toBe(true);
    expect(resultado.sugerencias.every(a => a.severidad === 'sugerencia')).toBe(true);
  });

  it('un protocolo limpio da score alto y confianza alta', () => {
    const principioCompleto = principioBase({
      farmacotecnia: { compatibleSobres: true, compatibleLiquidos: true, compatibleCapsulas: true, higroscopico: false, fotosensible: false, sensibleCalor: false },
    });
    const protocolo = protocoloBase({
      principiosSeleccionados: [seleccionBase({ principio: principioCompleto })],
    });
    const resultado = validarPrescripcion(protocolo);
    expect(resultado.disponible).toBe(true);
    expect(resultado.scoreGlobal).toBeGreaterThanOrEqual(90);
    expect(resultado.confianza).toBe('alta');
  });

  it('score alto puede coexistir con confianza baja (ejes independientes)', () => {
    const protocolo = protocoloBase({
      principiosSeleccionados: [seleccionBase({ disponibleEnBaseValidada: false, principio: null })],
      preparados: [],
    });
    const resultado = validarPrescripcion(protocolo);
    expect(resultado.confianza).toBe('baja');
    // El único principio no aporta alertas críticas/importantes (sólo una sugerencia de integridad), así que el score no se desploma.
    expect(resultado.scoreGlobal).toBeGreaterThanOrEqual(90);
  });

  it('nunca muta el protocolo de entrada', () => {
    const protocolo = Object.freeze(protocoloBase());
    expect(() => validarPrescripcion(protocolo)).not.toThrow();
    expect(protocolo.principiosSeleccionados).toHaveLength(1);
    expect(protocolo.disponible).toBe(true);
  });

  it('se degrada con gracia si preparados/principiosSeleccionados están vacíos, sin lanzar', () => {
    const protocolo = protocoloBase({ principiosSeleccionados: [], preparados: [] });
    expect(() => validarPrescripcion(protocolo)).not.toThrow();
    const resultado = validarPrescripcion(protocolo);
    expect(resultado.disponible).toBe(true);
    expect(resultado.alertasCriticas).toEqual([]);
  });

  it('es determinista: mismas entradas (en distinto orden) producen el mismo resultado', () => {
    const a = seleccionBase({ nombre: 'A', principio: principioBase({ nombreCanonico: 'A' }) });
    const b = seleccionBase({ nombre: 'B', principio: principioBase({ nombreCanonico: 'B' }) });
    const p1 = protocoloBase({ principiosSeleccionados: [a, b], preparados: [{ horario: 'desayuno', principios: ['A', 'B'] }] });
    const p2 = protocoloBase({ principiosSeleccionados: [b, a], preparados: [{ horario: 'desayuno', principios: ['A', 'B'] }] });
    const r1 = validarPrescripcion(p1);
    const r2 = validarPrescripcion(p2);
    expect(r1.scoreGlobal).toBe(r2.scoreGlobal);
    expect(r1.confianza).toBe(r2.confianza);
    expect(r1.alertasCriticas.length).toBe(r2.alertasCriticas.length);
  });

  it('requiereRevisionAntesDeFirmar es true sólo para alertas críticas', () => {
    const protocolo = protocoloBase({
      principiosSeleccionados: [
        seleccionBase({ nombre: 'A', principio: principioBase({ nombreCanonico: 'A' }) }),
        seleccionBase({ nombre: 'A', principio: principioBase({ nombreCanonico: 'A' }) }),
      ],
    });
    const resultado = validarPrescripcion(protocolo);
    for (const a of resultado.alertasCriticas) expect(a.requiereRevisionAntesDeFirmar).toBe(true);
    for (const a of [...resultado.alertasImportantes, ...resultado.sugerencias]) expect(a.requiereRevisionAntesDeFirmar).toBe(false);
  });
});
