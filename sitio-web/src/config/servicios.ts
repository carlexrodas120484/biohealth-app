/**
 * ============================================================
 *  SERVICIOS
 * ============================================================
 *  Para agregar un servicio: copiar un bloque, cambiar el `id`
 *  (sin espacios ni tildes) y completar los textos.
 *  Para cambiar la fotografía: colocar la imagen en /public/images/servicios/
 *  y escribir la ruta en `foto`, p. ej. '/images/servicios/cardiologia.jpg'.
 *
 *  Pauta editorial: describir qué se hace y para quién, sin prometer
 *  resultados ni curación.
 */

export type CategoriaServicio = 'consulta' | 'estudio' | 'bienestar';

export interface Servicio {
  id: string;
  nombre: string;
  categoria: CategoriaServicio;
  /** Una frase para la tarjeta. */
  resumen: string;
  /** Párrafos de la página del servicio. */
  descripcion: string[];
  /** Qué incluye / cuándo se indica. */
  puntos: string[];
  foto: string;
  /** Aclaración visible (opcional). */
  aviso?: string;
  /** Palabras clave para SEO local. */
  palabrasClave: string[];
}

const u = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=75`;

export const categorias: Record<CategoriaServicio, string> = {
  consulta: 'Especialidades',
  estudio: 'Estudios',
  bienestar: 'Evaluación complementaria',
};

export const servicios: Servicio[] = [
  {
    id: 'medicina-familiar',
    nombre: 'Medicina Familiar',
    categoria: 'consulta',
    resumen: 'Atención continua para cada etapa de la vida, con una mirada integral de la persona y su familia.',
    descripcion: [
      'La Medicina Familiar acompaña la salud de niños, adultos y personas mayores de manera continua. Es el punto de partida ideal para controles periódicos, consultas por síntomas frecuentes y el seguimiento de condiciones crónicas.',
      'Trabajamos con tiempo para escuchar, evaluar el contexto de cada paciente y coordinar, cuando corresponde, con otras especialidades del centro.',
    ],
    puntos: [
      'Chequeos preventivos y controles periódicos',
      'Seguimiento de condiciones crónicas',
      'Orientación sobre hábitos y prevención',
      'Coordinación con otras especialidades',
    ],
    foto: u('photo-1576091160550-2173dba999ef'),
    palabrasClave: ['médico de familia Ayolas', 'medicina familiar Misiones'],
  },
  {
    id: 'medicina-integrativa',
    nombre: 'Medicina Integrativa y Ortomolecular',
    categoria: 'consulta',
    resumen: 'Un abordaje que integra la medicina convencional con la evaluación nutricional y del estilo de vida.',
    descripcion: [
      'La Medicina Integrativa considera a la persona en su totalidad: antecedentes, alimentación, descanso, actividad física y entorno. La perspectiva ortomolecular pone atención en el estado nutricional y en los micronutrientes.',
      'Las indicaciones se basan en la evaluación clínica y en la evidencia disponible, y complementan —no reemplazan— los tratamientos médicos convencionales.',
    ],
    puntos: [
      'Evaluación clínica integral',
      'Análisis del estilo de vida y la alimentación',
      'Plan personalizado con seguimiento',
      'Trabajo coordinado con el equipo multidisciplinario',
    ],
    foto: u('photo-1505751172876-fa1923c5c528'),
    palabrasClave: ['medicina integrativa Paraguay', 'medicina ortomolecular Ayolas'],
  },
  {
    id: 'ginecologia-obstetricia',
    nombre: 'Ginecología y Obstetricia',
    categoria: 'consulta',
    resumen: 'Cuidado de la salud de la mujer y acompañamiento profesional durante el embarazo.',
    descripcion: [
      'Consultas ginecológicas de control, orientación en salud reproductiva y seguimiento del embarazo en un entorno de confianza y respeto.',
      'El servicio se complementa con ecografía ginecológica y obstétrica dentro del mismo centro.',
    ],
    puntos: [
      'Control ginecológico periódico',
      'Seguimiento prenatal',
      'Orientación en salud reproductiva',
      'Ecografías dentro del centro',
    ],
    foto: u('photo-1584515933487-779824d29309'),
    palabrasClave: ['ginecólogo Ayolas', 'obstetricia Misiones Paraguay'],
  },
  {
    id: 'cardiologia',
    nombre: 'Cardiología',
    categoria: 'consulta',
    resumen: 'Evaluación y seguimiento de la salud cardiovascular, con estudios complementarios en el centro.',
    descripcion: [
      'La consulta cardiológica permite evaluar factores de riesgo cardiovascular, controlar la presión arterial y realizar el seguimiento de pacientes con condiciones cardíacas.',
      'Cuando el profesional lo indica, el electrocardiograma y el ecocardiograma pueden realizarse en BioHealth.',
    ],
    puntos: [
      'Evaluación de riesgo cardiovascular',
      'Control de presión arterial',
      'Aptos y evaluaciones prequirúrgicas',
      'Electrocardiograma y ecocardiograma',
    ],
    foto: u('photo-1628348068343-c6a848d2b6dd'),
    palabrasClave: ['cardiólogo Ayolas', 'cardiología Misiones'],
  },
  {
    id: 'psiquiatria',
    nombre: 'Psiquiatría',
    categoria: 'consulta',
    resumen: 'Atención médica especializada en salud mental, con confidencialidad y respeto.',
    descripcion: [
      'La consulta psiquiátrica aborda la evaluación, el diagnóstico y el tratamiento médico de condiciones de salud mental, en un espacio confidencial.',
      'Se trabaja de forma coordinada con Psicología cuando el plan de cuidado lo requiere.',
    ],
    puntos: [
      'Evaluación psiquiátrica',
      'Seguimiento y ajuste de tratamientos',
      'Trabajo conjunto con Psicología',
      'Atención confidencial',
    ],
    foto: u('photo-1573497620053-ea5300f94f21'),
    palabrasClave: ['psiquiatra Ayolas', 'psiquiatría Misiones Paraguay'],
  },
  {
    id: 'psicologia',
    nombre: 'Psicología',
    categoria: 'consulta',
    resumen: 'Un espacio profesional para hablar, comprender y fortalecer el bienestar emocional.',
    descripcion: [
      'Acompañamiento psicológico para atravesar momentos difíciles, gestionar el estrés y trabajar en el bienestar emocional, con un enfoque profesional y empático.',
    ],
    puntos: [
      'Psicoterapia individual',
      'Orientación ante situaciones de estrés o cambio',
      'Coordinación con Psiquiatría cuando es necesario',
      'Atención confidencial',
    ],
    foto: u('photo-1544027993-37dbfe43562a'),
    palabrasClave: ['psicólogo Ayolas', 'psicología Misiones'],
  },
  {
    id: 'nutricion',
    nombre: 'Nutrición',
    categoria: 'consulta',
    resumen: 'Planes de alimentación personalizados, realistas y sostenibles en el tiempo.',
    descripcion: [
      'La consulta nutricional evalúa hábitos, necesidades y objetivos de cada persona para construir un plan de alimentación adaptado a su vida diaria.',
    ],
    puntos: [
      'Evaluación nutricional',
      'Plan de alimentación personalizado',
      'Educación alimentaria',
      'Seguimiento periódico',
    ],
    foto: u('photo-1490645935967-10de6ba17061'),
    palabrasClave: ['nutricionista Ayolas', 'nutrición Misiones Paraguay'],
  },
  {
    id: 'control-peso',
    nombre: 'Control médico del peso',
    categoria: 'consulta',
    resumen: 'Acompañamiento médico y nutricional para alcanzar un peso saludable de forma segura.',
    descripcion: [
      'Un programa con evaluación médica, orientación nutricional y seguimiento, pensado para trabajar el peso con criterios de salud y no solo estéticos.',
      'Los objetivos se definen de manera individual y realista junto con el profesional.',
    ],
    puntos: [
      'Evaluación médica inicial',
      'Abordaje nutricional y de hábitos',
      'Controles de seguimiento',
      'Trabajo interdisciplinario',
    ],
    foto: u('photo-1512621776951-a57141f2eefd'),
    palabrasClave: ['control de peso Ayolas', 'tratamiento médico del peso Paraguay'],
  },
  {
    id: 'ecografia',
    nombre: 'Ecografía ginecológica y obstétrica',
    categoria: 'estudio',
    resumen: 'Estudios ecográficos para el control ginecológico y el seguimiento del embarazo.',
    descripcion: [
      'Ecografías realizadas en el centro como parte del control ginecológico y del seguimiento prenatal, según indicación médica.',
    ],
    puntos: ['Ecografía ginecológica', 'Ecografía obstétrica', 'Informe del estudio', 'Coordinación con la consulta'],
    foto: u('photo-1631815588090-d4bfec5b1ccb'),
    palabrasClave: ['ecografía Ayolas', 'ecografía obstétrica Misiones'],
  },
  {
    id: 'electrocardiograma',
    nombre: 'Electrocardiograma',
    categoria: 'estudio',
    resumen: 'Registro de la actividad eléctrica del corazón, rápido y no invasivo.',
    descripcion: [
      'El electrocardiograma (ECG) es un estudio sencillo y no invasivo que registra la actividad eléctrica del corazón. Se realiza en pocos minutos y suele solicitarse en controles, aptos y evaluaciones cardiológicas.',
    ],
    puntos: ['Estudio no invasivo', 'Duración breve', 'Aptos y evaluaciones prequirúrgicas', 'Según indicación médica'],
    foto: u('photo-1530026405186-ed1f139313f8'),
    palabrasClave: ['electrocardiograma Ayolas', 'ECG Misiones Paraguay'],
  },
  {
    id: 'ecocardiograma',
    nombre: 'Ecocardiograma',
    categoria: 'estudio',
    resumen: 'Ecografía del corazón para evaluar su estructura y funcionamiento.',
    descripcion: [
      'El ecocardiograma utiliza ultrasonido para observar el corazón en movimiento y evaluar sus cavidades, válvulas y función. Es un estudio no invasivo indicado por el profesional tratante.',
    ],
    puntos: ['Estudio no invasivo', 'Evaluación estructural y funcional', 'Informe del estudio', 'Según indicación médica'],
    foto: u('photo-1559757175-5700dde675bc'),
    palabrasClave: ['ecocardiograma Ayolas', 'ecocardiografía Misiones'],
  },
  {
    id: 'bioescaner',
    nombre: 'Bioescáner',
    categoria: 'bienestar',
    resumen: 'Herramienta complementaria de evaluación de bienestar, integrada a la consulta.',
    descripcion: [
      'El bioescáner se utiliza en BioHealth como una herramienta complementaria que ayuda a orientar la conversación sobre bienestar y hábitos durante la consulta.',
      'No es un método de diagnóstico clínico validado y no reemplaza la evaluación médica, los análisis de laboratorio ni los estudios por imágenes. Sus resultados siempre se interpretan en el contexto de la consulta con el profesional.',
    ],
    puntos: [
      'Complemento de la consulta médica',
      'Orientación sobre bienestar y hábitos',
      'Interpretación a cargo del profesional',
      'No reemplaza estudios diagnósticos',
    ],
    aviso:
      'El bioescáner es una herramienta complementaria de evaluación de bienestar. No constituye un diagnóstico clínico validado ni sustituye estudios médicos.',
    foto: u('photo-1581595219315-a187dd40c322'),
    palabrasClave: ['bioescáner Ayolas', 'evaluación de bienestar Paraguay'],
  },
];

export const servicioPorId = (id: string) => servicios.find((s) => s.id === id);
