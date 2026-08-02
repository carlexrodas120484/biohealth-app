import { z } from 'zod';
import { CODIGOS_PATRONES } from '@/lib/clinica/patrones';

/**
 * Decisión del médico sobre un patrón sugerido. El motor recalcula
 * siempre puntaje/nivel/evidencias/fechaCalculo/version en el servidor;
 * el cliente sólo puede mandar estado/prioridad/observaciones — nunca
 * el puntaje ni la evidencia, así ningún cliente puede fabricar
 * evidencia falsa ni forzar un puntaje que el motor no calculó.
 */
export const DecisionPatronSchema = z.object({
  codigo: z.enum(CODIGOS_PATRONES as [string, ...string[]]),
  estado: z.enum(['sugerido', 'confirmado', 'descartado']),
  prioridad: z.enum(['baja', 'media', 'alta', 'urgente']).optional(),
  observacionesMedico: z.string().trim().max(2000).optional(),
});

export const DecisionesPatronesSchema = z.array(DecisionPatronSchema).max(CODIGOS_PATRONES.length);

export type DecisionPatron = z.infer<typeof DecisionPatronSchema>;
