/**
 * ============================================================
 *  EDUCACIÓN EN SALUD — ARTÍCULOS DEL BLOG
 * ============================================================
 *  Para publicar un artículo nuevo, agregar un objeto al inicio de la lista.
 *  `contenido` es una lista de bloques:
 *    { tipo: 'p', texto }          párrafo
 *    { tipo: 'h2', texto }         subtítulo
 *    { tipo: 'lista', items: [] }  lista con viñetas
 *    { tipo: 'nota', texto }       recuadro destacado
 *  `slug` es la dirección del artículo: /blog/<slug> (minúsculas, guiones, sin tildes).
 *  `publicado: false` permite guardar borradores sin mostrarlos.
 */

export type Bloque =
  | { tipo: 'p'; texto: string }
  | { tipo: 'h2'; texto: string }
  | { tipo: 'lista'; items: string[] }
  | { tipo: 'nota'; texto: string };

export interface Articulo {
  slug: string;
  titulo: string;
  resumen: string;
  categoria: string;
  fecha: string; // AAAA-MM-DD
  autor: string;
  lecturaMin: number;
  foto: string;
  publicado: boolean;
  contenido: Bloque[];
}

const u = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=75`;

export const articulos: Articulo[] = [
  {
    slug: 'chequeo-medico-preventivo',
    titulo: 'Chequeo médico preventivo: por qué no esperar a tener síntomas',
    resumen:
      'Muchas condiciones frecuentes avanzan en silencio. Un control periódico permite detectarlas a tiempo y conversar sobre prevención.',
    categoria: 'Prevención',
    fecha: '2026-11-01',
    autor: 'Equipo BioHealth',
    lecturaMin: 4,
    foto: u('photo-1579684385127-1ef15d508118'),
    publicado: true,
    contenido: [
      {
        tipo: 'p',
        texto:
          'Es habitual consultar al médico solo cuando algo duele o molesta. Sin embargo, condiciones como la presión arterial elevada, la glucosa alta o el colesterol elevado pueden no dar síntomas durante años.',
      },
      { tipo: 'h2', texto: '¿Qué incluye un control preventivo?' },
      {
        tipo: 'p',
        texto:
          'Depende de la edad, los antecedentes personales y familiares y el estilo de vida. En general, el profesional conversa sobre tus hábitos, realiza un examen físico y, si corresponde, indica estudios.',
      },
      {
        tipo: 'lista',
        items: [
          'Control de presión arterial, peso y perímetro de cintura',
          'Análisis de laboratorio según indicación médica',
          'Revisión de vacunas y controles por edad',
          'Orientación sobre alimentación, actividad física y descanso',
        ],
      },
      { tipo: 'h2', texto: '¿Cada cuánto conviene hacerlo?' },
      {
        tipo: 'p',
        texto:
          'No hay una frecuencia única para todas las personas. Tu médico te indicará el intervalo adecuado según tu situación.',
      },
      {
        tipo: 'nota',
        texto:
          'Este artículo es informativo y no reemplaza una consulta médica. Ante cualquier síntoma o duda, consultá con un profesional.',
      },
    ],
  },
  {
    slug: 'presion-arterial-conocer-tus-numeros',
    titulo: 'Presión arterial: la importancia de conocer tus números',
    resumen:
      'La hipertensión es uno de los principales factores de riesgo cardiovascular. Medirla de forma correcta es el primer paso.',
    categoria: 'Salud cardiovascular',
    fecha: '2026-10-15',
    autor: 'Equipo BioHealth',
    lecturaMin: 4,
    foto: u('photo-1628348068343-c6a848d2b6dd'),
    publicado: true,
    contenido: [
      {
        tipo: 'p',
        texto:
          'La presión arterial elevada suele no dar síntomas, por eso se la conoce como un problema silencioso. Controlarla periódicamente permite actuar a tiempo junto con tu médico.',
      },
      { tipo: 'h2', texto: 'Recomendaciones para medirla en casa' },
      {
        tipo: 'lista',
        items: [
          'Descansar sentado al menos cinco minutos antes de medir',
          'Evitar café, tabaco y actividad física en los 30 minutos previos',
          'Apoyar la espalda y el brazo, con los pies en el suelo',
          'Anotar los valores y llevarlos a la consulta',
        ],
      },
      { tipo: 'h2', texto: 'Hábitos que ayudan' },
      {
        tipo: 'p',
        texto:
          'Reducir la sal, mantener actividad física regular, cuidar el peso y dormir bien son medidas que forman parte del cuidado cardiovascular. Las decisiones sobre tratamiento siempre deben tomarse con el profesional.',
      },
      {
        tipo: 'nota',
        texto:
          'Este artículo es informativo y no reemplaza una consulta médica. No modifiques ni suspendas medicación sin indicación profesional.',
      },
    ],
  },
  {
    slug: 'alimentacion-habitos-sostenibles',
    titulo: 'Alimentación consciente: hábitos simples y sostenibles',
    resumen:
      'Más que dietas estrictas, los cambios pequeños y constantes son los que se mantienen en el tiempo.',
    categoria: 'Nutrición',
    fecha: '2026-09-30',
    autor: 'Equipo BioHealth',
    lecturaMin: 3,
    foto: u('photo-1490645935967-10de6ba17061'),
    publicado: true,
    contenido: [
      {
        tipo: 'p',
        texto:
          'Comer mejor no significa prohibir alimentos, sino organizar la alimentación de forma que sea placentera, variada y adaptada a tu rutina.',
      },
      { tipo: 'h2', texto: 'Algunas ideas para empezar' },
      {
        tipo: 'lista',
        items: [
          'Incluir verduras y frutas de estación en las comidas principales',
          'Priorizar el agua frente a bebidas azucaradas',
          'Planificar las compras para tener opciones saludables a mano',
          'Comer sin apuro y prestar atención a las señales de saciedad',
        ],
      },
      {
        tipo: 'p',
        texto:
          'Cada persona tiene necesidades distintas. Una evaluación nutricional permite diseñar un plan acorde a tu salud, tus gustos y tus objetivos.',
      },
      {
        tipo: 'nota',
        texto: 'Este artículo es informativo y no reemplaza una consulta con un profesional de la salud.',
      },
    ],
  },
];

export const articulosPublicados = () =>
  articulos.filter((a) => a.publicado).sort((a, b) => b.fecha.localeCompare(a.fecha));
