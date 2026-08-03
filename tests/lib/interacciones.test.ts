import { describe, it, expect } from 'vitest';
import { detectarInteracciones } from '@/lib/clinica/interacciones';
import type { InteraccionPrincipioRepo } from '@/lib/repositorios/interaccionesPrincipios';
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

function filaPP(overrides: Partial<InteraccionPrincipioRepo> = {}): InteraccionPrincipioRepo {
  return { id: 'i1', principioId: 'p-a', principioRelacionadoId: 'p-b', sustanciaExterna: null, tipo: 'sinergia', descripcion: 'Interactúan entre sí.', severidad: 'moderada', ...overrides };
}

describe('detectarInteracciones', () => {
  it('detecta una interacción principio-principio cuando ambos están en el protocolo', () => {
    const a = seleccionBase({ nombre: 'A', principio: principioBase({ id: 'p-a', nombreCanonico: 'A' }) });
    const b = seleccionBase({ nombre: 'B', principio: principioBase({ id: 'p-b', nombreCanonico: 'B' }) });
    const resultado = detectarInteracciones([a, b], [filaPP()], null);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].fuente).toBe('interacciones_principios');
    expect(resultado[0].principioA).toBe('A');
    expect(resultado[0].principioB).toBe('B');
  });

  it('no informa la interacción si uno de los dos principios no está en el protocolo', () => {
    const a = seleccionBase({ nombre: 'A', principio: principioBase({ id: 'p-a', nombreCanonico: 'A' }) });
    const resultado = detectarInteracciones([a], [filaPP()], null);
    expect(resultado).toEqual([]);
  });

  it('detecta una interacción con medicación externa registrada del paciente', () => {
    const a = seleccionBase({ nombre: 'A', principio: principioBase({ id: 'p-a', nombreCanonico: 'A' }) });
    const fila = filaPP({ id: 'i2', principioRelacionadoId: null, sustanciaExterna: 'warfarina', descripcion: 'Aumenta riesgo hemorrágico.', severidad: 'alta' });
    const resultado = detectarInteracciones([a], [fila], { alergias: null, medicamentosActuales: 'Warfarina 5mg cada 24hs', antecedentesPersonales: null, antecedentesFamiliares: null });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].fuente).toBe('medicacion-externa');
    expect(resultado[0].sustanciaExterna).toBe('warfarina');
  });

  it('no informa la interacción con sustancia externa si el paciente no la tiene registrada', () => {
    const a = seleccionBase({ nombre: 'A', principio: principioBase({ id: 'p-a', nombreCanonico: 'A' }) });
    const fila = filaPP({ id: 'i2', principioRelacionadoId: null, sustanciaExterna: 'warfarina' });
    const resultado = detectarInteracciones([a], [fila], { alergias: null, medicamentosActuales: 'Metformina', antecedentesPersonales: null, antecedentesFamiliares: null });
    expect(resultado).toEqual([]);
  });

  it('sin filas de interacción, devuelve una lista vacía', () => {
    const a = seleccionBase();
    expect(detectarInteracciones([a], [], null)).toEqual([]);
  });

  it('sin contexto del paciente, no informa interacciones con sustancia externa (no puede evaluarlas)', () => {
    const a = seleccionBase({ nombre: 'A', principio: principioBase({ id: 'p-a', nombreCanonico: 'A' }) });
    const fila = filaPP({ id: 'i2', principioRelacionadoId: null, sustanciaExterna: 'warfarina' });
    expect(detectarInteracciones([a], [fila], null)).toEqual([]);
  });

  it('nunca modifica la lista de seleccionados de entrada', () => {
    const a = seleccionBase({ nombre: 'A', principio: principioBase({ id: 'p-a', nombreCanonico: 'A' }) });
    const b = seleccionBase({ nombre: 'B', principio: principioBase({ id: 'p-b', nombreCanonico: 'B' }) });
    const entrada = Object.freeze([a, b]);
    expect(() => detectarInteracciones(entrada as any, [filaPP()], null)).not.toThrow();
    expect(entrada).toHaveLength(2);
  });

  it('no duplica la misma interacción si aparece cargada desde ambos lados de la relación', () => {
    const a = seleccionBase({ nombre: 'A', principio: principioBase({ id: 'p-a', nombreCanonico: 'A' }) });
    const b = seleccionBase({ nombre: 'B', principio: principioBase({ id: 'p-b', nombreCanonico: 'B' }) });
    const filas = [filaPP({ id: 'i1' }), filaPP({ id: 'i2', principioId: 'p-b', principioRelacionadoId: 'p-a' })];
    const resultado = detectarInteracciones([a, b], filas, null);
    expect(resultado).toHaveLength(1);
  });
});
