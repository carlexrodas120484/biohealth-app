/**
 * Motor de patrones funcionales (Paso 4, Diagnóstico). Reglas
 * deterministas y transparentes — no hay modelo opaco: cada patrón
 * expone exactamente qué dato lo activó (`evidencias`).
 *
 * Cribado funcional, no diagnóstico médico. El sistema NUNCA marca un
 * patrón como `confirmado` por sí solo — nace siempre en `sugerido` y
 * sólo el médico puede pasarlo a `confirmado` o `descartado`
 * (app/api/pacientes/[id]/diagnostico/route.ts).
 *
 * Fuentes de evidencia, en orden de peso (según lo pedido):
 *  - cuestionario funcional → evidencia fuerte (domina el puntaje base, 0–100)
 *  - historia clínica (signos/banderas estructurados) → evidencia moderada (+20 fijos)
 *  - bioescáner (hallazgos con severidad) → evidencia complementaria (+5/+10 por hallazgo, tope +20)
 *
 * Medicación, alergias y antecedentes: la consigna pide que "puedan
 * reducir o bloquear sugerencias". Interpretar automáticamente texto
 * libre de antecedentes/medicación para bloquear un patrón requeriría
 * juicio clínico que este motor no tiene forma segura de codificar sin
 * inventar reglas no sustentadas — así que en vez de una reducción
 * numérica opaca, esos campos se exponen tal cual junto a cada patrón
 * (`contextoPaciente` en la ruta) para que el médico los vea al decidir
 * confirmar o descartar. El "bloqueo" real lo hace el médico al
 * descartar, no un cálculo automático.
 */

import { clasificarSeveridad, type Severidad } from './cuestionario';

export type FuenteEvidencia = 'cuestionario' | 'historia' | 'bioescaner';

export type EvidenciaPatron = {
  fuente: FuenteEvidencia;
  descripcion: string;
  aporte: number;
};

export type Prioridad = 'baja' | 'media' | 'alta' | 'urgente';

export type EstadoPatron = 'sugerido' | 'confirmado' | 'descartado';

export type PatronFuncional = {
  codigo: string;
  nombre: string;
  descripcion: string;
  puntaje: number;
  nivel: Severidad;
  prioridad: Prioridad;
  evidencias: EvidenciaPatron[];
  fechaCalculo: string;
  version: number;
  estado: EstadoPatron;
  observacionesMedico: string;
};

export const VERSION_ALGORITMO_PATRONES = 1;

export const ADVERTENCIA_DIAGNOSTICO =
  'Resultado de cribado funcional. No sustituye diagnóstico médico.';

const BONUS_HISTORIA = 20;
const BONUS_BIOESCANER_ALTO = 10;
const BONUS_BIOESCANER_MED = 5;
const TOPE_BONUS_BIOESCANER = 20;
const UMBRAL_MINIMO = 20; // por debajo de esto no se sugiere: "no inventar patrones sin datos"

type PuntajesCuestionario = Record<string, { puntos: number; maximo: number; porcentaje: number }>;

export type HistoriaRelevante = {
  bristol?: number;
  estres?: number;
  suenoHoras?: number;
  fiebrePersistente?: boolean;
  dolorToracico?: boolean;
  disneaReposo?: boolean;
  deficitNeurologico?: boolean;
};

export type HallazgoBioescaner = {
  id: string;
  parametro: string;
  valor?: string;
  severidad: 'ok' | 'med' | 'alto';
};

type Regla = {
  codigo: string;
  nombre: string;
  descripcion: string;
  sistemas: string[];
  historiaCompatible?: (h: HistoriaRelevante) => boolean;
  historiaDescripcion?: string;
  palabrasBioescaner: string[];
};

const REGLAS: Regla[] = [
  {
    codigo: 'digestivo-alto',
    nombre: 'Disfunción digestiva alta',
    descripcion: 'Síntomas compatibles con reflujo, digestión lenta o malestar digestivo alto.',
    sistemas: ['Digestivo alto'],
    palabrasBioescaner: ['helicobacter', 'gastritis', 'endoscopia'],
  },
  {
    codigo: 'intestinal',
    nombre: 'Disbiosis o alteración intestinal',
    descripcion: 'Patrón compatible con alteración del tránsito o la microbiota intestinal.',
    sistemas: ['Intestinal'],
    historiaCompatible: h => typeof h.bristol === 'number' && (h.bristol <= 2 || h.bristol >= 6),
    historiaDescripcion: 'Historia clínica · escala de Bristol en rango extremo (estreñimiento o diarrea)',
    palabrasBioescaner: ['disbiosis', 'microbiota', 'calprotectina'],
  },
  {
    codigo: 'hepatico-detox',
    nombre: 'Sobrecarga hepática o detoxificación comprometida',
    descripcion: 'Síntomas compatibles con sobrecarga hepática o capacidad de detoxificación reducida.',
    sistemas: ['Hepático y detoxificación'],
    palabrasBioescaner: ['transaminasas', 'ggt', 'higado', 'hepatico'],
  },
  {
    codigo: 'metabolico-glucemico',
    nombre: 'Alteración glucémica o metabólica',
    descripcion: 'Patrón compatible con disregulación glucémica o metabólica.',
    sistemas: ['Metabólico y glucémico'],
    palabrasBioescaner: ['glucosa', 'hba1c', 'insulina', 'hemoglobina glicosilada'],
  },
  {
    codigo: 'inflamacion-sistemica',
    nombre: 'Inflamación sistémica',
    descripcion: 'Conjunto de síntomas compatible con un estado inflamatorio de base.',
    sistemas: ['Inflamación y dolor'],
    historiaCompatible: h => h.fiebrePersistente === true,
    historiaDescripcion: 'Historia clínica · bandera roja: fiebre persistente',
    palabrasBioescaner: ['pcr', 'proteina c reactiva', 'vsg', 'ferritina'],
  },
  {
    codigo: 'estres-oxidativo',
    nombre: 'Estrés oxidativo',
    descripcion: 'Combinación de baja energía e inflamación compatible con estrés oxidativo.',
    sistemas: ['Energía y función mitocondrial', 'Inflamación y dolor'],
    palabrasBioescaner: ['estres oxidativo', 'radicales libres', 'malondialdehido'],
  },
  {
    codigo: 'disfuncion-mitocondrial',
    nombre: 'Disfunción mitocondrial',
    descripcion: 'Fatiga y baja tolerancia al esfuerzo compatibles con baja eficiencia energética celular.',
    sistemas: ['Energía y función mitocondrial'],
    palabrasBioescaner: ['mitocondrial', 'acido lactico', 'lactato'],
  },
  {
    codigo: 'tiroides-funcional',
    nombre: 'Alteración tiroidea funcional',
    descripcion: 'Síntomas compatibles con alteración funcional tiroidea.',
    sistemas: ['Tiroides'],
    palabrasBioescaner: ['tsh', 't4', 't3', 'tiroides'],
  },
  {
    codigo: 'suprarrenal-estres-cronico',
    nombre: 'Disfunción suprarrenal o estrés crónico',
    descripcion: 'Patrón compatible con estrés crónico sostenido y su impacto funcional.',
    sistemas: ['Estrés y salud mental', 'Sueño'],
    historiaCompatible: h => typeof h.estres === 'number' && h.estres >= 7,
    historiaDescripcion: 'Historia clínica · estrés percibido alto (≥7/10)',
    palabrasBioescaner: ['cortisol', 'dhea'],
  },
  {
    codigo: 'hormonal',
    nombre: 'Alteración hormonal',
    descripcion: 'Síntomas compatibles con desequilibrio hormonal.',
    sistemas: ['Hormonal'],
    palabrasBioescaner: ['estradiol', 'progesterona', 'testosterona', 'fsh', 'lh'],
  },
  {
    codigo: 'riesgo-cardiovascular',
    nombre: 'Riesgo cardiovascular funcional',
    descripcion: 'Síntomas cardiovasculares que ameritan seguimiento funcional.',
    sistemas: ['Cardiovascular'],
    historiaCompatible: h => h.dolorToracico === true || h.disneaReposo === true,
    historiaDescripcion: 'Historia clínica · bandera roja cardiovascular (dolor torácico o disnea en reposo)',
    palabrasBioescaner: ['colesterol', 'trigliceridos', 'ldl', 'hdl'],
  },
  {
    codigo: 'neuroinflamacion-cognitivo',
    nombre: 'Neuroinflamación o deterioro cognitivo funcional',
    descripcion: 'Síntomas neurocognitivos compatibles con neuroinflamación funcional.',
    sistemas: ['Neurológico y cognitivo'],
    historiaCompatible: h => h.deficitNeurologico === true,
    historiaDescripcion: 'Historia clínica · bandera roja: déficit neurológico nuevo',
    palabrasBioescaner: ['homocisteina', 'b12', 'neuroinflamacion'],
  },
  {
    codigo: 'trastorno-sueno',
    nombre: 'Trastorno del sueño',
    descripcion: 'Patrón compatible con alteración de la calidad o cantidad de sueño.',
    sistemas: ['Sueño'],
    historiaCompatible: h => typeof h.suenoHoras === 'number' && h.suenoHoras < 6,
    historiaDescripcion: 'Historia clínica · menos de 6 horas de sueño por noche',
    palabrasBioescaner: ['melatonina', 'polisomnografia'],
  },
  {
    codigo: 'alteracion-inmunologica',
    nombre: 'Alteración inmunológica',
    descripcion: 'Síntomas compatibles con desregulación inmunológica.',
    sistemas: ['Inmunológico'],
    palabrasBioescaner: ['inmunoglobulina', 'igg', 'iga', 'linfocitos'],
  },
  {
    codigo: 'deficit-micronutrientes',
    nombre: 'Déficit probable de micronutrientes',
    descripcion: 'Signos en piel, cabello, uñas y función muscular compatibles con déficit nutricional.',
    sistemas: ['Piel, cabello y uñas', 'Músculo-esquelético'],
    palabrasBioescaner: ['ferritina', 'vitamina d', 'b12', 'zinc', 'magnesio', 'hierro'],
  },
  {
    codigo: 'dolor-musculoesqueletico',
    nombre: 'Dolor e inflamación músculo-esquelética',
    descripcion: 'Síntomas compatibles con dolor músculo-esquelético de base inflamatoria.',
    sistemas: ['Músculo-esquelético', 'Inflamación y dolor'],
    palabrasBioescaner: ['pcr', 'factor reumatoide', 'acido urico'],
  },
];

export const CODIGOS_PATRONES = REGLAS.map(r => r.codigo);

export function prioridadDesdeNivel(nivel: Severidad): Prioridad {
  switch (nivel) {
    case 'muy_alta': return 'urgente';
    case 'alta': return 'alta';
    case 'moderada': return 'media';
    default: return 'baja';
  }
}

function hallazgosCompatibles(hallazgos: HallazgoBioescaner[], palabras: string[]): HallazgoBioescaner[] {
  if (palabras.length === 0) return [];
  return hallazgos.filter(h => {
    if (h.severidad === 'ok') return false;
    const texto = h.parametro.toLowerCase();
    return palabras.some(p => texto.includes(p));
  });
}

/**
 * Calcula los patrones funcionales sugeridos a partir de la evidencia
 * disponible. Determinista: mismos datos de entrada → mismo resultado.
 * Sólo devuelve patrones con puntaje ≥ 20 — si no hay evidencia, el
 * patrón no aparece ("no inventar patrones sin datos que los sustenten").
 */
export function calcularPatrones(entrada: {
  puntajesCuestionario: PuntajesCuestionario;
  historia: HistoriaRelevante;
  hallazgos: HallazgoBioescaner[];
}): PatronFuncional[] {
  const fechaCalculo = new Date().toISOString();
  const resultado: PatronFuncional[] = [];

  for (const regla of REGLAS) {
    const evidencias: EvidenciaPatron[] = [];
    let base = 0;
    let sistemasConDatos = 0;

    for (const sistema of regla.sistemas) {
      const p = entrada.puntajesCuestionario[sistema];
      if (p && p.maximo > 0) {
        base += p.porcentaje;
        sistemasConDatos += 1;
        evidencias.push({
          fuente: 'cuestionario',
          descripcion: `Cuestionario funcional · ${sistema}: ${p.porcentaje}%`,
          aporte: p.porcentaje,
        });
      }
    }
    const evidenciaCuestionario = sistemasConDatos > 0 ? base / sistemasConDatos : 0;

    let bonusHistoria = 0;
    if (regla.historiaCompatible?.(entrada.historia)) {
      bonusHistoria = BONUS_HISTORIA;
      evidencias.push({ fuente: 'historia', descripcion: regla.historiaDescripcion!, aporte: BONUS_HISTORIA });
    }

    let bonusBioescaner = 0;
    for (const h of hallazgosCompatibles(entrada.hallazgos, regla.palabrasBioescaner)) {
      if (bonusBioescaner >= TOPE_BONUS_BIOESCANER) break;
      const aporte = h.severidad === 'alto' ? BONUS_BIOESCANER_ALTO : BONUS_BIOESCANER_MED;
      bonusBioescaner += aporte;
      evidencias.push({
        fuente: 'bioescaner',
        descripcion: `Bioescáner · ${h.parametro}${h.valor ? ` (${h.valor})` : ''}`,
        aporte,
      });
    }
    bonusBioescaner = Math.min(bonusBioescaner, TOPE_BONUS_BIOESCANER);

    const puntaje = Math.min(100, Math.round(evidenciaCuestionario + bonusHistoria + bonusBioescaner));
    if (puntaje < UMBRAL_MINIMO) continue;

    const nivel = clasificarSeveridad(puntaje);
    resultado.push({
      codigo: regla.codigo,
      nombre: regla.nombre,
      descripcion: regla.descripcion,
      puntaje,
      nivel,
      prioridad: prioridadDesdeNivel(nivel),
      evidencias,
      fechaCalculo,
      version: VERSION_ALGORITMO_PATRONES,
      estado: 'sugerido',
      observacionesMedico: '',
    });
  }

  return resultado.sort((a, b) => b.puntaje - a.puntaje);
}
