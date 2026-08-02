/**
 * lib/clinica/motorIA.ts
 *
 * Motor de IA Clínica BioHealth V1. No es un modelo externo ni llama a
 * ningún servicio de IA (no OpenAI, no red) — es un orquestador de
 * reglas determinísticas y explicables sobre los motores que ya existen
 * en este proyecto (dashboard.ts, patrones.ts, formulacion.ts): cruza
 * historia clínica, diagnóstico funcional, laboratorios, formulación,
 * plan nutricional y evolución de un paciente para producir un informe
 * de apoyo a la decisión clínica.
 *
 * Como todos los motores de este proyecto: función pura, sin acceso a
 * Supabase, y NUNCA modifica datos — todo lo que produce es una
 * sugerencia para que el profesional revise. `app/api/pacientes/[id]/ia/
 * route.ts` sólo lee, nunca escribe.
 */

import {
  generarAlertasClinicas, detectarInconsistencias, priorizarProblemas,
  calcularRiesgoCardiovascular, calcularRiesgoMetabolico, calcularInflamacion,
  calcularEstadoIntestinal, calcularEstadoHormonal, calcularEstadoMitocondrial,
  ORDEN_SEMAFORO,
  type ContextoDashboard, type IndicadorClinico, type AlertaClinica, type ProblemaPriorizado, type Semaforo, type Sexo,
} from './dashboard';
import { sugerirPrincipiosActivos, type SugerenciaPrincipioActivo, type Alerta as AlertaFormulacion } from './formulacion';
import type { PatronFuncional } from './patrones';

export const VERSION_MOTOR_IA = 1;

export const ADVERTENCIA_IA =
  'Sugerencias generadas por reglas internas de BioHealth (sin IA externa). No reemplazan el criterio clínico profesional, no se aplican automáticamente y requieren revisión médica.';

export type PrioridadClinica = 'alta' | 'media' | 'baja';

const RECOMENDACIONES_ESTUDIO_POR_PATRON: Record<string, string> = {
  'metabolico-glucemico': 'Solicitar glucemia en ayunas, HbA1c y HOMA-IR.',
  'inflamacion-sistemica': 'Solicitar PCR ultrasensible.',
  'riesgo-cardiovascular': 'Solicitar perfil lipídico completo (LDL, HDL, triglicéridos).',
  'deficit-micronutrientes': 'Solicitar vitamina D y ferritina.',
  'tiroides-funcional': 'Solicitar perfil tiroideo (TSH, T4 libre).',
  'suprarrenal-estres-cronico': 'Considerar evaluación de cortisol.',
};

const INDICADOR_CUBRE_PATRON: Record<string, string[]> = {
  'metabolico-glucemico': ['glucemia', 'hba1c', 'homa_ir'],
  'inflamacion-sistemica': ['pcr'],
  'riesgo-cardiovascular': ['ldl', 'hdl', 'trigliceridos'],
  'deficit-micronutrientes': ['vitamina_d', 'ferritina'],
};

export type PacienteContextoIA = {
  nombreCompleto: string;
  edad: number | null;
  sexo: Sexo | null;
  motivoConsulta: string | null;
  alergias: string | null;
  medicamentosActuales: string | null;
  antecedentesPersonales: string | null;
  antecedentesFamiliares: string | null;
};

export type ResumenCuestionarioIA = { sistemasAlterados: string[]; topSintomas: string[] } | null;

export type FormulacionContextoIA = {
  estado: string | null;
  ingredientesNombres: string[];
  alertasMotor: AlertaFormulacion[];
} | null;

export type NutricionContextoIA = {
  estado: string | null;
  objetivoClinico: string | null;
} | null;

export type ContextoMotorIA = {
  paciente: PacienteContextoIA;
  historiaCompletada: boolean;
  resumenCuestionario: ResumenCuestionarioIA;
  diagnosticoConfirmado: boolean;
  impresionDiagnostica: string;
  patrones: PatronFuncional[];
  objetivosConfirmados: string[];
  fases: Array<{ nombre: string; estado: string; objetivo: string }>;
  formulacion: FormulacionContextoIA;
  nutricion: NutricionContextoIA;
  indicadores: IndicadorClinico[];
  ultimoControl: { decision: string; banderaRojaNueva: boolean } | null;
};

function aContextoDashboard(ctx: ContextoMotorIA): ContextoDashboard {
  return {
    paciente: { sexo: ctx.paciente.sexo },
    historiaCompletada: ctx.historiaCompletada,
    diagnosticoConfirmado: ctx.diagnosticoConfirmado,
    patrones: ctx.patrones,
    fasesActivas: ctx.fases.filter(f => f.estado === 'activa').length,
    fasesSugeridas: ctx.fases.filter(f => f.estado === 'sugerida').length,
    formulacionEstado: ctx.formulacion?.estado ?? null,
    nutricionEstado: ctx.nutricion?.estado ?? null,
    indicadores: ctx.indicadores,
  };
}

/** 1. Resumen clínico: puntos concretos, nunca inventa datos que no existan. */
export function generarResumenClinico(ctx: ContextoMotorIA): string[] {
  const resumen: string[] = [];
  const edadTexto = ctx.paciente.edad != null ? `${ctx.paciente.edad} años` : 'edad no registrada';
  resumen.push(`${ctx.paciente.nombreCompleto} · ${edadTexto} · ${ctx.paciente.sexo ?? 'sexo no registrado'}.`);
  if (ctx.paciente.motivoConsulta) resumen.push(`Motivo de consulta: ${ctx.paciente.motivoConsulta}.`);
  resumen.push(ctx.historiaCompletada ? 'Historia clínica completa.' : 'Historia clínica incompleta.');

  if (ctx.resumenCuestionario && ctx.resumenCuestionario.sistemasAlterados.length > 0) {
    resumen.push(`Sistemas con mayor alteración en el cuestionario funcional: ${ctx.resumenCuestionario.sistemasAlterados.join(', ')}.`);
  }

  resumen.push(
    ctx.diagnosticoConfirmado
      ? `Diagnóstico funcional confirmado, con ${ctx.patrones.filter(p => p.estado === 'confirmado').length} patrón(es) funcional(es) confirmado(s).`
      : 'Diagnóstico funcional pendiente de confirmación.'
  );

  if (ctx.fases.length > 0) {
    const activas = ctx.fases.filter(f => f.estado === 'activa').map(f => f.nombre);
    resumen.push(activas.length > 0 ? `Plan terapéutico con fase(s) activa(s): ${activas.join(', ')}.` : 'Plan terapéutico sin fases activas todavía.');
  }

  if (ctx.formulacion) resumen.push(`Formulación ortomolecular en estado "${ctx.formulacion.estado}".`);
  if (ctx.nutricion) resumen.push(`Plan nutricional en estado "${ctx.nutricion.estado}".`);

  if (ctx.ultimoControl) {
    resumen.push(`Último control: decisión "${ctx.ultimoControl.decision}"${ctx.ultimoControl.banderaRojaNueva ? ' — con bandera roja nueva registrada.' : '.'}`);
  }

  return resumen;
}

/** 3-4. Prioridad clínica global + por qué, a partir del peor semáforo de los 6 sistemas y las alertas rojas. */
export function calcularPrioridadClinica(ctx: ContextoMotorIA): { prioridad: PrioridadClinica; porQue: string } {
  const sistemas = [
    calcularRiesgoCardiovascular(ctx.indicadores, ctx.patrones),
    calcularRiesgoMetabolico(ctx.indicadores, ctx.patrones),
    calcularInflamacion(ctx.indicadores, ctx.patrones),
    calcularEstadoIntestinal(ctx.patrones),
    calcularEstadoHormonal(ctx.patrones),
    calcularEstadoMitocondrial(ctx.patrones),
  ];
  const peor = sistemas.reduce((p, s) => (ORDEN_SEMAFORO[s.semaforo] > ORDEN_SEMAFORO[p.semaforo] ? s : p), sistemas[0]);
  const banderaRoja = ctx.ultimoControl?.banderaRojaNueva ?? false;

  let prioridad: PrioridadClinica = 'baja';
  const razones: string[] = [];
  if (peor.semaforo === 'rojo' || banderaRoja) {
    prioridad = 'alta';
    if (peor.semaforo === 'rojo') razones.push(peor.explicacion);
    if (banderaRoja) razones.push('El último control registró una bandera roja de seguridad nueva.');
  } else if (peor.semaforo === 'amarillo') {
    prioridad = 'media';
    razones.push(peor.explicacion);
  } else {
    razones.push('Ningún sistema evaluado muestra semáforo rojo ni amarillo con los datos disponibles.');
  }

  return { prioridad, porQue: razones.join(' ') };
}

/** 5. Recomendaciones ortomoleculares por objetivo confirmado — nunca sugiere dosis, sólo principios activos a considerar. */
export function generarRecomendacionesOrtomoleculares(ctx: ContextoMotorIA): SugerenciaPrincipioActivo[] {
  return sugerirPrincipiosActivos(ctx.objetivosConfirmados);
}

/** 6. Estudios faltantes: patrón confirmado sin el laboratorio que lo sustente. */
export function detectarEstudiosFaltantes(ctx: ContextoMotorIA): string[] {
  const faltantes: string[] = [];
  const confirmados = ctx.patrones.filter(p => p.estado === 'confirmado');
  for (const p of confirmados) {
    const codigosIndicador = INDICADOR_CUBRE_PATRON[p.codigo];
    const recomendacion = RECOMENDACIONES_ESTUDIO_POR_PATRON[p.codigo];
    if (!codigosIndicador || !recomendacion) continue;
    const tieneAlguno = codigosIndicador.some(c => ctx.indicadores.find(i => i.codigo === c)?.semaforo !== 'sin_datos');
    if (!tieneAlguno) faltantes.push(recomendacion);
  }
  return Array.from(new Set(faltantes));
}

/** 7-8. Interacciones y contraindicaciones: reclasifica las alertas ya calculadas por el motor de formulación (no recalcula nada). */
export function clasificarAlertasFormulacion(alertas: AlertaFormulacion[]): { interacciones: string[]; contraindicaciones: string[] } {
  const interacciones: string[] = [];
  const contraindicaciones: string[] = [];
  for (const a of alertas) {
    if (a.fuente === 'medicacion' || a.fuente === 'incompatibilidad' || a.fuente === 'duplicacion') {
      interacciones.push(a.descripcion);
    } else if (a.fuente === 'alergias' || a.fuente === 'antecedentes') {
      contraindicaciones.push(a.descripcion);
    }
  }
  return { interacciones, contraindicaciones };
}

/** 10. Próximo paso sugerido: uno solo, el más urgente, siguiendo el orden natural del flujo clínico. */
export function sugerirProximoPaso(ctx: ContextoMotorIA): { titulo: string; motivo: string } {
  if (!ctx.historiaCompletada) {
    return { titulo: 'Completar la historia clínica', motivo: 'Es la base de todo el resto del flujo clínico.' };
  }
  if (!ctx.diagnosticoConfirmado) {
    return { titulo: 'Confirmar el diagnóstico funcional', motivo: 'La historia está completa pero el diagnóstico funcional todavía no fue confirmado por el profesional.' };
  }
  if (ctx.fases.filter(f => f.estado === 'activa').length === 0) {
    return { titulo: 'Activar una fase del plan terapéutico', motivo: 'El diagnóstico está confirmado pero no hay ninguna fase activa todavía.' };
  }
  if (ctx.formulacion && ctx.formulacion.estado !== 'aprobada' && ctx.formulacion.estado !== 'archivada') {
    return { titulo: 'Revisar y aprobar la formulación ortomolecular', motivo: `La formulación está en estado "${ctx.formulacion.estado}", pendiente de revisión médica.` };
  }
  if (ctx.nutricion && ctx.nutricion.estado !== 'aprobado' && ctx.nutricion.estado !== 'archivado') {
    return { titulo: 'Revisar y aprobar el plan nutricional', motivo: `El plan nutricional está en estado "${ctx.nutricion.estado}", pendiente de revisión médica.` };
  }
  const estudios = detectarEstudiosFaltantes(ctx);
  if (estudios.length > 0) {
    return { titulo: estudios[0], motivo: 'Hay un patrón funcional confirmado sin el laboratorio que lo sustente.' };
  }
  return { titulo: 'Continuar con el control de seguimiento habitual', motivo: 'No se detectaron pasos pendientes con los datos disponibles.' };
}

export type InformeIA = {
  version: number;
  advertencia: string;
  resumenClinico: string[];
  principalesProblemas: ProblemaPriorizado[];
  prioridadClinica: PrioridadClinica;
  porQuePrioridad: string;
  recomendacionesOrtomoleculares: SugerenciaPrincipioActivo[];
  estudiosFaltantes: string[];
  interaccionesPosibles: string[];
  contraindicaciones: string[];
  alertas: AlertaClinica[];
  proximoPaso: { titulo: string; motivo: string };
};

/** Arma el informe completo del Motor de IA Clínica. Nunca escribe nada: sólo lee `ctx` y devuelve sugerencias. */
export function generarInformeIA(ctx: ContextoMotorIA): InformeIA {
  const contextoDashboard = aContextoDashboard(ctx);
  const { prioridad, porQue } = calcularPrioridadClinica(ctx);
  const { interacciones, contraindicaciones } = clasificarAlertasFormulacion(ctx.formulacion?.alertasMotor ?? []);

  return {
    version: VERSION_MOTOR_IA,
    advertencia: ADVERTENCIA_IA,
    resumenClinico: generarResumenClinico(ctx),
    principalesProblemas: priorizarProblemas(contextoDashboard),
    prioridadClinica: prioridad,
    porQuePrioridad: porQue,
    recomendacionesOrtomoleculares: generarRecomendacionesOrtomoleculares(ctx),
    estudiosFaltantes: detectarEstudiosFaltantes(ctx),
    interaccionesPosibles: interacciones,
    contraindicaciones,
    alertas: [...generarAlertasClinicas(contextoDashboard), ...detectarInconsistencias(contextoDashboard)],
    proximoPaso: sugerirProximoPaso(ctx),
  };
}
