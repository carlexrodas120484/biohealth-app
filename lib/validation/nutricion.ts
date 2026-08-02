import { z } from 'zod';
import { CODIGOS_OBJETIVOS_CLINICOS, NIVELES_ACTIVIDAD, HORARIOS_COMIDA, ESTADOS_PLAN_NUTRICIONAL } from '@/lib/clinica/nutricion';

const ComidaMenuSchema = z.object({
  horario: z.enum(HORARIOS_COMIDA as [string, ...string[]]),
  descripcion: z.string().trim().max(500),
  alternativas: z.array(z.string().trim().max(200)).max(5),
});

const RestriccionesSchema = z.object({
  alergiasAlimentarias: z.array(z.string().trim().max(100)).max(30),
  celiaquia: z.boolean(),
  vegetarianismo: z.boolean(),
  veganismo: z.boolean(),
});

const PlanAlimentarioSchema = z.object({
  numeroComidas: z.number().int().min(1).max(6),
  menuDiario: z.array(ComidaMenuSchema).max(6),
  menuSemanal: z.record(z.array(ComidaMenuSchema).max(6)).optional(),
  alimentosRecomendados: z.array(z.string().trim().max(100)).max(50),
  alimentosALimitar: z.array(z.string().trim().max(100)).max(50),
  alimentosAEvitar: z.array(z.string().trim().max(100)).max(50),
  listaCompras: z.array(z.string().trim().max(100)).max(100),
  observaciones: z.string().trim().max(4000),
  duracionDias: z.number().int().positive().max(365),
});

/** Valores calculados que el profesional puede sobrescribir (permitir al profesional editar cualquier dato). */
const CalculosOverrideSchema = z.object({
  objetivoCaloricoKcal: z.number().positive().max(10000).optional(),
  proteinaG: z.number().nonnegative().max(1000).optional(),
  carbohidratosG: z.number().nonnegative().max(2000).optional(),
  grasasG: z.number().nonnegative().max(1000).optional(),
  fibraG: z.number().nonnegative().max(200).optional(),
  aguaMl: z.number().nonnegative().max(10000).optional(),
});

export const PlanNutricionalSchema = z.object({
  objetivoClinico: z.enum(CODIGOS_OBJETIVOS_CLINICOS as [string, ...string[]]),
  pesoKg: z.number().positive().max(500),
  tallaCm: z.number().positive().max(250),
  nivelActividad: z.enum(NIVELES_ACTIVIDAD as [string, ...string[]]),
  calculosOverride: CalculosOverrideSchema.optional(),
  restricciones: RestriccionesSchema,
  plan: PlanAlimentarioSchema,
  estado: z.enum(ESTADOS_PLAN_NUTRICIONAL as [string, ...string[]]).optional(),
});

export type PlanNutricionalInput = z.infer<typeof PlanNutricionalSchema>;
