import { describe, it, expect } from 'vitest';
import { calcularIPT, calcularRankingIPT, bandaDe, sugerirPuntuacionPorNivel, type AlteracionInput } from '../../lib/algoritmo/ipt';

/**
 * Caso de referencia: el mismo paciente mock usado en el prototipo
 * (biohealth_prototipo.html), verificado ahí interactivamente antes
 * de portar la lógica. Estos valores NO son arbitrarios — son el
 * contrato de fidelidad entre el prototipo y la app real. Si algún
 * cambio futuro rompe este test, rompió la lógica clínica validada,
 * no el test.
 */
const CASO_REFERENCIA: AlteracionInput[] = [
  { id: 'a1', nombre: 'Disbiosis intestinal', dominio: 'Barrera', nivel: 'primaria', perpetuadorActivo: true, IC: 4, IS: 5, RV: 3, EV: 3, CB: 3 },
  { id: 'a2', nombre: 'Inflamación sistémica', dominio: 'Inflamatorio', nivel: 'secundaria', perpetuadorActivo: false, IC: 4, IS: 4, RV: 3, EV: 4, CB: 4 },
  { id: 'a3', nombre: 'Déficit de magnesio', dominio: 'Nutricional', nivel: 'secundaria', perpetuadorActivo: false, IC: 2, IS: 3, RV: 5, EV: 4, CB: 5 },
  { id: 'a4', nombre: 'Alteración del sueño', dominio: 'Neuro', nivel: 'terciaria', perpetuadorActivo: true, IC: 4, IS: 2, RV: 3, EV: 3, CB: 3 },
  { id: 'a5', nombre: 'Fatiga persistente', dominio: 'Terciario', nivel: 'terciaria', perpetuadorActivo: false, IC: 5, IS: 1, RV: 3, EV: 2, CB: 3 },
];

describe('calcularIPT — fidelidad con el prototipo validado', () => {
  it('reproduce exactamente los puntajes vistos en el prototipo (95, 76, 69, 60, 50)', () => {
    const resultados = CASO_REFERENCIA.map(a => calcularIPT(a));
    expect(resultados.map(r => r.final)).toEqual([95, 76, 69, 60, 50]);
  });

  it('el perpetuador SUMA puntos, nunca resta', () => {
    const sinPerp = calcularIPT({ ...CASO_REFERENCIA[0], perpetuadorActivo: false });
    const conPerp = calcularIPT({ ...CASO_REFERENCIA[0], perpetuadorActivo: true });
    expect(conPerp.final - sinPerp.final).toBe(8);
  });

  it('el coeficiente jerárquico favorece a las alteraciones primarias sobre las terciarias', () => {
    const base = { id: 'x', nombre: 'test', dominio: 'X', perpetuadorActivo: false, IC: 3, IS: 3, RV: 3, EV: 3, CB: 3 } as const;
    const primaria = calcularIPT({ ...base, nivel: 'primaria' });
    const terciaria = calcularIPT({ ...base, nivel: 'terciaria' });
    expect(primaria.final).toBeGreaterThan(terciaria.final);
  });

  it('el resultado final nunca supera 100', () => {
    const extrema = calcularIPT({
      id: 'x', nombre: 'extrema', dominio: 'X', nivel: 'primaria', perpetuadorActivo: true,
      IC: 5, IS: 5, RV: 5, EV: 5, CB: 5,
    });
    expect(extrema.final).toBeLessThanOrEqual(100);
  });

  it('calcularRankingIPT ordena de mayor a menor prioridad', () => {
    const ranking = calcularRankingIPT(CASO_REFERENCIA);
    const finales = ranking.map(r => r.final);
    expect(finales).toEqual([...finales].sort((a, b) => b - a));
  });
});

describe('bandaDe — bandas de prioridad', () => {
  it.each([
    [95, 'critica'], [80, 'critica'],
    [79, 'alta'], [65, 'alta'],
    [64, 'media'], [45, 'media'],
    [44, 'diferida'], [0, 'diferida'],
  ])('%i puntos → %s', (v, esperado) => {
    expect(bandaDe(v as number).banda).toBe(esperado);
  });
});

describe('sugerirPuntuacionPorNivel — punto de partida editable, no una decisión', () => {
  it('sugiere más puntuación cuanto más alta la jerarquía', () => {
    expect(sugerirPuntuacionPorNivel('primaria')).toBeGreaterThan(sugerirPuntuacionPorNivel('secundaria'));
    expect(sugerirPuntuacionPorNivel('secundaria')).toBeGreaterThan(sugerirPuntuacionPorNivel('terciaria'));
  });

  it('siempre devuelve un valor dentro de la escala 0-5 del formulario', () => {
    for (const nivel of ['primaria', 'secundaria', 'terciaria'] as const) {
      const v = sugerirPuntuacionPorNivel(nivel);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});
