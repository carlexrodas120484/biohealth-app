import { describe, it, expect } from 'vitest';
import {
  SISTEMAS_CUESTIONARIO, PREGUNTAS_SCREENING, clasificarSeveridad,
  calcularPuntajes, ordenarPorSeveridad, obtenerTopSintomas, VERSION_CUESTIONARIO,
} from '../../lib/clinica/cuestionario';

describe('clasificarSeveridad', () => {
  it('clasifica según los cortes 0–19/20–39/40–59/60–79/80–100', () => {
    expect(clasificarSeveridad(0)).toBe('sin_alteracion');
    expect(clasificarSeveridad(19)).toBe('sin_alteracion');
    expect(clasificarSeveridad(20)).toBe('leve');
    expect(clasificarSeveridad(39)).toBe('leve');
    expect(clasificarSeveridad(40)).toBe('moderada');
    expect(clasificarSeveridad(59)).toBe('moderada');
    expect(clasificarSeveridad(60)).toBe('alta');
    expect(clasificarSeveridad(79)).toBe('alta');
    expect(clasificarSeveridad(80)).toBe('muy_alta');
    expect(clasificarSeveridad(100)).toBe('muy_alta');
  });
});

describe('modelo de preguntas', () => {
  it('cada pregunta tiene id estable, texto, sistema, orden, peso y activo', () => {
    for (const p of PREGUNTAS_SCREENING) {
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.texto).toBe('string');
      expect(typeof p.sistema).toBe('string');
      expect(typeof p.orden).toBe('number');
      expect(p.peso).toBe(1); // peso por defecto
      expect(p.activo).toBe(true);
    }
  });

  it('todos los id de pregunta son únicos', () => {
    const ids = PREGUNTAS_SCREENING.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toda pregunta pertenece a un sistema registrado en SISTEMAS_CUESTIONARIO', () => {
    const nombres = new Set(SISTEMAS_CUESTIONARIO.map(s => s.nombre));
    for (const p of PREGUNTAS_SCREENING) {
      expect(nombres.has(p.sistema)).toBe(true);
    }
  });

  it('incluye los 16 sistemas mínimos pedidos, incluso los que todavía no tienen preguntas', () => {
    const esperados = [
      'Digestivo alto', 'Intestinal', 'Hepático y detoxificación', 'Metabólico y glucémico',
      'Cardiovascular', 'Neurológico y cognitivo', 'Sueño', 'Estrés y salud mental',
      'Tiroides', 'Hormonal', 'Inmunológico', 'Inflamación y dolor', 'Piel, cabello y uñas',
      'Energía y función mitocondrial', 'Músculo-esquelético', 'Hábitos y estilo de vida',
    ];
    const nombres = SISTEMAS_CUESTIONARIO.map(s => s.nombre);
    for (const nombre of esperados) expect(nombres).toContain(nombre);
    expect(SISTEMAS_CUESTIONARIO.length).toBeGreaterThanOrEqual(16);
  });

  it('la pregunta menstrual/menopausia está limitada al grupo femenino', () => {
    const pregunta = PREGUNTAS_SCREENING.find(p => p.texto.includes('menstruales'));
    expect(pregunta?.grupo).toBe('femenino');
  });
});

describe('calcularPuntajes', () => {
  it('puntaje_sistema = suma(respuesta × peso) y porcentaje = puntos/máximo × 100', () => {
    const preguntasCardio = PREGUNTAS_SCREENING.filter(p => p.sistema === 'Cardiovascular');
    const respuestas: Record<string, number> = {};
    respuestas[preguntasCardio[0].id] = 4;
    respuestas[preguntasCardio[1].id] = 2;

    const puntajes = calcularPuntajes(respuestas);
    const cardio = puntajes['Cardiovascular'];
    expect(cardio.puntos).toBe(4 + 2);
    expect(cardio.maximo).toBe(preguntasCardio.length * 4);
    expect(cardio.porcentaje).toBe(Math.round(((4 + 2) / (preguntasCardio.length * 4)) * 100));
  });

  it('devuelve TODOS los sistemas registrados, incluso los que no tienen preguntas todavía (0/0/0%)', () => {
    const puntajes = calcularPuntajes({});
    expect(Object.keys(puntajes).length).toBe(SISTEMAS_CUESTIONARIO.length);
    const habitos = puntajes['Hábitos y estilo de vida'];
    expect(habitos).toEqual({ puntos: 0, maximo: 0, porcentaje: 0, severidad: 'sin_alteracion' });
  });

  it('respuestas vacías dan 0% en todos los sistemas con preguntas', () => {
    const puntajes = calcularPuntajes({});
    for (const r of Object.values(puntajes)) {
      expect(r.porcentaje).toBe(0);
      expect(r.severidad).toBe('sin_alteracion');
    }
  });

  it('respuestas al máximo (4) dan 100% en los sistemas contestados', () => {
    const preguntasIntestinal = PREGUNTAS_SCREENING.filter(p => p.sistema === 'Intestinal');
    const respuestas: Record<string, number> = {};
    for (const p of preguntasIntestinal) respuestas[p.id] = 4;
    const puntajes = calcularPuntajes(respuestas);
    expect(puntajes['Intestinal'].porcentaje).toBe(100);
    expect(puntajes['Intestinal'].severidad).toBe('muy_alta');
  });

  it('con sexo masculino, la pregunta femenina no cuenta en puntos ni en máximo', () => {
    const preguntaFemenina = PREGUNTAS_SCREENING.find(p => p.grupo === 'femenino')!;
    const respuestas = { [preguntaFemenina.id]: 4 };
    const conFiltro = calcularPuntajes(respuestas, { sexo: 'masculino' });
    const sinFiltro = calcularPuntajes(respuestas);
    expect(conFiltro[preguntaFemenina.sistema].maximo).toBeLessThan(sinFiltro[preguntaFemenina.sistema].maximo);
    expect(conFiltro[preguntaFemenina.sistema].puntos).toBe(0);
  });

  it('sin filtro de sexo, todas las preguntas activas cuentan (comportamiento por defecto)', () => {
    const puntajes = calcularPuntajes({});
    const totalMaximo = Object.values(puntajes).reduce((acc, r) => acc + r.maximo, 0);
    const esperado = PREGUNTAS_SCREENING.filter(p => p.activo).length * 4;
    expect(totalMaximo).toBe(esperado);
  });
});

describe('ordenarPorSeveridad', () => {
  it('ordena los sistemas de mayor a menor porcentaje y excluye los sin preguntas', () => {
    const preguntasCardio = PREGUNTAS_SCREENING.filter(p => p.sistema === 'Cardiovascular');
    const preguntasSueno = PREGUNTAS_SCREENING.filter(p => p.sistema === 'Sueño');
    const respuestas: Record<string, number> = {};
    for (const p of preguntasCardio) respuestas[p.id] = 4; // 100%
    for (const p of preguntasSueno) respuestas[p.id] = 1; // bajo

    const puntajes = calcularPuntajes(respuestas);
    const orden = ordenarPorSeveridad(puntajes);

    expect(orden[0].sistema).toBe('Cardiovascular');
    expect(orden.every((s, i) => i === 0 || s.porcentaje <= orden[i - 1].porcentaje)).toBe(true);
    expect(orden.find(s => s.sistema === 'Hábitos y estilo de vida')).toBeUndefined();
  });
});

describe('obtenerTopSintomas', () => {
  it('devuelve las 5 preguntas contestadas con mayor valor, de mayor a menor', () => {
    const [p1, p2, p3, p4, p5, p6] = PREGUNTAS_SCREENING;
    const respuestas = { [p1.id]: 1, [p2.id]: 4, [p3.id]: 3, [p4.id]: 2, [p5.id]: 4, [p6.id]: 0 };
    const top = obtenerTopSintomas(respuestas, 5);
    expect(top).toHaveLength(5);
    expect(top.map(s => s.valor)).toEqual([...top.map(s => s.valor)].sort((a, b) => b - a));
    expect(top.map(s => s.id)).not.toContain(p6.id); // el de valor 0 queda afuera del top 5 (hay mejores)
  });

  it('no incluye preguntas sin responder', () => {
    const [p1] = PREGUNTAS_SCREENING;
    const top = obtenerTopSintomas({ [p1.id]: 3 }, 5);
    expect(top).toEqual([{ id: p1.id, texto: p1.texto, sistema: p1.sistema, valor: 3 }]);
  });
});

describe('versión del cuestionario', () => {
  it('expone una constante de versión estable', () => {
    expect(typeof VERSION_CUESTIONARIO).toBe('number');
    expect(VERSION_CUESTIONARIO).toBeGreaterThanOrEqual(1);
  });
});
