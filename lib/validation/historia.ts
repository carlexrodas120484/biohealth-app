import { z } from 'zod';
import { PREGUNTAS_SCREENING } from '@/lib/clinica/cuestionario';

/**
 * Campos de la historia clínica (Paso 1). Coincide 1:1 con los campos que
 * envía HistoriaClinicaForm. Se guarda en `historias_clinicas.historia`
 * (jsonb), por eso agregar un campo nuevo acá no necesita migración — sólo
 * hace falta que el formulario lo mande.
 *
 * La revisión por sistemas ya existe como módulo propio (Cuestionario /
 * Paso 2, `lib/clinica/cuestionario.ts`, guardado en `respuestas`/
 * `puntajes` de esta misma tabla) — no se duplica acá como texto libre.
 * IMC se calcula en el cliente a partir de peso/talla; no se persiste,
 * para no arrastrar un valor derivado que puede quedar desincronizado.
 */
export const HistoriaClinicaSchema = z
  .object({
    motivo: z.string().trim().max(2000),
    enfermedadActual: z.string().trim().max(4000),
    inicioEvolucion: z.string().trim().max(2000),
    cirugias: z.string().trim().max(2000),
    hospitalizaciones: z.string().trim().max(2000),
    alimentacion: z.string().trim().max(2000),
    aguaLitros: z.number().min(0).max(20),
    suenoHoras: z.number().min(0).max(24),
    estres: z.number().int().min(0).max(10),
    actividadFisica: z.string().trim().max(2000),
    bristol: z.number().int().min(1).max(7),
    peso: z.number().min(0).max(500),
    talla: z.number().min(0).max(250),
    presionArterial: z.string().trim().max(20),
    frecuenciaCardiaca: z.number().min(0).max(300),
    saturacion: z.number().min(0).max(100),
    cintura: z.number().min(0).max(300),
    fiebrePersistente: z.boolean(),
    perdidaPesoInvoluntaria: z.boolean(),
    sangrado: z.boolean(),
    dolorToracico: z.boolean(),
    disneaReposo: z.boolean(),
    deficitNeurologico: z.boolean(),
    impresionClinica: z.string().trim().max(4000),
    planInicial: z.string().trim().max(4000),
  })
  .partial();

export type HistoriaClinicaValues = z.infer<typeof HistoriaClinicaSchema>;

/**
 * Respuestas del cuestionario funcional (Paso 2): escala 0–4 por
 * pregunta. La clave debe ser el id de una pregunta activa y real — una
 * clave que no corresponde a ninguna pregunta se rechaza (422) en vez de
 * guardarse silenciosamente como dato huérfano.
 */
const IDS_PREGUNTAS_ACTIVAS = PREGUNTAS_SCREENING.filter(p => p.activo).map(p => p.id);
const IdPreguntaSchema =
  IDS_PREGUNTAS_ACTIVAS.length > 0
    ? z.enum(IDS_PREGUNTAS_ACTIVAS as [string, ...string[]])
    : z.never();

export const RespuestasScreeningSchema = z.record(IdPreguntaSchema, z.number().int().min(0).max(4));
