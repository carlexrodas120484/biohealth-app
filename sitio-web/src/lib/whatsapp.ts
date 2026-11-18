import { centro } from '@/config/centro';
import { agenda } from '@/config/agenda';

const soloDigitos = (s: string) => s.replace(/\D/g, '');

/** Construye un enlace de WhatsApp al número oficial (o selector de contacto si aún no está configurado). */
export function enlaceWhatsApp(mensaje?: string): string {
  const numero = soloDigitos(centro.contacto.whatsapp);
  const base = numero ? `https://wa.me/${numero}` : 'https://wa.me/';
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

export const whatsappConfigurado = () => soloDigitos(centro.contacto.whatsapp).length >= 8;

export const mensajeConsultaGeneral = () =>
  `Hola, ${centro.nombre}. Quisiera recibir información para agendar una consulta.`;

export const mensajeServicio = (servicio: string) =>
  `Hola, ${centro.nombre}. Quisiera recibir información sobre ${servicio}.`;

export interface SolicitudTurno {
  nombre: string;
  especialidad: string;
  profesional: string;
  fecha: string; // ya formateada para lectura
  horario: string;
  motivo?: string;
}

/** Mensaje organizado para la solicitud de turno. No incluye datos clínicos. */
export function mensajeTurno(s: SolicitudTurno): string {
  const lineas = [
    `Hola, ${centro.nombre}. Quisiera solicitar un turno.`,
    '',
    `*Nombre:* ${s.nombre}`,
    `*Especialidad:* ${s.especialidad}`,
    `*Profesional:* ${s.profesional}`,
    `*Fecha deseada:* ${s.fecha}`,
    `*Horario preferido:* ${s.horario}`,
  ];
  if (s.motivo) lineas.push(`*Tipo de consulta:* ${s.motivo}`);
  lineas.push('', 'Entiendo que el turno queda sujeto a confirmación. Muchas gracias.');
  return lineas.join('\n');
}

export const avisoTurno = agenda.aviso;
