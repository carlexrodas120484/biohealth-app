/**
 * Textos institucionales editables: Sobre BioHealth, Por qué elegirnos y Preguntas frecuentes.
 */
import { centro } from './centro';

export const sobre = {
  titulo: 'Medicina con criterio científico y trato humano',
  introduccion:
    'BioHealth nace en Ayolas con una convicción simple: cada paciente merece tiempo, escucha y una atención médica que lo considere en su totalidad. Reunimos distintas especialidades bajo un mismo enfoque, para que el cuidado de tu salud sea más claro, coordinado y cercano.',
  pilares: [
    {
      titulo: 'Filosofía',
      texto:
        'Entendemos la salud como un equilibrio entre cuerpo, mente y entorno. Por eso integramos la evaluación clínica con el estilo de vida, la alimentación y el bienestar emocional.',
    },
    {
      titulo: 'Misión',
      texto:
        'Brindar atención médica integral, personalizada y basada en evidencia científica, acompañando a cada paciente con profesionalismo y calidez en cada etapa de su cuidado.',
    },
    {
      titulo: 'Compromiso',
      texto:
        'Información clara, respeto por tus decisiones, confidencialidad y seguimiento. Explicamos cada indicación para que puedas participar activamente del cuidado de tu salud.',
    },
  ],
};

export const motivos = [
  {
    titulo: 'Atención personalizada',
    texto: 'Consultas con el tiempo necesario para escuchar, evaluar y explicar. Cada plan se adapta a tu historia y a tu realidad.',
    icono: 'persona',
  },
  {
    titulo: 'Equipo multidisciplinario',
    texto: 'Distintas especialidades trabajando de forma coordinada, para que no tengas que recorrer el camino solo.',
    icono: 'equipo',
  },
  {
    titulo: 'Tecnología al servicio del paciente',
    texto: 'Estudios como electrocardiograma, ecocardiograma y ecografía en el mismo centro, integrados a la consulta.',
    icono: 'tecnologia',
  },
  {
    titulo: 'Seguimiento médico',
    texto: 'Controles programados y comunicación clara para acompañar la evolución de tu salud en el tiempo.',
    icono: 'seguimiento',
  },
] as const;

const pagos =
  centro.formasDePago.length > 0
    ? `Aceptamos: ${centro.formasDePago.join(', ')}. Ante cualquier duda, consultanos por WhatsApp.`
    : 'Las formas de pago disponibles y el costo de cada consulta o estudio se informan por WhatsApp al momento de confirmar el turno.';

export const preguntasFrecuentes = [
  {
    grupo: 'Consultas',
    pregunta: '¿Cómo es la primera consulta?',
    respuesta:
      'En la primera consulta el profesional conoce tus antecedentes, el motivo de consulta y tus hábitos. A partir de esa evaluación te explica los pasos a seguir y, si corresponde, los estudios necesarios.',
  },
  {
    grupo: 'Consultas',
    pregunta: '¿Qué debo llevar a la consulta?',
    respuesta:
      'Documento de identidad, estudios y análisis previos que tengas, y la lista de medicamentos o suplementos que estés tomando.',
  },
  {
    grupo: 'Agendamiento',
    pregunta: '¿Cómo solicito un turno?',
    respuesta:
      'Completá el formulario de turnos eligiendo especialidad, profesional, fecha y horario. Al presionar "Solicitar turno" se abre WhatsApp con tu mensaje listo para enviar. El equipo responderá para confirmar.',
  },
  {
    grupo: 'Agendamiento',
    pregunta: '¿El turno queda confirmado al enviar el mensaje?',
    respuesta:
      'No. El mensaje es una solicitud. El turno queda confirmado cuando el equipo de BioHealth te responde con el día y horario asignados según disponibilidad.',
  },
  {
    grupo: 'Agendamiento',
    pregunta: '¿Puedo reprogramar o cancelar un turno?',
    respuesta: 'Sí. Escribinos por WhatsApp con la mayor anticipación posible para liberar el horario o reprogramarlo.',
  },
  {
    grupo: 'Especialidades',
    pregunta: '¿Qué especialidades y estudios ofrecen?',
    respuesta:
      'Medicina Familiar, Medicina Integrativa y Ortomolecular, Ginecología y Obstetricia, Cardiología, Psiquiatría, Psicología, Nutrición y control médico del peso. También realizamos ecografía ginecológica y obstétrica, electrocardiograma y ecocardiograma.',
  },
  {
    grupo: 'Especialidades',
    pregunta: '¿El bioescáner reemplaza un diagnóstico médico?',
    respuesta:
      'No. El bioescáner es una herramienta complementaria de evaluación de bienestar. No es un método de diagnóstico clínico validado y no sustituye la consulta médica, los análisis de laboratorio ni los estudios por imágenes.',
  },
  {
    grupo: 'Formas de pago',
    pregunta: '¿Qué formas de pago aceptan?',
    respuesta: pagos,
  },
  {
    grupo: 'Privacidad',
    pregunta: '¿Debo enviar información médica por WhatsApp?',
    respuesta:
      'No es necesario. Para solicitar un turno solo pedimos tu nombre y la especialidad. La información clínica se conversa de forma reservada durante la consulta.',
  },
];
