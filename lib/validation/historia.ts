import { z } from 'zod';

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

/** Respuestas del cuestionario funcional (Paso 2): escala 0–4 por pregunta. */
export const RespuestasScreeningSchema = z.record(z.number().int().min(0).max(4));
