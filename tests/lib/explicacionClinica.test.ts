import { describe, it, expect } from 'vitest';
import { explicarClinicamente, explicarProtocolo } from '@/lib/clinica/explicacionClinica';
import type { PrincipioSeleccionMPI } from '@/lib/clinica/mpi';
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

describe('explicarClinicamente', () => {
  it('menciona el objetivo principal y la prioridad en el motivo de selección', () => {
    const c = seleccionBase({ esObjetivoPrincipal: true, prioridad: 'alta', objetivos: ['Disminuir inflamación'] });
    const e = explicarClinicamente(c);
    expect(e.motivoSeleccion).toMatch(/objetivo principal/);
    expect(e.motivoSeleccion).toMatch(/alta/);
    expect(e.motivoSeleccion).toMatch(/Disminuir inflamación/);
  });

  it('distingue objetivo secundario', () => {
    const c = seleccionBase({ esObjetivoPrincipal: false });
    expect(explicarClinicamente(c).motivoSeleccion).toMatch(/objetivo secundario/);
  });

  it('menciona si el respaldo es validado o heredado', () => {
    const validado = explicarClinicamente(seleccionBase({ disponibleEnBaseValidada: true }));
    expect(validado.motivoSeleccion).toMatch(/validado/);
    const heredado = explicarClinicamente(seleccionBase({ disponibleEnBaseValidada: false }));
    expect(heredado.motivoSeleccion).toMatch(/heredado/);
  });

  it('reutiliza la dosis y su fuente ya elegidas por el MPI', () => {
    const c = seleccionBase({ dosisElegida: { valor: 500, unidad: 'mg' }, fuenteDosis: 'usual' });
    expect(explicarClinicamente(c).motivoDosis).toMatch(/500 mg/);
    expect(explicarClinicamente(c).motivoDosis).toMatch(/usual/);
  });

  it('explica la ausencia de dosis en vez de inventar una', () => {
    const c = seleccionBase({ dosisElegida: null });
    expect(explicarClinicamente(c).motivoDosis).toMatch(/Sin dosis validada/);
  });

  it('reutiliza el motivo de presentación ya calculado por el MIF', () => {
    const c = seleccionBase({ decisionPresentacion: { presentacionSugerida: 'sobre', capsulasPorToma: 4, limiteCapsulasAplicado: 2, superaLimite: true, alternativasEvaluadas: [], motivo: 'Supera el límite de cápsulas.' } });
    expect(explicarClinicamente(c).motivoPresentacion).toBe('Supera el límite de cápsulas.');
  });

  it('reutiliza el motivo de sabor ya calculado por el MIF', () => {
    const c = seleccionBase({ decisionSabor: { sabor: 'limon', motivo: 'Mayor aceptación entre los compatibles.' } });
    expect(explicarClinicamente(c).motivoSabor).toBe('Mayor aceptación entre los compatibles.');
  });

  it('conserva las advertencias del candidato tal cual, sin transformarlas', () => {
    const advertencias = [{ codigo: 'x', descripcion: 'aviso', fuente: 'dosis' }];
    const c = seleccionBase({ advertencias });
    expect(explicarClinicamente(c).advertenciasRelevantes).toBe(advertencias);
  });

  it('no muta el candidato de entrada', () => {
    const c = Object.freeze(seleccionBase());
    expect(() => explicarClinicamente(c)).not.toThrow();
  });
});

describe('explicarProtocolo', () => {
  it('genera una explicación por cada principio seleccionado', () => {
    const a = seleccionBase({ nombre: 'A' });
    const b = seleccionBase({ nombre: 'B' });
    const resultado = explicarProtocolo([a, b]);
    expect(resultado).toHaveLength(2);
    expect(resultado.map(e => e.nombre)).toEqual(['A', 'B']);
  });

  it('con una lista vacía, devuelve una lista vacía', () => {
    expect(explicarProtocolo([])).toEqual([]);
  });
});
