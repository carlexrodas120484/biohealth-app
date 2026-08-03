import { describe, it, expect } from 'vitest';
import { adaptarAIngredientes, adaptarAItems } from '@/lib/adaptadores/protocoloAFormulacion';
import { construirPreparaciones } from '@/lib/clinica/formulacion';
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
    dosisConocimiento: null, horarioRecomendado: 'desayuno', advertenciasIniciales: [],
    dosisElegida: { valor: 300, unidad: 'mg' }, fuenteDosis: 'usual', duracionSugerida: '30 días',
    decisionPresentacion: { presentacionSugerida: 'capsula', capsulasPorToma: 1, limiteCapsulasAplicado: 2, superaLimite: false, alternativasEvaluadas: [], motivo: 'x' },
    decisionSabor: null, advertencias: [],
    ...overrides,
  };
}

describe('adaptarAIngredientes', () => {
  it('adapta un candidato válido a IngredienteFormula', () => {
    const c = seleccionBase();
    const resultado = adaptarAIngredientes([c]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({ id: 'p1', nombre: 'Principio X', dosisPorTomaMg: 300, vecesPorDia: 1, horario: 'desayuno', presentacionElegida: 'capsula' });
  });

  it('convierte la dosis a mg cuando está en gramos', () => {
    const c = seleccionBase({ dosisElegida: { valor: 5, unidad: 'g' } });
    expect(adaptarAIngredientes([c])[0].dosisPorTomaMg).toBe(5000);
  });

  it('excluye candidatos sin dosis elegida (no puede representarse como número positivo obligatorio)', () => {
    const c = seleccionBase({ dosisElegida: null });
    expect(adaptarAIngredientes([c])).toEqual([]);
  });

  it('excluye candidatos con dosis en unidad no convertible a mg (UI/ml)', () => {
    const c = seleccionBase({ dosisElegida: { valor: 1000, unidad: 'ui' } });
    expect(adaptarAIngredientes([c])).toEqual([]);
  });

  it('excluye candidatos sin principio resuelto en la Base Farmacotécnica', () => {
    const c = seleccionBase({ principio: null, disponibleEnBaseValidada: false });
    expect(adaptarAIngredientes([c])).toEqual([]);
  });

  it('usa "desayuno" por defecto cuando no hay horario recomendado (mismo default que la pantalla existente)', () => {
    const c = seleccionBase({ horarioRecomendado: null });
    expect(adaptarAIngredientes([c])[0].horario).toBe('desayuno');
  });

  it('deja presentacionElegida sin definir cuando la presentación no es representable en el modelo legado (perlas/polvo/comprimidos)', () => {
    const c = seleccionBase({ decisionPresentacion: { presentacionSugerida: 'perlas' as any, capsulasPorToma: null, limiteCapsulasAplicado: 2, superaLimite: false, alternativasEvaluadas: [], motivo: 'x' } });
    expect(adaptarAIngredientes([c])[0].presentacionElegida).toBeUndefined();
  });

  it('el id es determinista: siempre el id del principio, nunca aleatorio', () => {
    const c = seleccionBase();
    const r1 = adaptarAIngredientes([c])[0].id;
    const r2 = adaptarAIngredientes([c])[0].id;
    expect(r1).toBe(r2);
    expect(r1).toBe('p1');
  });

  it('el resultado es aceptado por el motor de reglas real (construirPreparaciones) sin errores', () => {
    const c = seleccionBase();
    const ingredientes = adaptarAIngredientes([c]);
    expect(() => construirPreparaciones(ingredientes, new Map())).not.toThrow();
  });

  it('no muta la lista de entrada', () => {
    const c = seleccionBase();
    const entrada = Object.freeze([c]);
    expect(() => adaptarAIngredientes(entrada as any)).not.toThrow();
    expect(entrada).toHaveLength(1);
  });
});

describe('adaptarAItems', () => {
  it('incluye todos los candidatos, incluso sin dosis (más tolerante que IngredienteFormula)', () => {
    const conDosis = seleccionBase({ nombre: 'Con dosis' });
    const sinDosis = seleccionBase({ nombre: 'Sin dosis', dosisElegida: null });
    const resultado = adaptarAItems([conDosis, sinDosis]);
    expect(resultado).toHaveLength(2);
    expect(resultado[1].dosis).toMatch(/Sin dosis validada/);
  });

  it('usa el id del principio cuando está resuelto', () => {
    const c = seleccionBase();
    expect(adaptarAItems([c])[0].id).toBe('p1');
  });

  it('usa un id determinista basado en el nombre cuando no hay principio resuelto', () => {
    const c = seleccionBase({ principio: null, disponibleEnBaseValidada: false, nombre: 'Sin Validar' });
    const r1 = adaptarAItems([c])[0].id;
    const r2 = adaptarAItems([c])[0].id;
    expect(r1).toBe(r2);
    expect(r1).toContain('sin-validar');
  });

  it('la indicación incluye los objetivos del candidato', () => {
    const c = seleccionBase({ objetivos: ['Objetivo A', 'Objetivo B'] });
    expect(adaptarAItems([c])[0].indicacion).toBe('Objetivo A, Objetivo B');
  });

  it('la cantidad usa la duración sugerida', () => {
    const c = seleccionBase({ duracionSugerida: '8 semanas' });
    expect(adaptarAItems([c])[0].cantidad).toBe('8 semanas');
  });

  it('las observaciones incluyen las advertencias del candidato', () => {
    const c = seleccionBase({ advertencias: [{ codigo: 'x', descripcion: 'Revisar dosis.', fuente: 'dosis' }] });
    expect(adaptarAItems([c])[0].observaciones).toContain('Revisar dosis.');
  });

  it('todos los campos obligatorios del esquema legado quedan no vacíos', () => {
    const c = seleccionBase();
    const item = adaptarAItems([c])[0];
    expect(item.id.length).toBeGreaterThan(0);
    expect(item.nombre.length).toBeGreaterThanOrEqual(2);
    expect(item.dosis.length).toBeGreaterThan(0);
    expect(item.indicacion.length).toBeGreaterThan(0);
  });

  it('no muta la lista de entrada', () => {
    const c = seleccionBase();
    const entrada = Object.freeze([c]);
    expect(() => adaptarAItems(entrada as any)).not.toThrow();
    expect(entrada).toHaveLength(1);
  });
});
