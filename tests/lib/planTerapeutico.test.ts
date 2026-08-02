import { describe, it, expect } from 'vitest';
import {
  sugerirFasesPlan, calcularBanderasSeguridad, CODIGOS_FASES, VERSION_ALGORITMO_PLAN,
} from '../../lib/clinica/planTerapeutico';

describe('sugerirFasesPlan — sin datos', () => {
  it('no sugiere ninguna fase sin patrones confirmados ni banderas de alarma', () => {
    const fases = sugerirFasesPlan({ patronesConfirmados: [], historia: {} });
    expect(fases).toEqual([]);
  });
});

describe('sugerirFasesPlan — desde patrones confirmados', () => {
  it('sugiere la fase mapeada a partir de un patrón confirmado', () => {
    const fases = sugerirFasesPlan({
      patronesConfirmados: [{ codigo: 'tiroides-funcional', puntaje: 80, nivel: 'muy_alta' }],
      historia: {},
    });
    const metabolico = fases.find(f => f.codigo === 'metabolico-hormonal');
    expect(metabolico).toBeDefined();
    expect(metabolico!.evidencias[0]).toContain('tiroides-funcional');
    expect(metabolico!.prioridad).toBe('urgente'); // muy_alta -> urgente
  });

  it('no sugiere una fase sin patrones confirmados que la sustenten', () => {
    const fases = sugerirFasesPlan({
      patronesConfirmados: [{ codigo: 'tiroides-funcional', puntaje: 80, nivel: 'muy_alta' }],
      historia: {},
    });
    expect(fases.find(f => f.codigo === 'digestivo-intestinal')).toBeUndefined();
  });

  it('combina varios patrones que mapean a la misma fase', () => {
    const fases = sugerirFasesPlan({
      patronesConfirmados: [
        { codigo: 'digestivo-alto', puntaje: 40, nivel: 'moderada' },
        { codigo: 'intestinal', puntaje: 70, nivel: 'alta' },
      ],
      historia: {},
    });
    const digestivo = fases.find(f => f.codigo === 'digestivo-intestinal')!;
    expect(digestivo.evidencias).toHaveLength(2);
    expect(digestivo.prioridad).toBe('alta'); // toma el nivel más alto de los dos
  });
});

describe('sugerirFasesPlan — banderas de alarma', () => {
  it('una bandera roja dispara "Seguridad y estabilización" con prioridad urgente', () => {
    const fases = sugerirFasesPlan({ patronesConfirmados: [], historia: { dolorToracico: true } });
    const seguridad = fases.find(f => f.codigo === 'seguridad-estabilizacion');
    expect(seguridad).toBeDefined();
    expect(seguridad!.prioridad).toBe('urgente');
    expect(seguridad!.evidencias.some(e => e.includes('Dolor torácico'))).toBe(true);
  });

  it('sin bandera roja ni patrón de riesgo cardiovascular, no sugiere Seguridad y estabilización', () => {
    const fases = sugerirFasesPlan({ patronesConfirmados: [], historia: { dolorToracico: false } });
    expect(fases.find(f => f.codigo === 'seguridad-estabilizacion')).toBeUndefined();
  });
});

describe('sugerirFasesPlan — orden y metadatos', () => {
  it('ordena las fases sugeridas de mayor a menor prioridad', () => {
    const fases = sugerirFasesPlan({
      patronesConfirmados: [
        { codigo: 'tiroides-funcional', puntaje: 25, nivel: 'leve' },
        { codigo: 'digestivo-alto', puntaje: 90, nivel: 'muy_alta' },
      ],
      historia: {},
    });
    expect(fases[0].codigo).toBe('digestivo-intestinal');
    expect(fases[0].orden).toBe(1);
    expect(fases[fases.length - 1].orden).toBe(fases.length);
  });

  it('ninguna fase se sugiere ya activada: el motor siempre nace en "sugerida"', () => {
    const fases = sugerirFasesPlan({
      patronesConfirmados: [{ codigo: 'riesgo-cardiovascular', puntaje: 90, nivel: 'muy_alta' }],
      historia: { dolorToracico: true },
    });
    expect(fases.every(f => f.estado === 'sugerida')).toBe(true);
  });

  it('cada fase trae versión de algoritmo y fecha de cálculo', () => {
    const fases = sugerirFasesPlan({
      patronesConfirmados: [{ codigo: 'hormonal', puntaje: 50, nivel: 'moderada' }],
      historia: {},
    });
    expect(fases[0].version).toBe(VERSION_ALGORITMO_PLAN);
    expect(new Date(fases[0].fechaCalculo).toString()).not.toBe('Invalid Date');
  });

  it('expone exactamente las 6 fases mínimas pedidas', () => {
    expect(CODIGOS_FASES).toEqual([
      'seguridad-estabilizacion', 'digestivo-intestinal', 'inflamacion-estres-oxidativo',
      'metabolico-hormonal', 'mitocondrial-energia', 'reparacion-mantenimiento',
    ]);
  });
});

describe('calcularBanderasSeguridad', () => {
  it('expone alergias, medicación y antecedentes registrados sin bloquear nada', () => {
    const banderas = calcularBanderasSeguridad({}, {
      alergias: 'Penicilina', medicamentosActuales: 'Levotiroxina',
      antecedentesPersonales: 'Hipotiroidismo', antecedentesFamiliares: null,
    });
    expect(banderas.map(b => b.fuente).sort()).toEqual(['alergias', 'antecedentes', 'medicacion']);
  });

  it('expone cada bandera roja activa de la historia', () => {
    const banderas = calcularBanderasSeguridad(
      { dolorToracico: true, sangrado: true },
      { alergias: null, medicamentosActuales: null, antecedentesPersonales: null, antecedentesFamiliares: null }
    );
    expect(banderas.filter(b => b.fuente === 'bandera_roja')).toHaveLength(2);
  });

  it('no genera ninguna bandera si no hay datos registrados', () => {
    const banderas = calcularBanderasSeguridad({}, {
      alergias: null, medicamentosActuales: null, antecedentesPersonales: null, antecedentesFamiliares: null,
    });
    expect(banderas).toEqual([]);
  });
});
