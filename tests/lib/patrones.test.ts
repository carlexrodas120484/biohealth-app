import { describe, it, expect } from 'vitest';
import { calcularPatrones, CODIGOS_PATRONES, VERSION_ALGORITMO_PATRONES } from '../../lib/clinica/patrones';
import { calcularPuntajes } from '../../lib/clinica/cuestionario';

function puntajesVacios() {
  return calcularPuntajes({});
}

describe('calcularPatrones — sin datos', () => {
  it('no sugiere ningún patrón si no hay evidencia (cuestionario vacío, sin historia, sin bioescáner)', () => {
    const patrones = calcularPatrones({ puntajesCuestionario: puntajesVacios(), historia: {}, hallazgos: [] });
    expect(patrones).toEqual([]);
  });
});

describe('calcularPatrones — evidencia de cuestionario', () => {
  it('sugiere un patrón cuando el sistema mapeado supera el umbral', () => {
    const puntajes = { ...puntajesVacios(), 'Tiroides': { puntos: 12, maximo: 12, porcentaje: 100 } };
    const patrones = calcularPatrones({ puntajesCuestionario: puntajes, historia: {}, hallazgos: [] });
    const tiroides = patrones.find(p => p.codigo === 'tiroides-funcional');
    expect(tiroides).toBeDefined();
    expect(tiroides!.puntaje).toBe(100);
    expect(tiroides!.nivel).toBe('muy_alta');
    expect(tiroides!.estado).toBe('sugerido');
    expect(tiroides!.evidencias[0]).toMatchObject({ fuente: 'cuestionario' });
  });

  it('no sugiere un patrón cuyo sistema está por debajo del umbral mínimo (20)', () => {
    const puntajes = { ...puntajesVacios(), 'Tiroides': { puntos: 1, maximo: 12, porcentaje: 8 } };
    const patrones = calcularPatrones({ puntajesCuestionario: puntajes, historia: {}, hallazgos: [] });
    expect(patrones.find(p => p.codigo === 'tiroides-funcional')).toBeUndefined();
  });

  it('promedia los sistemas de un patrón multi-sistema (estrés oxidativo)', () => {
    const puntajes = {
      ...puntajesVacios(),
      'Energía y función mitocondrial': { puntos: 8, maximo: 8, porcentaje: 100 },
      'Inflamación y dolor': { puntos: 0, maximo: 8, porcentaje: 0 },
    };
    const patrones = calcularPatrones({ puntajesCuestionario: puntajes, historia: {}, hallazgos: [] });
    const eo = patrones.find(p => p.codigo === 'estres-oxidativo');
    expect(eo!.puntaje).toBe(50); // promedio de 100 y 0
    expect(eo!.evidencias.filter(e => e.fuente === 'cuestionario')).toHaveLength(2);
  });
});

describe('calcularPatrones — evidencia de historia clínica', () => {
  it('suma evidencia moderada (+20) cuando la historia es compatible, suficiente por sí sola para sugerir', () => {
    const puntajes = { ...puntajesVacios(), 'Cardiovascular': { puntos: 0, maximo: 24, porcentaje: 0 } };
    const conBandera = calcularPatrones({
      puntajesCuestionario: puntajes, historia: { dolorToracico: true }, hallazgos: [],
    });
    const cardio = conBandera.find(p => p.codigo === 'riesgo-cardiovascular');
    expect(cardio).toBeDefined();
    expect(cardio!.puntaje).toBe(20);
    expect(cardio!.evidencias).toContainEqual(expect.objectContaining({ fuente: 'historia', aporte: 20 }));
  });

  it('no agrega evidencia de historia si la condición no se cumple', () => {
    const puntajes = { ...puntajesVacios(), 'Cardiovascular': { puntos: 0, maximo: 24, porcentaje: 0 } };
    const patrones = calcularPatrones({
      puntajesCuestionario: puntajes, historia: { dolorToracico: false }, hallazgos: [],
    });
    expect(patrones.find(p => p.codigo === 'riesgo-cardiovascular')).toBeUndefined();
  });
});

describe('calcularPatrones — evidencia de bioescáner', () => {
  it('suma evidencia complementaria por hallazgo compatible, con tope', () => {
    const puntajes = { ...puntajesVacios(), 'Tiroides': { puntos: 0, maximo: 12, porcentaje: 0 } };
    const patrones = calcularPatrones({
      puntajesCuestionario: puntajes,
      historia: {},
      hallazgos: [
        { id: '1', parametro: 'TSH elevada', valor: '6.2', severidad: 'alto' },
        { id: '2', parametro: 'T4 libre baja', valor: '0.7', severidad: 'alto' },
        { id: '3', parametro: 'T3 libre baja', valor: '2.1', severidad: 'alto' },
      ],
    });
    const tiroides = patrones.find(p => p.codigo === 'tiroides-funcional');
    expect(tiroides!.puntaje).toBe(20); // 10+10+10 = 30, topeado a 20
  });

  it('ignora hallazgos con severidad "ok"', () => {
    const puntajes = { ...puntajesVacios(), 'Tiroides': { puntos: 0, maximo: 12, porcentaje: 0 } };
    const patrones = calcularPatrones({
      puntajesCuestionario: puntajes, historia: {},
      hallazgos: [{ id: '1', parametro: 'TSH', valor: '2.0', severidad: 'ok' }],
    });
    expect(patrones.find(p => p.codigo === 'tiroides-funcional')).toBeUndefined();
  });
});

describe('calcularPatrones — combinación de fuentes', () => {
  it('combina cuestionario + historia + bioescáner en un mismo patrón', () => {
    const puntajes = { ...puntajesVacios(), 'Intestinal': { puntos: 14, maximo: 24, porcentaje: 58 } };
    const patrones = calcularPatrones({
      puntajesCuestionario: puntajes,
      historia: { bristol: 1 },
      hallazgos: [{ id: '1', parametro: 'Disbiosis intestinal', valor: '', severidad: 'med' }],
    });
    const intestinal = patrones.find(p => p.codigo === 'intestinal')!;
    expect(intestinal.puntaje).toBe(83); // 58 + 20 + 5
    expect(intestinal.evidencias.map(e => e.fuente).sort()).toEqual(['bioescaner', 'cuestionario', 'historia']);
    expect(intestinal.nivel).toBe('muy_alta');
  });
});

describe('calcularPatrones — orden y metadatos', () => {
  it('ordena los patrones sugeridos de mayor a menor puntaje', () => {
    const puntajes = {
      ...puntajesVacios(),
      'Tiroides': { puntos: 4, maximo: 12, porcentaje: 33 },
      'Cardiovascular': { puntos: 20, maximo: 24, porcentaje: 83 },
      'Inmunológico': { puntos: 10, maximo: 16, porcentaje: 63 },
    };
    const patrones = calcularPatrones({ puntajesCuestionario: puntajes, historia: {}, hallazgos: [] });
    const puntos = patrones.map(p => p.puntaje);
    expect(puntos).toEqual([...puntos].sort((a, b) => b - a));
  });

  it('cada patrón tiene código estable, versión y fecha de cálculo', () => {
    const puntajes = { ...puntajesVacios(), 'Tiroides': { puntos: 12, maximo: 12, porcentaje: 100 } };
    const patrones = calcularPatrones({ puntajesCuestionario: puntajes, historia: {}, hallazgos: [] });
    const p = patrones[0];
    expect(CODIGOS_PATRONES).toContain(p.codigo);
    expect(p.version).toBe(VERSION_ALGORITMO_PATRONES);
    expect(new Date(p.fechaCalculo).toString()).not.toBe('Invalid Date');
    expect(p.estado).toBe('sugerido'); // el motor nunca confirma por sí solo
  });

  it('define exactamente los 16 códigos de patrones pedidos', () => {
    expect(CODIGOS_PATRONES).toHaveLength(16);
    expect(new Set(CODIGOS_PATRONES).size).toBe(16);
  });
});
