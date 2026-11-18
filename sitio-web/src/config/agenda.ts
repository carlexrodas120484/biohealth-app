/**
 * ============================================================
 *  CONFIGURACIÓN DE LA AGENDA (solicitud de turnos por WhatsApp)
 * ============================================================
 *  El sitio NO reserva turnos automáticamente: arma un mensaje para
 *  WhatsApp y el equipo confirma disponibilidad. Aquí se definen los
 *  horarios que el paciente puede elegir como preferencia.
 */

export const agenda = {
  /** Días de la semana en que se atiende (0 = domingo, 6 = sábado). */
  diasDeAtencion: [1, 2, 3, 4, 5, 6],

  /** Cuántos días hacia adelante se puede solicitar. */
  diasMaximosAnticipacion: 60,

  /** Franjas horarias generales ofrecidas cuando el profesional no define las suyas. */
  franjasGenerales: [
    'Mañana (07:30 – 11:30)',
    'Mediodía (11:30 – 14:00)',
    'Tarde (14:00 – 18:00)',
    'Última hora (18:00 – 20:00)',
  ],

  /** Opciones de tipo de consulta (no clínicas). */
  motivos: ['Primera consulta', 'Control / seguimiento', 'Estudio programado', 'Otro'],

  /** Texto legal que acompaña cada solicitud. */
  aviso:
    'La solicitud no constituye un turno confirmado. El equipo de BioHealth responderá por WhatsApp para confirmar día y horario según disponibilidad.',
};
