/**
 * lib/validation/baseFarmacotecnica.ts
 *
 * Esquemas Zod para los datos nuevos de la Base Farmacotécnica
 * Inteligente (migración 0025): perfil organoléptico ampliado,
 * farmacotecnia, sabores compatibles y preferencias del paciente.
 *
 * Sigue el mismo patrón que lib/validation/baseConocimiento.ts (del
 * cual reexporta FORMAS_FARMACEUTICAS/UNIDADES_DOSIS para no duplicar
 * la fuente de verdad) y no modifica ningún esquema existente.
 */

import { z } from 'zod';
import { FORMAS_FARMACEUTICAS, FormaFarmaceuticaSchema, UNIDADES_DOSIS, UnidadDosisSchema } from './baseConocimiento';

export { FORMAS_FARMACEUTICAS, FormaFarmaceuticaSchema, UNIDADES_DOSIS, UnidadDosisSchema };

// ---- Catálogo cerrado de sabores de la botica ----
export const SABORES_DISPONIBLES = ['naranja', 'mandarina', 'limon', 'uva', 'pina', 'frutilla', 'durazno', 'mburucuya'] as const;
export const SaborSchema = z.enum(SABORES_DISPONIBLES);
export type Sabor = z.infer<typeof SaborSchema>;

/** Etiqueta de presentación (con acentos) para cuando haga falta mostrar el sabor — este módulo no tiene UI propia todavía. */
export const ETIQUETA_SABOR: Record<Sabor, string> = {
  naranja: 'Naranja', mandarina: 'Mandarina', limon: 'Limón', uva: 'Uva',
  pina: 'Piña', frutilla: 'Frutilla', durazno: 'Durazno', mburucuya: 'Mburucuyá',
};

// ---- Perfil organoléptico ampliado ----
export const TIPOS_SABOR = ['amargo', 'acido', 'salado', 'sulfuroso', 'terroso', 'neutro'] as const;
export const TipoSaborSchema = z.enum(TIPOS_SABOR);

export const INTENSIDADES_SABOR = ['baja', 'media', 'alta', 'extrema'] as const;
export const IntensidadSaborSchema = z.enum(INTENSIDADES_SABOR);

export const FACILIDADES_ENMASCARAR = ['facil', 'media', 'dificil'] as const;
export const FacilidadEnmascararSchema = z.enum(FACILIDADES_ENMASCARAR);

export const PerfilOrganolepticoInputSchema = z.object({
  tipoSabor: TipoSaborSchema.optional(),
  intensidad: IntensidadSaborSchema.optional(),
  facilidadEnmascarar: FacilidadEnmascararSchema.optional(),
});

// ---- Farmacotecnia ----
export const FarmacotecniaInputSchema = z.object({
  compatibleSobres: z.boolean().optional(),
  compatibleLiquidos: z.boolean().optional(),
  compatibleCapsulas: z.boolean().optional(),
  higroscopico: z.boolean().optional(),
  fotosensible: z.boolean().optional(),
  sensibleCalor: z.boolean().optional(),
  notas: z.string().trim().max(1000).optional(),
});

// ---- Capsulación: tamaño y límite específico del principio ----
// `tamanoCapsula` queda como texto libre acotado (ej. "00", "0", "1")
// en vez de un enum cerrado: la convención de numeración de cápsulas
// varía según el proveedor/fabricante y no es un dato clínico que este
// proyecto deba fijar por su cuenta.
export const CapsulacionInputSchema = z.object({
  tamanoCapsula: z.string().trim().max(20).optional(),
  maxCapsulasPorToma: z.number().int().positive().max(20).optional(),
});

// ---- Sabores compatibles de un principio (Regla 4 del MIF) ----
export const SaborPrincipioInputSchema = z.object({
  sabor: SaborSchema,
  nivelAceptacion: z.number().int().min(1).max(5).default(3),
  notas: z.string().trim().max(500).optional(),
});

// ---- Compatibilidad explícita entre dos principios ----
export const CompatibilidadInputSchema = z.object({
  principioCompatibleId: z.string().uuid(),
  notas: z.string().trim().max(500).optional(),
});

// ---- Preferencias del paciente (Reglas 4 y 5 del MIF) ----
export const DIFICULTADES_TRAGAR = ['si', 'no', 'parcial'] as const;
export const DificultadTragarSchema = z.enum(DIFICULTADES_TRAGAR);

export const PREFERENCIAS_FORMA = ['capsula', 'sobre', 'liquido'] as const;
export const PreferenciaFormaSchema = z.enum(PREFERENCIAS_FORMA);

export const PreferenciasPacienteInputSchema = z.object({
  saborFavorito: SaborSchema.optional(),
  saboresRechazados: z.array(SaborSchema).max(8).default([]),
  dificultadTragarCapsulas: DificultadTragarSchema.optional(),
  preferenciaForma: PreferenciaFormaSchema.optional(),
  notas: z.string().trim().max(1000).optional(),
}).refine(v => !v.saborFavorito || !v.saboresRechazados.includes(v.saborFavorito), {
  message: 'El sabor favorito no puede estar también en la lista de sabores rechazados.',
  path: ['saborFavorito'],
});

export type PreferenciasPacienteInput = z.infer<typeof PreferenciasPacienteInputSchema>;
