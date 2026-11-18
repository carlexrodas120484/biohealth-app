/**
 * ============================================================
 *  EQUIPO MÉDICO
 * ============================================================
 *  Para incorporar un profesional: copiar el bloque de ejemplo
 *  (comentado al final), completar los datos REALES y guardar.
 *
 *  - `servicios`: ids de servicios.ts que atiende (definen en qué
 *    especialidades aparece en el formulario de turnos).
 *  - `horarios`: lo que se muestra en su tarjeta. Editable libremente.
 *  - `franjas`: horarios que el paciente puede elegir al solicitar turno.
 *    Si se deja vacío se usan las franjas generales de agenda.ts.
 *  - `foto`: ruta en /public/images/equipo/. Vacío = monograma elegante.
 *
 *  Importante: publicar solo datos y credenciales verificadas.
 */

export interface Horario {
  dias: string;
  horas: string;
}

export interface Profesional {
  id: string;
  nombre: string;
  /** Título que antecede al nombre (Dr., Dra., Lic., etc.). */
  titulo: string;
  especialidad: string;
  servicios: string[];
  /** Texto breve opcional. Dejar vacío si no hay información verificada. */
  bio?: string;
  /** Registro profesional (opcional, solo si es real). */
  registro?: string;
  foto: string;
  horarios: Horario[];
  franjas: string[];
  destacado?: boolean;
  /** Si es false no aparece en el sitio (útil para preparar perfiles). */
  activo: boolean;
}

export const profesionales: Profesional[] = [
  {
    id: 'carlos-rodas',
    titulo: 'Dr.',
    nombre: 'Carlos Rodas',
    especialidad: 'Medicina Familiar, Integrativa y Ortomolecular',
    servicios: ['medicina-familiar', 'medicina-integrativa', 'control-peso', 'bioescaner'],
    bio: '',
    registro: '',
    foto: '',
    horarios: [{ dias: 'Días y horarios', horas: 'A confirmar' }],
    franjas: [],
    destacado: true,
    activo: true,
  },

  // ---- Plantilla para nuevos profesionales (descomentar y completar) ----
  // {
  //   id: 'nombre-apellido',
  //   titulo: 'Dra.',
  //   nombre: 'Nombre Apellido',
  //   especialidad: 'Cardiología',
  //   servicios: ['cardiologia', 'electrocardiograma', 'ecocardiograma'],
  //   bio: '',
  //   registro: '',
  //   foto: '/images/equipo/nombre-apellido.jpg',
  //   horarios: [
  //     { dias: 'Martes', horas: '14:00 – 18:00' },
  //     { dias: 'Jueves', horas: '08:00 – 12:00' },
  //   ],
  //   franjas: ['14:00', '14:30', '15:00', '15:30'],
  //   activo: true,
  // },
];

export const profesionalesActivos = () => profesionales.filter((p) => p.activo);
export const nombreCompleto = (p: Profesional) => `${p.titulo} ${p.nombre}`.trim();
