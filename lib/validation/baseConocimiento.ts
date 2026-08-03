import { z } from 'zod';

export const ESTADOS_PRINCIPIO = ['borrador', 'en_revision', 'validado', 'archivado'] as const;
export const EstadoPrincipioSchema = z.enum(ESTADOS_PRINCIPIO);
export type EstadoPrincipio = z.infer<typeof EstadoPrincipioSchema>;

export const UNIDADES_DOSIS = ['mg', 'g', 'mcg', 'ui', 'ml'] as const;
export const UnidadDosisSchema = z.enum(UNIDADES_DOSIS);

// Ampliado por la Base Farmacotécnica del MIF (migración 0025) con
// perlas/polvo/comprimidos — ampliación puramente aditiva: cualquier
// valor válido antes sigue siendo válido.
export const FORMAS_FARMACEUTICAS = ['capsula', 'sobre', 'liquido', 'perlas', 'polvo', 'comprimidos', 'comercial'] as const;
export const FormaFarmaceuticaSchema = z.enum(FORMAS_FARMACEUTICAS);

export const SEVERIDADES = ['leve', 'moderada', 'alta'] as const;
export const SeveridadSchema = z.enum(SEVERIDADES);

export const NIVELES_EVIDENCIA = ['A', 'B', 'C', 'D'] as const;
export const NivelEvidenciaSchema = z.enum(NIVELES_EVIDENCIA);

export const TIPOS_DOSIS = ['informativa', 'minima', 'usual', 'maxima'] as const;

/** Toda dosis trae fuente, o queda marcada explícitamente sin evidencia — nunca las dos cosas a la vez. */
export const DosisInputSchema = z.object({
  tipo: z.enum(TIPOS_DOSIS),
  valor: z.number().positive(),
  unidad: UnidadDosisSchema,
  frecuencia: z.string().trim().max(200).optional(),
  duracionHabitual: z.string().trim().max(200).optional(),
  referenciaId: z.string().uuid().optional(),
  sinEvidencia: z.boolean(),
  notas: z.string().trim().max(1000).optional(),
}).refine(d => d.referenciaId || d.sinEvidencia, {
  message: 'Toda dosis debe tener una referencia bibliográfica o quedar marcada como "sin evidencia cargada".',
  path: ['sinEvidencia'],
});

export const PresentacionInputSchema = z.object({
  forma: FormaFarmaceuticaSchema,
  capacidadCapsulaMg: z.number().positive().optional(),
  preferida: z.boolean().default(false),
  presentacionComercialObligatoria: z.boolean().default(false),
  notas: z.string().trim().max(500).optional(),
});

export const PropiedadesOrganolepticasSchema = z.object({
  sabor: z.string().trim().max(100).optional(),
  intensidadSabor: z.number().int().min(0).max(5).optional(),
  olor: z.string().trim().max(100).optional(),
  solubilidad: z.string().trim().max(200).optional(),
  estabilidad: z.string().trim().max(200).optional(),
  notas: z.string().trim().max(500).optional(),
}).optional();

export const ContraindicacionInputSchema = z.object({
  contraindicacion: z.string().trim().min(1).max(500),
  severidad: SeveridadSchema.default('moderada'),
});

export const InteraccionInputSchema = z.object({
  principioRelacionadoId: z.string().uuid().optional(),
  sustanciaExterna: z.string().trim().max(200).optional(),
  tipo: z.string().trim().max(100).optional(),
  descripcion: z.string().trim().min(1).max(500),
  severidad: SeveridadSchema.default('moderada'),
}).refine(i => i.principioRelacionadoId || i.sustanciaExterna, {
  message: 'Una interacción debe referenciar otro principio del catálogo o una sustancia externa.',
  path: ['sustanciaExterna'],
});

export const IncompatibilidadInputSchema = z.object({
  principioIncompatibleId: z.string().uuid(),
  motivo: z.string().trim().max(500).optional(),
});

export const EvidenciaInputSchema = z.object({
  nivelEvidencia: NivelEvidenciaSchema,
  resumen: z.string().trim().max(2000).optional(),
  referenciaId: z.string().uuid().optional(),
});

export const IndicacionInputSchema = z.object({
  indicacion: z.string().trim().min(1).max(500),
  sistemaRelacionado: z.string().trim().max(150).optional(),
});

/** Entrada completa para crear/editar un principio activo desde el panel. */
/** Forma base sin los .refine() cruzados — para poder usar .partial() en ediciones parciales (PATCH). */
export const PrincipioActivoBaseSchema = z.object({
  nombreCanonico: z.string().trim().min(2).max(200),
  nombreComercial: z.string().trim().max(200).optional(),
  descripcion: z.string().trim().max(4000).optional(),
  mecanismoAccion: z.string().trim().max(4000).optional(),
  funcionesClinicas: z.array(z.string().trim().max(200)).max(30).default([]),
  sistemasRelacionados: z.array(z.string().trim().max(100)).max(30).default([]),

  limiteEdadMinAnios: z.number().int().min(0).max(120).optional(),
  limiteEdadMaxAnios: z.number().int().min(0).max(120).optional(),
  limitePesoMinKg: z.number().min(0).max(500).optional(),
  limitePesoMaxKg: z.number().min(0).max(500).optional(),
  limiteRenal: z.string().trim().max(500).optional(),
  limiteHepatico: z.string().trim().max(500).optional(),
  contraindicadoEmbarazo: z.boolean().optional(),
  contraindicadoLactancia: z.boolean().optional(),
  contraindicadoOncologico: z.boolean().optional(),
  precaucionAnticoagulacion: z.boolean().default(false),
  precaucionAntihipertensivos: z.boolean().default(false),
  precaucionHipoglucemiantes: z.boolean().default(false),

  sinonimos: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  categorias: z.array(z.string().trim().max(100)).max(20).default([]),
  dosis: z.array(DosisInputSchema).max(10).default([]),
  presentaciones: z.array(PresentacionInputSchema).max(10).default([]),
  propiedadesOrganolepticas: PropiedadesOrganolepticasSchema,
  indicaciones: z.array(IndicacionInputSchema).max(20).default([]),
  contraindicaciones: z.array(ContraindicacionInputSchema).max(20).default([]),
  interacciones: z.array(InteraccionInputSchema).max(20).default([]),
  incompatibilidades: z.array(IncompatibilidadInputSchema).max(20).default([]),
  evidencia: z.array(EvidenciaInputSchema).max(10).default([]),
});

/** Para crear un principio: exige consistencia cruzada (límites, dosis mín/máx). */
export const PrincipioActivoInputSchema = PrincipioActivoBaseSchema
  .refine(v => v.limiteEdadMinAnios == null || v.limiteEdadMaxAnios == null || v.limiteEdadMaxAnios >= v.limiteEdadMinAnios, {
    message: 'El límite de edad máximo no puede ser menor que el mínimo.', path: ['limiteEdadMaxAnios'],
  })
  .refine(v => v.limitePesoMinKg == null || v.limitePesoMaxKg == null || v.limitePesoMaxKg >= v.limitePesoMinKg, {
    message: 'El límite de peso máximo no puede ser menor que el mínimo.', path: ['limitePesoMaxKg'],
  })
  .refine(v => {
    const minima = v.dosis.find(d => d.tipo === 'minima')?.valor;
    const maxima = v.dosis.find(d => d.tipo === 'maxima')?.valor;
    return minima == null || maxima == null || maxima >= minima;
  }, { message: 'La dosis máxima no puede ser menor que la dosis mínima.', path: ['dosis'] });

export type PrincipioActivoInput = z.infer<typeof PrincipioActivoInputSchema>;

export const TransicionEstadoSchema = z.object({
  estado: EstadoPrincipioSchema,
  motivo: z.string().trim().max(1000).optional(),
});

export const ImportarCSVSchema = z.object({
  confirmar: z.boolean().default(false),
  sobrescribirValidados: z.boolean().default(false),
});
