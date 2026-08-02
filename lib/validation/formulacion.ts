import { z } from 'zod';

export const HorarioSchema = z.enum(['ayunas', 'desayuno', 'almuerzo', 'cena', 'antes_de_dormir']);
export const PresentacionSchema = z.enum(['capsula', 'sobre', 'liquido', 'comercial']);
export const EstadoFormulacionSchema = z.enum(['borrador', 'sugerida', 'revisada', 'aprobada', 'archivada']);

/**
 * Entrada estructurada de un principio activo para el motor de reglas
 * (distinta del `items` de texto libre que ya usan la firma y el PDF).
 * La dosis siempre la define el médico — el motor no la sugiere.
 */
export const IngredienteInputSchema = z.object({
  id: z.string().min(1).max(100),
  nombre: z.string().trim().min(1).max(150),
  dosisPorTomaMg: z.number().positive().max(100000),
  vecesPorDia: z.number().int().positive().max(10),
  horario: HorarioSchema,
  presentacionElegida: PresentacionSchema.optional(),
  bloquearPresentacion: z.boolean().optional(),
});

export const IngredientesSchema = z.array(IngredienteInputSchema).max(30);

export type IngredienteInput = z.infer<typeof IngredienteInputSchema>;
