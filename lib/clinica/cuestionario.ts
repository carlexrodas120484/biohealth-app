/**
 * Cuestionario funcional (Paso 2). Screening de cribado por sistemas —
 * NO es diagnóstico médico. Las preguntas de acá son las mismas que ya
 * existían (portadas del prototipo); lo que cambia en esta revisión es
 * la organización por sistema y el modelo de cada pregunta (orden, peso,
 * activo, grupo clínico), no el contenido clínico.
 *
 * Los `id` de pregunta son estables e independientes del sistema al que
 * pertenecen: si una pregunta se reclasifica a otro sistema más
 * adelante, su `id` no cambia, así que las respuestas ya guardadas
 * siguen siendo válidas.
 */

export type Sexo = 'femenino' | 'masculino';

export type SistemaCuestionario = {
  id: string;
  nombre: string;
  orden: number;
};

export const SISTEMAS_CUESTIONARIO: SistemaCuestionario[] = [
  { id: 'digestivo-alto', nombre: 'Digestivo alto', orden: 1 },
  { id: 'intestinal', nombre: 'Intestinal', orden: 2 },
  { id: 'hepatico-detox', nombre: 'Hepático y detoxificación', orden: 3 },
  { id: 'metabolico-glucemico', nombre: 'Metabólico y glucémico', orden: 4 },
  { id: 'cardiovascular', nombre: 'Cardiovascular', orden: 5 },
  { id: 'neurologico-cognitivo', nombre: 'Neurológico y cognitivo', orden: 6 },
  { id: 'sueno', nombre: 'Sueño', orden: 7 },
  { id: 'estres-salud-mental', nombre: 'Estrés y salud mental', orden: 8 },
  { id: 'tiroides', nombre: 'Tiroides', orden: 9 },
  { id: 'hormonal', nombre: 'Hormonal', orden: 10 },
  { id: 'inmunologico', nombre: 'Inmunológico', orden: 11 },
  { id: 'inflamacion-dolor', nombre: 'Inflamación y dolor', orden: 12 },
  { id: 'piel-cabello-unas', nombre: 'Piel, cabello y uñas', orden: 13 },
  { id: 'energia-mitocondrial', nombre: 'Energía y función mitocondrial', orden: 14 },
  { id: 'musculo-esqueletico', nombre: 'Músculo-esquelético', orden: 15 },
  { id: 'habitos-estilo-vida', nombre: 'Hábitos y estilo de vida', orden: 16 },
];

const NOMBRES_SISTEMA = new Set(SISTEMAS_CUESTIONARIO.map(s => s.nombre));

export type PreguntaScreening = {
  id: string;
  texto: string;
  sistema: string;
  orden: number;
  peso: number;
  activo: boolean;
  grupo?: Sexo;
};

const PESO_DEFECTO = 1;

/** Arma preguntas de un sistema con id estable, peso por defecto 1 y activo por defecto. */
function preguntas(
  sistema: string,
  items: Array<string | { texto: string; grupo?: Sexo; peso?: number; activo?: boolean }>
): PreguntaScreening[] {
  if (!NOMBRES_SISTEMA.has(sistema)) {
    throw new Error(`Sistema desconocido: ${sistema}`);
  }
  return items.map((item, i) => {
    const def = typeof item === 'string' ? { texto: item } : item;
    return {
      id: `q${String(CONTADOR_ID++).padStart(3, '0')}`,
      texto: def.texto,
      sistema,
      orden: i + 1,
      peso: def.peso ?? PESO_DEFECTO,
      activo: def.activo ?? true,
      grupo: def.grupo,
    };
  });
}

let CONTADOR_ID = 1;

export const PREGUNTAS_SCREENING: PreguntaScreening[] = [
  ...preguntas('Digestivo alto', [
    'Acidez o reflujo',
    'Digestión lenta o pesadez',
  ]),
  ...preguntas('Intestinal', [
    'Distensión o inflamación abdominal',
    'Gases frecuentes',
    'Dolor abdominal',
    'Estreñimiento',
    'Diarrea o deposiciones blandas',
    'Intolerancia a determinados alimentos',
  ]),
  ...preguntas('Hepático y detoxificación', [
    'Náuseas o malestar con comidas grasas',
    'Sabor amargo en la boca',
    'Dolor o pesadez bajo las costillas derechas',
    'Sensibilidad marcada a alcohol o medicamentos',
    'Picazón sin causa clara',
    'Olor corporal o sudoración inusual',
  ]),
  ...preguntas('Metabólico y glucémico', [
    'Deseo intenso de dulces o harinas',
    'Somnolencia después de comer',
    'Aumento de peso con facilidad',
    'Dificultad para bajar de peso',
    'Hambre poco después de comer',
    'Cambios bruscos de energía durante el día',
  ]),
  ...preguntas('Cardiovascular', [
    'Palpitaciones',
    'Falta de aire con esfuerzos habituales',
    'Hinchazón de piernas o tobillos',
    'Manos o pies fríos',
    'Mareos al levantarse',
    'Dolor u opresión en el pecho',
  ]),
  ...preguntas('Neurológico y cognitivo', [
    'Dolor de cabeza',
    'Dificultad para concentrarse',
    'Olvidos frecuentes',
    'Sensación de niebla mental',
    'Hormigueos o adormecimiento',
    'Cambios de humor o irritabilidad',
  ]),
  ...preguntas('Sueño', [
    'Dificultad para conciliar el sueño',
    'Despertares nocturnos',
    'Sueño no reparador',
    'Cansancio al despertar',
  ]),
  ...preguntas('Estrés y salud mental', [
    'Estrés difícil de controlar',
    'Ansiedad o tensión interna',
  ]),
  ...preguntas('Tiroides', [
    'Sensibilidad excesiva al frío o al calor',
    'Caída de cabello',
    'Piel seca',
  ]),
  ...preguntas('Hormonal', [
    { texto: 'Cambios menstruales o síntomas menopáusicos', grupo: 'femenino' },
    'Disminución de la libido',
    'Cambios de peso sin explicación clara',
    'Antojos de sal',
  ]),
  ...preguntas('Inmunológico', [
    'Infecciones frecuentes',
    'Alergias respiratorias o cutáneas',
    'Congestión nasal persistente',
    'Recuperación lenta después de enfermar',
  ]),
  ...preguntas('Inflamación y dolor', [
    'Dolores musculares generalizados',
    'Dolores articulares',
  ]),
  ...preguntas('Piel, cabello y uñas', [
    'Uñas frágiles',
    'Pérdida de cabello difusa',
    'Heridas que tardan en cicatrizar',
  ]),
  ...preguntas('Energía y función mitocondrial', [
    'Fatiga durante el día',
    'Poca tolerancia al ejercicio',
  ]),
  ...preguntas('Músculo-esquelético', [
    'Debilidad muscular',
    'Calambres frecuentes',
  ]),
  // Hábitos y estilo de vida: reservado, todavía sin preguntas propias
  // de screening (los hábitos ya se registran como texto libre en la
  // Historia Clínica). Se deja el sistema visible/preparado para sumar
  // preguntas más adelante, sin inventar contenido clínico ahora.
];

export const ESCALA_SCREENING = [
  'Nunca', 'Leve/ocasional', 'Moderado', 'Frecuente', 'Intenso/limitante',
];

export type Severidad = 'sin_alteracion' | 'leve' | 'moderada' | 'alta' | 'muy_alta';

export const ETIQUETA_SEVERIDAD: Record<Severidad, string> = {
  sin_alteracion: 'Sin alteración relevante',
  leve: 'Alteración leve',
  moderada: 'Alteración moderada',
  alta: 'Alteración alta',
  muy_alta: 'Alteración muy alta',
};

/** Cribado funcional, no diagnóstico. 0–19/20–39/40–59/60–79/80–100. */
export function clasificarSeveridad(porcentaje: number): Severidad {
  if (porcentaje >= 80) return 'muy_alta';
  if (porcentaje >= 60) return 'alta';
  if (porcentaje >= 40) return 'moderada';
  if (porcentaje >= 20) return 'leve';
  return 'sin_alteracion';
}

export type ResultadoSistema = {
  puntos: number;
  maximo: number;
  porcentaje: number;
  severidad: Severidad;
};

/**
 * puntaje_sistema = suma(respuesta × peso); porcentaje = puntos/máximo × 100.
 * Devuelve TODOS los sistemas registrados (incluso sin preguntas todavía,
 * en 0/0/0%), para que el resumen y el orden de sistemas sean estables.
 * Si se pasa `sexo`, las preguntas con `grupo` distinto no cuentan ni en
 * puntos ni en máximo (no penalizan a quien no puede responderlas).
 */
export function calcularPuntajes(
  respuestas: Record<string, number>,
  opciones?: { sexo?: Sexo }
): Record<string, ResultadoSistema> {
  const resultado: Record<string, ResultadoSistema> = {};
  for (const s of SISTEMAS_CUESTIONARIO) {
    resultado[s.nombre] = { puntos: 0, maximo: 0, porcentaje: 0, severidad: 'sin_alteracion' };
  }

  for (const pregunta of PREGUNTAS_SCREENING) {
    if (!pregunta.activo) continue;
    if (pregunta.grupo && opciones?.sexo && pregunta.grupo !== opciones.sexo) continue;

    const actual = resultado[pregunta.sistema];
    const valor = respuestas[pregunta.id] ?? 0;
    actual.puntos += valor * pregunta.peso;
    actual.maximo += 4 * pregunta.peso;
  }

  for (const r of Object.values(resultado)) {
    r.porcentaje = r.maximo > 0 ? Math.round((r.puntos / r.maximo) * 100) : 0;
    r.severidad = clasificarSeveridad(r.porcentaje);
  }

  return resultado;
}

export type SistemaOrdenado = ResultadoSistema & { sistema: string };

/** Sistemas con preguntas, ordenados de mayor a menor porcentaje. */
export function ordenarPorSeveridad(puntajes: Record<string, ResultadoSistema>): SistemaOrdenado[] {
  return Object.entries(puntajes)
    .filter(([, r]) => r.maximo > 0)
    .map(([sistema, r]) => ({ sistema, ...r }))
    .sort((a, b) => b.porcentaje - a.porcentaje);
}

export type SintomaDestacado = { id: string; texto: string; sistema: string; valor: number };

/** Las `n` preguntas contestadas con mayor valor (respuesta × peso). Empate: se mantiene el orden de aparición. */
export function obtenerTopSintomas(respuestas: Record<string, number>, n = 5): SintomaDestacado[] {
  return PREGUNTAS_SCREENING
    .filter(p => p.activo && respuestas[p.id] !== undefined)
    .map(p => ({ id: p.id, texto: p.texto, sistema: p.sistema, valor: respuestas[p.id] * p.peso }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, n);
}

export const ADVERTENCIA_CRIBADO =
  'Este resultado es una herramienta de apoyo al cribado funcional y no constituye un diagnóstico médico.';

export type ResumenClinico = {
  sistemas: SistemaOrdenado[];
  topSintomas: SintomaDestacado[];
  advertencia: string;
};

/** Resumen para el médico: sistemas de mayor a menor severidad + top 5 síntomas + advertencia. */
export function construirResumenClinico(
  respuestas: Record<string, number>,
  opciones?: { sexo?: Sexo }
): ResumenClinico {
  const puntajes = calcularPuntajes(respuestas, opciones);
  return {
    sistemas: ordenarPorSeveridad(puntajes),
    topSintomas: obtenerTopSintomas(respuestas, 5),
    advertencia: ADVERTENCIA_CRIBADO,
  };
}

/**
 * Versión del contenido del cuestionario (preguntas/sistemas), no del
 * registro de un paciente puntual. Se guarda junto con cada cuestionario
 * para poder detectar más adelante que fue respondido con una versión
 * anterior de las preguntas, sin necesidad de mantener un historial de
 * versiones por paciente en esta fase.
 */
export const VERSION_CUESTIONARIO = 1;
