import { z } from 'zod';
import { CODIGOS_FASES } from '@/lib/clinica/planTerapeutico';

/**
 * Decisión del médico sobre una fase del plan. El servidor siempre
 * recalcula prioridad/evidencias/fechaCalculo/version por defecto — el
 * médico puede pisar prioridad/orden/duración/objetivo/observaciones,
 * pero nunca la evidencia. `codigo` puede ser cualquiera de las 6
 * fases del catálogo aunque el motor no la haya sugerido: así el
 * médico puede "agregar" una fase manualmente.
 */
export const DecisionFaseSchema = z.object({
  codigo: z.enum(CODIGOS_FASES as [string, ...string[]]),
  estado: z.enum(['sugerida', 'activa', 'completada', 'pausada', 'descartada']).optional(),
  prioridad: z.enum(['baja', 'media', 'alta', 'urgente']).optional(),
  orden: z.number().int().min(1).max(100).optional(),
  duracionEstimadaSemanas: z.number().int().min(1).max(52).optional(),
  objetivo: z.string().trim().max(1000).optional(),
  observacionesMedico: z.string().trim().max(2000).optional(),
});

export const DecisionesFasesSchema = z.array(DecisionFaseSchema).max(CODIGOS_FASES.length);

export type DecisionFase = z.infer<typeof DecisionFaseSchema>;
