export type NivelEvidencia = 'A' | 'B' | 'C' | 'D';

export type FuenteClinica = {
  id: string;
  titulo: string;
  tema: string;
  nivel: NivelEvidencia;
  uso: string;
  estado: 'Vigente' | 'Revisar vigencia' | 'Solo referencia';
  advertencia?: string;
};

export const NIVELES_EVIDENCIA: Record<NivelEvidencia, { nombre: string; descripcion: string }> = {
  A: { nombre: 'Guía o fuente oficial', descripcion: 'Prioridad para seguridad, límites, contraindicaciones y decisiones clínicas.' },
  B: { nombre: 'Manual profesional', descripcion: 'Apoyo clínico sujeto a contraste con fuentes oficiales vigentes.' },
  C: { nombre: 'Material docente', descripcion: 'Sirve para razonamiento y formación; no define una dosis por sí solo.' },
  D: { nombre: 'Formulario o material comercial', descripcion: 'Solo genera ideas para revisión; nunca prescribe automáticamente.' },
};

// Índice editorial inicial del material entregado por el profesional. El contenido
// no se convierte en reglas de prescripción hasta una revisión documental trazable.
export const FUENTES_CLINICAS: FuenteClinica[] = [
  { id: 'vit-a', titulo: 'Manual de conductas de suplementación de vitamina A', tema: 'Vitaminas', nivel: 'A', uso: 'Prevención, límites y población objetivo', estado: 'Revisar vigencia' },
  { id: 'alergia', titulo: 'Diretrizes de alergia (partes 1 y 2)', tema: 'Alergia', nivel: 'A', uso: 'Evaluación y seguridad clínica', estado: 'Revisar vigencia' },
  { id: 'ultraprocesados', titulo: 'BMJ — alimentos ultraprocesados', tema: 'Nutrición', nivel: 'A', uso: 'Contexto de evidencia nutricional', estado: 'Revisar vigencia' },
  { id: 'pujol', titulo: 'Manual de formulações — Ana Paula Pujol', tema: 'Formulación', nivel: 'B', uso: 'Consulta profesional y contraste de fórmulas', estado: 'Solo referencia' },
  { id: 'semiologia', titulo: 'Semiologia ortomolecular y análisis clínicos', tema: 'Semiología', nivel: 'C', uso: 'Formación y razonamiento clínico', estado: 'Solo referencia' },
  { id: 'vitaminas', titulo: 'Deficiencias de vitaminas y hierro', tema: 'Micronutrientes', nivel: 'C', uso: 'Apoyo docente; confirmar diagnóstico y límites', estado: 'Solo referencia', advertencia: 'Folato: descartar déficit de B12 antes de indicar.' },
  { id: 'enzimas', titulo: 'Enzimas digestivas — resumen y fórmula sugerida', tema: 'Digestivo', nivel: 'D', uso: 'Idea de formulación para revisión individual', estado: 'Solo referencia' },
  { id: 'magistral', titulo: 'Protocolo de soporte magistral complementario', tema: 'Formulación', nivel: 'D', uso: 'Referencia comercial; verificar cada ingrediente', estado: 'Solo referencia' },
  { id: 'emagrecimento', titulo: 'Suplementación inteligente/avanzada en emagrecimiento', tema: 'Peso y metabolismo', nivel: 'D', uso: 'Material docente-comercial', estado: 'Solo referencia' },
  { id: 'orforglipron', titulo: 'Orforglipron — material aportado', tema: 'Farmacoterapia', nivel: 'D', uso: 'No usar como ficha regulatoria', estado: 'Solo referencia', advertencia: 'Usar exclusivamente la ficha oficial vigente para dosis y contraindicaciones.' },
];

export function resumenFuentes() {
  return (Object.keys(NIVELES_EVIDENCIA) as NivelEvidencia[]).map(nivel => ({
    nivel,
    cantidad: FUENTES_CLINICAS.filter(f => f.nivel === nivel).length,
    ...NIVELES_EVIDENCIA[nivel],
  }));
}
