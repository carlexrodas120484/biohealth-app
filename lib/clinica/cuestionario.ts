export type PreguntaScreening = {
  id: string;
  sistema: string;
  texto: string;
};

const bloque = (sistema: string, items: string[]): PreguntaScreening[] =>
  items.map((texto, i) => ({
    id: `${sistema.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i + 1}`,
    sistema,
    texto,
  }));

export const PREGUNTAS_SCREENING: PreguntaScreening[] = [
  ...bloque('Digestivo', [
    'Distensión o inflamación abdominal', 'Gases frecuentes', 'Acidez o reflujo',
    'Digestión lenta o pesadez', 'Dolor abdominal', 'Estreñimiento',
    'Diarrea o deposiciones blandas', 'Intolerancia a determinados alimentos',
  ]),
  ...bloque('Metabólico', [
    'Deseo intenso de dulces o harinas', 'Somnolencia después de comer',
    'Aumento de peso con facilidad', 'Dificultad para bajar de peso',
    'Hambre poco después de comer', 'Cambios bruscos de energía durante el día',
  ]),
  ...bloque('Cardiovascular', [
    'Palpitaciones', 'Falta de aire con esfuerzos habituales', 'Hinchazón de piernas o tobillos',
    'Manos o pies fríos', 'Mareos al levantarse', 'Dolor u opresión en el pecho',
  ]),
  ...bloque('Neurológico y cognitivo', [
    'Dolor de cabeza', 'Dificultad para concentrarse', 'Olvidos frecuentes',
    'Sensación de niebla mental', 'Hormigueos o adormecimiento', 'Cambios de humor o irritabilidad',
  ]),
  ...bloque('Sueño y estrés', [
    'Dificultad para conciliar el sueño', 'Despertares nocturnos',
    'Sueño no reparador', 'Cansancio al despertar', 'Estrés difícil de controlar',
    'Ansiedad o tensión interna',
  ]),
  ...bloque('Endocrino y hormonal', [
    'Sensibilidad excesiva al frío o al calor', 'Caída de cabello', 'Piel seca',
    'Cambios menstruales o síntomas menopáusicos', 'Disminución de la libido',
    'Cambios de peso sin explicación clara',
  ]),
  ...bloque('Inmunológico', [
    'Infecciones frecuentes', 'Alergias respiratorias o cutáneas',
    'Congestión nasal persistente', 'Dolores musculares generalizados',
    'Dolores articulares', 'Recuperación lenta después de enfermar',
  ]),
  ...bloque('Hepático y detoxificación', [
    'Náuseas o malestar con comidas grasas', 'Sabor amargo en la boca',
    'Dolor o pesadez bajo las costillas derechas', 'Sensibilidad marcada a alcohol o medicamentos',
    'Picazón sin causa clara', 'Olor corporal o sudoración inusual',
  ]),
  ...bloque('Nutricional y energía', [
    'Fatiga durante el día', 'Debilidad muscular', 'Calambres frecuentes',
    'Uñas frágiles', 'Pérdida de cabello difusa', 'Heridas que tardan en cicatrizar',
    'Poca tolerancia al ejercicio', 'Antojos de sal',
  ]),
];

export const ESCALA_SCREENING = [
  'Nunca', 'Leve/ocasional', 'Moderado', 'Frecuente', 'Intenso/limitante',
];

export function calcularPuntajes(respuestas: Record<string, number>) {
  const resultado: Record<string, { puntos: number; maximo: number; porcentaje: number }> = {};
  for (const pregunta of PREGUNTAS_SCREENING) {
    const actual = resultado[pregunta.sistema] ?? { puntos: 0, maximo: 0, porcentaje: 0 };
    actual.puntos += respuestas[pregunta.id] ?? 0;
    actual.maximo += 4;
    actual.porcentaje = Math.round((actual.puntos / actual.maximo) * 100);
    resultado[pregunta.sistema] = actual;
  }
  return resultado;
}

