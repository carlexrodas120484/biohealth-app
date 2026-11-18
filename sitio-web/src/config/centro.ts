/**
 * ============================================================
 *  CONFIGURACIÓN GENERAL DEL CENTRO — BIOHEALTH
 * ============================================================
 *  Este es el archivo principal para editar datos de contacto,
 *  redes, ubicación, horarios y herramientas de medición.
 *  No hace falta tocar componentes para actualizar esta información.
 */

export const centro = {
  nombre: 'BioHealth',
  nombreCompleto: 'BioHealth – Medicina Avanzada',
  eslogan: 'Una nueva forma de cuidar tu salud.',
  descripcionCorta:
    'Centro médico multidisciplinario en Ayolas, Misiones, Paraguay. Atención integral, personalizada y humana.',

  /** URL pública definitiva del sitio (sin barra final). Se usa para SEO y datos estructurados. */
  urlSitio: 'https://www.biohealth.com.py',

  /**
   * Logo. Si se deja vacío se usa el logotipo vectorial incluido.
   * Para usar el logo original: copiar el archivo a /public/images/ (por ejemplo logo.svg o logo.png)
   * y escribir aquí la ruta: '/images/logo.svg'
   */
  logo: {
    src: '',
    /** Versión clara para fondos oscuros (opcional). */
    srcClaro: '',
    alt: 'BioHealth – Medicina Avanzada',
  },

  contacto: {
    /**
     * Número oficial de WhatsApp en formato internacional, SOLO dígitos, sin "+" ni espacios.
     * Ejemplo Paraguay: '595981123456'. Mientras esté vacío, WhatsApp se abre
     * con el mensaje listo para elegir el contacto manualmente.
     */
    whatsapp: '595973913205',
    /** Teléfono para mostrar (opcional). Ej.: '+595 981 123 456' */
    telefonoVisible: '+595 973 913 205',
    email: '',
  },

  ubicacion: {
    direccion: '', // Ej.: 'Calle Mcal. López c/ ...'. Vacío = solo se muestra la ciudad.
    ciudad: 'Ayolas',
    departamento: 'Misiones',
    pais: 'Paraguay',
    codigoPais: 'PY',
    /** Coordenadas aproximadas de Ayolas. Reemplazar por las exactas del centro. */
    latitud: -27.3928,
    longitud: -56.9006,
    /**
     * Texto o dirección que usará el mapa de Google. Cuando tengan la ficha de
     * Google Maps del centro, pegar aquí su nombre exacto o dirección.
     */
    consultaMapa: 'Ayolas, Misiones, Paraguay',
    /** Enlace directo a la ficha de Google Maps (opcional). */
    enlaceMapa: '',
  },

  /** Horario general del centro (lo que se muestra en Contacto y en los datos para Google). */
  horarioGeneral: [
    { dias: 'Lunes a viernes', horas: 'A confirmar' },
    { dias: 'Sábados', horas: 'A confirmar' },
  ],
  /**
   * Horario para datos estructurados (Google). Completar cuando esté definido;
   * vacío = no se publica horario en buscadores.
   * Ejemplo: [{ dias: ['Monday','Tuesday','Wednesday','Thursday','Friday'], abre: '07:30', cierra: '19:00' }]
   */
  horarioSEO: [] as { dias: string[]; abre: string; cierra: string }[],

  redes: {
    instagram: { usuario: 'bio_healthpy', url: 'https://www.instagram.com/bio_healthpy/' },
    facebook: '', // URL completa, opcional
    tiktok: '', // URL completa, opcional
  },

  /**
   * Publicaciones de Instagram para mostrar incrustadas (opcional).
   * Pegar enlaces completos, p. ej.: 'https://www.instagram.com/p/XXXXXXXX/'
   */
  publicacionesInstagram: [] as string[],

  /**
   * Formas de pago aceptadas. Completar con las reales (p. ej. 'Efectivo', 'Transferencia bancaria').
   * Vacío = en el sitio se indica que se informan al confirmar el turno.
   */
  formasDePago: [] as string[],

  /** Medición. Dejar vacío para no cargar ningún script de terceros. */
  analitica: {
    googleAnalyticsId: '', // Ej.: 'G-XXXXXXXXXX'
    metaPixelId: '', // Ej.: '123456789012345'
  },
};

export type Centro = typeof centro;
