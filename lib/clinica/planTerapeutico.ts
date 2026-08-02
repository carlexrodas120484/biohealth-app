/**
 * Plan terapéutico (IPT — Interpretación Personalizada del Tratamiento).
 *
 * Módulo nuevo y aditivo: NO reemplaza ni toca `lib/algoritmo/ipt.ts`
 * (el Índice de Prioridad Terapéutica numérico, portado 1:1 del
 * prototipo y validado por tests de fidelidad) ni `lib/algoritmo/fases.ts`
 * (el árbol de compuertas de Fase Terapéutica: Restore/Repair/Reset/
 * Target/Regenerate/Balance). Este archivo organiza el tratamiento en
 * las 6 fases de secuenciación clínica descritas para IPT — un
 * concepto distinto, que vive en su propia tabla
 * (`planes_terapeuticos`) y su propia ruta.
 *
 * Reglas deterministas y transparentes: cada fase sugerida expone
 * exactamente qué patrón confirmado o qué bandera de alarma la
 * disparó (`evidencias`). El motor NUNCA activa una fase — toda fase
 * nace en 'sugerida' y sólo el médico puede pasarla a 'activa',
 * 'completada', 'pausada' o 'descartada'
 * (app/api/pacientes/[id]/plan-terapeutico/route.ts).
 */

import { type Severidad, clasificarSeveridad } from './cuestionario';
import { prioridadDesdeNivel, type Prioridad } from './patrones';

export type EstadoFase = 'sugerida' | 'activa' | 'completada' | 'pausada' | 'descartada';

export type FaseTerapeutica = {
  codigo: string;
  nombre: string;
  objetivo: string;
  prioridad: Prioridad;
  duracionEstimadaSemanas: number;
  criteriosInicio: string[];
  criteriosAvance: string[];
  criteriosPausa: string[];
  riesgos: string[];
  evidencias: string[];
  observacionesMedico: string;
  estado: EstadoFase;
  orden: number;
  fechaCalculo: string;
  version: number;
};

export const VERSION_ALGORITMO_PLAN = 1;

export const ADVERTENCIA_PLAN =
  'Plan terapéutico sugerido como apoyo clínico. Ninguna fase se activa automáticamente: requiere revisión y aprobación médica.';

type PlantillaFase = Omit<
  FaseTerapeutica,
  'prioridad' | 'evidencias' | 'observacionesMedico' | 'estado' | 'orden' | 'fechaCalculo' | 'version'
>;

const PLANTILLAS_FASE: PlantillaFase[] = [
  {
    codigo: 'seguridad-estabilizacion',
    nombre: 'Seguridad y estabilización',
    objetivo: 'Atender banderas de alarma y estabilizar al paciente antes de iniciar cualquier intervención funcional.',
    duracionEstimadaSemanas: 2,
    criteriosInicio: ['Hay al menos una bandera de alarma activa o un patrón de riesgo cardiovascular confirmado'],
    criteriosAvance: ['Las banderas de alarma fueron evaluadas y resueltas o derivadas', 'Signos vitales estables'],
    criteriosPausa: ['Aparece una bandera de alarma nueva sin evaluar'],
    riesgos: ['Iniciar otras fases sin resolver una bandera de alarma puede enmascarar una urgencia médica'],
  },
  {
    codigo: 'digestivo-intestinal',
    nombre: 'Digestivo e intestinal',
    objetivo: 'Restaurar la función digestiva alta y el tránsito/microbiota intestinal como base del resto del plan.',
    duracionEstimadaSemanas: 6,
    criteriosInicio: ['No hay banderas de alarma activas sin resolver'],
    criteriosAvance: ['Mejora subjetiva de síntomas digestivos/intestinales en el cuestionario de seguimiento'],
    criteriosPausa: ['Aparece un síntoma digestivo de alarma nuevo'],
    riesgos: ['Revisar alergias e intolerancias alimentarias registradas antes de sugerir cambios dietéticos'],
  },
  {
    codigo: 'inflamacion-estres-oxidativo',
    nombre: 'Inflamación y estrés oxidativo',
    objetivo: 'Reducir la carga inflamatoria y de estrés oxidativo, incluyendo el soporte hepático y de detoxificación.',
    duracionEstimadaSemanas: 6,
    criteriosInicio: ['La fase digestiva e intestinal está activa o completada, o no fue necesaria'],
    criteriosAvance: ['Reducción de los síntomas inflamatorios reportados'],
    criteriosPausa: ['Reacción adversa a una intervención antiinflamatoria'],
    riesgos: ['Revisar medicación actual por posibles interacciones antes de sugerir antiinflamatorios o antioxidantes'],
  },
  {
    codigo: 'metabolico-hormonal',
    nombre: 'Metabólico y hormonal',
    objetivo: 'Abordar la regulación glucémica, tiroidea, suprarrenal y hormonal.',
    duracionEstimadaSemanas: 8,
    criteriosInicio: ['La carga inflamatoria de base está controlada'],
    criteriosAvance: ['Mejora en los síntomas metabólicos u hormonales reportados'],
    criteriosPausa: ['Cambios significativos no explicados en peso, presión arterial o frecuencia cardíaca'],
    riesgos: ['Revisar antecedentes de diabetes o patología tiroidea/suprarrenal antes de intervenir'],
  },
  {
    codigo: 'mitocondrial-energia',
    nombre: 'Mitocondrial y energía',
    objetivo: 'Recuperar la capacidad energética y la tolerancia al esfuerzo.',
    duracionEstimadaSemanas: 6,
    criteriosInicio: ['Las fases previas activas están estables o completadas'],
    criteriosAvance: ['Mejora en fatiga y tolerancia al esfuerzo reportada'],
    criteriosPausa: ['Empeoramiento marcado de la fatiga'],
    riesgos: ['Progresar la actividad física de forma gradual, en especial si hay riesgo cardiovascular confirmado'],
  },
  {
    codigo: 'reparacion-mantenimiento',
    nombre: 'Reparación y mantenimiento',
    objetivo: 'Consolidar resultados, reponer micronutrientes y sostener hábitos de sueño y estilo de vida.',
    duracionEstimadaSemanas: 8,
    criteriosInicio: ['Las fases funcionales previas fueron completadas o no fueron necesarias'],
    criteriosAvance: ['Estabilidad clínica sostenida en controles sucesivos'],
    criteriosPausa: ['Reaparición de síntomas de una fase previa'],
    riesgos: ['Confirmar que no persistan déficits sin corregir antes de dar de alta el plan'],
  },
];

export const CODIGOS_FASES = PLANTILLAS_FASE.map(f => f.codigo);

export function plantillaDeFase(codigo: string): PlantillaFase | undefined {
  return PLANTILLAS_FASE.find(f => f.codigo === codigo);
}

/** A qué fase del plan aporta evidencia cada patrón funcional confirmado (lib/clinica/patrones.ts). */
const MAPA_PATRON_A_FASE: Record<string, string> = {
  'digestivo-alto': 'digestivo-intestinal',
  'intestinal': 'digestivo-intestinal',
  'hepatico-detox': 'inflamacion-estres-oxidativo',
  'metabolico-glucemico': 'metabolico-hormonal',
  'inflamacion-sistemica': 'inflamacion-estres-oxidativo',
  'estres-oxidativo': 'inflamacion-estres-oxidativo',
  'disfuncion-mitocondrial': 'mitocondrial-energia',
  'tiroides-funcional': 'metabolico-hormonal',
  'suprarrenal-estres-cronico': 'metabolico-hormonal',
  'hormonal': 'metabolico-hormonal',
  'riesgo-cardiovascular': 'seguridad-estabilizacion',
  'neuroinflamacion-cognitivo': 'inflamacion-estres-oxidativo',
  'trastorno-sueno': 'reparacion-mantenimiento',
  'alteracion-inmunologica': 'inflamacion-estres-oxidativo',
  'deficit-micronutrientes': 'reparacion-mantenimiento',
  'dolor-musculoesqueletico': 'inflamacion-estres-oxidativo',
};

export type PatronConfirmado = { codigo: string; puntaje: number; nivel: Severidad };

export type HistoriaRelevantePlan = {
  fiebrePersistente?: boolean;
  perdidaPesoInvoluntaria?: boolean;
  sangrado?: boolean;
  dolorToracico?: boolean;
  disneaReposo?: boolean;
  deficitNeurologico?: boolean;
};

const BANDERAS_ROJAS: Array<[keyof HistoriaRelevantePlan, string]> = [
  ['fiebrePersistente', 'Fiebre persistente'],
  ['perdidaPesoInvoluntaria', 'Pérdida de peso involuntaria'],
  ['sangrado', 'Sangrado inexplicado'],
  ['dolorToracico', 'Dolor torácico'],
  ['disneaReposo', 'Disnea en reposo'],
  ['deficitNeurologico', 'Déficit neurológico nuevo'],
];

export type PacienteContextoPlan = {
  alergias: string | null;
  medicamentosActuales: string | null;
  antecedentesPersonales: string | null;
  antecedentesFamiliares: string | null;
};

export type BanderaSeguridad = { codigo: string; descripcion: string; fuente: 'alergias' | 'medicacion' | 'antecedentes' | 'bandera_roja' };

/**
 * Advertencias a considerar antes de formular — nunca bloquean nada
 * automáticamente, sólo se muestran para que el médico las revise. No
 * se intenta inferir diagnósticos (ej. "hipertensión no controlada",
 * "embarazo") a partir de texto libre: eso requeriría datos
 * estructurados que este esquema no tiene ("no inventar
 * contraindicación automática sin datos").
 */
export function calcularBanderasSeguridad(
  historia: HistoriaRelevantePlan,
  paciente: PacienteContextoPlan
): BanderaSeguridad[] {
  const banderas: BanderaSeguridad[] = [];
  if (paciente.alergias) {
    banderas.push({ codigo: 'alergias-registradas', descripcion: `Alergias registradas: ${paciente.alergias}`, fuente: 'alergias' });
  }
  if (paciente.medicamentosActuales) {
    banderas.push({ codigo: 'medicacion-actual', descripcion: `Medicación actual: ${paciente.medicamentosActuales}`, fuente: 'medicacion' });
  }
  if (paciente.antecedentesPersonales) {
    banderas.push({ codigo: 'antecedentes-personales', descripcion: `Antecedentes personales: ${paciente.antecedentesPersonales}`, fuente: 'antecedentes' });
  }
  if (paciente.antecedentesFamiliares) {
    banderas.push({ codigo: 'antecedentes-familiares', descripcion: `Antecedentes familiares: ${paciente.antecedentesFamiliares}`, fuente: 'antecedentes' });
  }
  for (const [campo, etiqueta] of BANDERAS_ROJAS) {
    if (historia[campo] === true) {
      banderas.push({ codigo: `bandera-roja-${campo}`, descripcion: `Bandera de alarma: ${etiqueta}`, fuente: 'bandera_roja' });
    }
  }
  return banderas;
}

const ORDEN_SEVERIDAD: Severidad[] = ['sin_alteracion', 'leve', 'moderada', 'alta', 'muy_alta'];
function masAlto(a: Severidad, b: Severidad): Severidad {
  return ORDEN_SEVERIDAD.indexOf(a) >= ORDEN_SEVERIDAD.indexOf(b) ? a : b;
}

const PESO_PRIORIDAD: Record<Prioridad, number> = { urgente: 4, alta: 3, media: 2, baja: 1 };

/**
 * Sugiere fases del plan terapéutico a partir de los patrones
 * funcionales ya CONFIRMADOS por el médico (nunca de los sólo
 * sugeridos: el plan se construye sobre lo que el médico validó) y de
 * las banderas de alarma de la historia clínica. Una fase sin ningún
 * patrón confirmado que la sustente y sin bandera de alarma no se
 * sugiere — "no inventar fases sin datos".
 */
export function sugerirFasesPlan(entrada: {
  patronesConfirmados: PatronConfirmado[];
  historia: HistoriaRelevantePlan;
}): FaseTerapeutica[] {
  const fechaCalculo = new Date().toISOString();
  const banderasActivas = BANDERAS_ROJAS.filter(([campo]) => entrada.historia[campo] === true);

  const resultado: FaseTerapeutica[] = [];
  for (const plantilla of PLANTILLAS_FASE) {
    const patronesDeFase = entrada.patronesConfirmados.filter(p => MAPA_PATRON_A_FASE[p.codigo] === plantilla.codigo);
    const disparadaPorBandera = plantilla.codigo === 'seguridad-estabilizacion' && banderasActivas.length > 0;

    if (patronesDeFase.length === 0 && !disparadaPorBandera) continue;

    const evidencias: string[] = patronesDeFase.map(p => `Patrón confirmado: ${p.codigo} (${p.puntaje}%)`);
    if (disparadaPorBandera) {
      for (const [, etiqueta] of banderasActivas) evidencias.push(`Bandera de alarma: ${etiqueta}`);
    }

    const nivelMax = patronesDeFase.reduce<Severidad>((max, p) => masAlto(max, p.nivel), 'sin_alteracion');
    const prioridad: Prioridad = disparadaPorBandera ? 'urgente' : prioridadDesdeNivel(nivelMax);

    resultado.push({
      ...plantilla,
      prioridad,
      evidencias,
      observacionesMedico: '',
      estado: 'sugerida',
      orden: 0,
      fechaCalculo,
      version: VERSION_ALGORITMO_PLAN,
    });
  }

  resultado.sort((a, b) => PESO_PRIORIDAD[b.prioridad] - PESO_PRIORIDAD[a.prioridad]);
  return resultado.map((f, i) => ({ ...f, orden: i + 1 }));
}
