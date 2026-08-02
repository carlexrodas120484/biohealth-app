import { z } from 'zod';

/** Todos los valores son opcionales: un control puede registrar sólo un subconjunto. */
export const LaboratorioInputSchema = z.object({
  fecha: z.string().refine(v => !Number.isNaN(new Date(v).getTime()), 'Fecha inválida'),
  pesoKg: z.number().min(0).max(500).optional(),
  tallaCm: z.number().min(0).max(250).optional(),
  cinturaCm: z.number().min(0).max(300).optional(),
  presionSistolica: z.number().min(0).max(300).optional(),
  presionDiastolica: z.number().min(0).max(200).optional(),
  glucemiaMgDl: z.number().min(0).max(1000).optional(),
  hba1cPct: z.number().min(0).max(20).optional(),
  trigliceridosMgDl: z.number().min(0).max(2000).optional(),
  hdlMgDl: z.number().min(0).max(200).optional(),
  ldlMgDl: z.number().min(0).max(500).optional(),
  vitaminaDNgMl: z.number().min(0).max(200).optional(),
  homaIr: z.number().min(0).max(50).optional(),
  pcrMgL: z.number().min(0).max(500).optional(),
  ferritinaNgMl: z.number().min(0).max(5000).optional(),
  observaciones: z.string().trim().max(2000).optional(),
});

export type LaboratorioInput = z.infer<typeof LaboratorioInputSchema>;
