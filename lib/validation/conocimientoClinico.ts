/**
 * lib/validation/conocimientoClinico.ts
 *
 * Esquemas Zod para `conocimiento_clinico` (migración 0026): la
 * indicación clínica de un principio activo para un objetivo
 * terapéutico + fase determinados. Sigue el mismo patrón base/
 * refinado que lib/validation/baseConocimiento.ts (ADR-0003 en
 * BIOHEALTH_DECISIONS.md): el esquema base es un z.object plano apto
 * para `.partial()` en ediciones; el esquema de entrada agrega las
 * validaciones cruzadas necesarias para una creación completa.
 */

import { z } from 'zod';
import { UNIDADES_DOSIS, UnidadDosisSchema, NivelEvidenciaSchema } from './baseConocimiento';

export { UNIDADES_DOSIS, UnidadDosisSchema, NivelEvidenciaSchema };

// Mismo enum de fase que fases_terapeuticas/objetivos_terapeuticos/formulaciones_terapeuticas.
export const FASES = ['restore', 'repair', 'reset', 'target', 'regenerate', 'balance'] as const;
export const FaseSchema = z.enum(FASES);
export type Fase = z.infer<typeof FaseSchema>;

// Mismo enum que lib/clinica/patrones.ts (`Prioridad`).
export const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'] as const;
export const PrioridadSchema = z.enum(PRIORIDADES);
export type Prioridad = z.infer<typeof PrioridadSchema>;

// Mismo catálogo que lib/clinica/formulacion.ts (`Horario`).
export const HORARIOS_CONOCIMIENTO = ['ayunas', 'desayuno', 'almuerzo', 'cena', 'antes_de_dormir'] as const;
export const HorarioConocimientoSchema = z.enum(HORARIOS_CONOCIMIENTO);

export const ESTADOS_CONOCIMIENTO = ['borrador', 'en_revision', 'validado', 'archivado'] as const;
export const EstadoConocimientoSchema = z.enum(ESTADOS_CONOCIMIENTO);
export type EstadoConocimiento = z.infer<typeof EstadoConocimientoSchema>;

/** Forma base sin refinamientos cruzados — apta para `.partial()` en ediciones. */
export const ConocimientoClinicoBaseSchema = z.object({
  principioActivoId: z.string().uuid(),
  objetivoTerapeutico: z.string().trim().min(2).max(200),
  fase: FaseSchema,
  prioridad: PrioridadSchema.default('media'),

  evidencia: z.string().trim().max(2000).optional(),
  nivelEvidencia: NivelEvidenciaSchema.optional(),

  dosisHabitual: z.number().positive().optional(),
  dosisMinima: z.number().positive().optional(),
  dosisMaxima: z.number().positive().optional(),
  unidadDosis: UnidadDosisSchema.optional(),

  horario: HorarioConocimientoSchema.optional(),
  observaciones: z.string().trim().max(2000).optional(),

  contraindicaciones: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
  interacciones: z.array(z.string().trim().min(1).max(300)).max(30).default([]),

  requiereSobre: z.boolean().default(false),
  requiereCapsula: z.boolean().default(false),
  ordenSugerido: z.number().int().min(0).max(1000).default(0),
});

/** Para crear una indicación: exige consistencia cruzada (dosis mín/máx, sobre/cápsula mutuamente excluyentes). */
export const ConocimientoClinicoInputSchema = ConocimientoClinicoBaseSchema
  .refine(v => v.dosisMinima == null || v.dosisMaxima == null || v.dosisMaxima >= v.dosisMinima, {
    message: 'La dosis máxima no puede ser menor que la dosis mínima.', path: ['dosisMaxima'],
  })
  .refine(v => !(v.requiereSobre && v.requiereCapsula), {
    message: 'Una indicación no puede requerir sobre y cápsula al mismo tiempo.', path: ['requiereCapsula'],
  });

export type ConocimientoClinicoInput = z.infer<typeof ConocimientoClinicoInputSchema>;

export const TransicionEstadoConocimientoSchema = z.object({
  estado: EstadoConocimientoSchema,
  motivo: z.string().trim().max(1000).optional(),
});
