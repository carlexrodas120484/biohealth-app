/**
 * lib/clinica/mpi.ts
 *
 * Motor de Protocolos Inteligentes (MPI): la capa que orquesta todo el
 * flujo clínico ya confirmado de un paciente (historia clínica →
 * cuestionario funcional → diagnóstico → IPT → objetivos) junto con
 * la Base Farmacotécnica, la Base de Conocimiento Clínica y el Motor
 * Inteligente de Formulación (lib/clinica/mif.ts) para proponer un
 * protocolo ortomolecular completo.
 *
 * Es, otra vez, una capa aditiva de sólo lectura: `generarProtocoloSugerido`
 * no inserta ni actualiza ninguna fila, no tiene ruta ni pantalla
 * propia, y no modifica ni reemplaza el motor de formulación existente
 * (lib/clinica/formulacion.ts) ni el MIF — los reutiliza. Todo lo que
 * produce es una SUGERENCIA para revisión médica explícita; nada acá
 * prescribe, aprueba ni firma nada.
 *
 * "Cuestionario funcional" no se vuelve a leer en crudo acá: su señal
 * ya está distilada en `diagnosticos_funcionales.patrones` (que el
 * motor de patrones calcula a partir de cuestionario + historia +
 * bioescáner — ver lib/clinica/patrones.ts) y en `historias_clinicas`
 * a través de los mismos campos de contexto (alergias, medicación,
 * antecedentes) que ya usa formulacion.ts. Releerlo en bruto acá
 * duplicaría lógica ya centralizada, no agregaría información nueva.
 */

import {
  decidirPresentacion, seleccionarSabor, agruparPorCompatibilidad, mgDesdeDosis,
  type DecisionPresentacion, type DecisionSabor,
} from './mif';
import { sugerirPrincipiosActivos, REGLAS_FORMULACION_DEFECTO, type ReglasFormulacion, type Alerta, type PacienteContextoFormulacion } from './formulacion';
import { normalizarNombre } from './baseConocimiento';
import type { BandaPrioridad, ResultadoIPT } from '@/lib/algoritmo/ipt';
import type { Fase } from '@/lib/validation/conocimientoClinico';
import type {
  PrincipioFarmacotecnico, PreferenciasPaciente, ContextoClinicoPaciente, DosisPrincipio,
} from '@/lib/repositorios/baseFarmacotecnica';
import { obtenerContextoClinicoPaciente, listarPrincipiosValidadosCompletos, obtenerPreferenciasPaciente } from '@/lib/repositorios/baseFarmacotecnica';
import type { ConocimientoClinico } from '@/lib/repositorios/conocimientoClinico';
import { listarConocimientoValidadoPorObjetivoYFase } from '@/lib/repositorios/conocimientoClinico';
import {
  obtenerContextoContraindicacionesPaciente, obtenerIptParaProtocolo, obtenerDuracionesHabituales, obtenerFlagsContraindicacion,
  type FlagsContraindicacion,
} from '@/lib/repositorios/protocolo';
import type { createClient } from '@/lib/supabase/server';

export const VERSION_MPI = 1;

export const ADVERTENCIA_MPI =
  'Motor de Protocolos Inteligentes: propone un protocolo ortomolecular completo a partir de la historia clínica, ' +
  'el diagnóstico, el IPT, los objetivos terapéuticos y la Base de Conocimiento Clínica. ' +
  'No diagnostica, no prescribe ni aprueba nada por su cuenta — es una sugerencia que requiere revisión y aprobación médica explícita.';

type Prioridad = 'baja' | 'media' | 'alta' | 'urgente';
const RANGO_PRIORIDAD: Record<Prioridad, number> = { baja: 1, media: 2, alta: 3, urgente: 4 };

// ==================== 1) Prioridad terapéutica (desde el IPT) ====================

/** Toma la banda del resultado con mayor puntaje `final` entre las alteraciones del IPT ya confirmado. */
export function prioridadTerapeuticaDesdeIPT(resultado: ResultadoIPT[]): BandaPrioridad | null {
  if (resultado.length === 0) return null;
  return [...resultado].sort((a, b) => b.final - a.final)[0].banda;
}

// ==================== 2 y 3) Objetivos principales / secundarios ====================

/**
 * Prioridad "efectiva" de un objetivo: la máxima prioridad entre sus
 * indicaciones validadas en la Base de Conocimiento Clínica para la
 * fase confirmada. Si todavía no hay ninguna validada para ese
 * objetivo (lo más probable mientras la base es nueva), el objetivo
 * queda sin prioridad de catálogo — `separarObjetivosPrincipalesYSecundarios`
 * usa entonces el orden en que el médico los confirmó como criterio
 * de respaldo, en vez de inventar una prioridad clínica no sustentada.
 */
export function prioridadPorObjetivo(objetivos: string[], conocimientoPorObjetivo: Map<string, ConocimientoClinico[]>): Map<string, Prioridad | null> {
  const mapa = new Map<string, Prioridad | null>();
  for (const objetivo of objetivos) {
    const entradas = conocimientoPorObjetivo.get(objetivo) ?? [];
    if (entradas.length === 0) { mapa.set(objetivo, null); continue; }
    const maxima = entradas.reduce((max, e) => (RANGO_PRIORIDAD[e.prioridad] > RANGO_PRIORIDAD[max] ? e.prioridad : max), entradas[0].prioridad);
    mapa.set(objetivo, maxima);
  }
  return mapa;
}

export type SplitObjetivos = { principales: string[]; secundarios: string[] };

/**
 * Principal = prioridad 'alta'/'urgente' en la Base de Conocimiento
 * Clínica validada. Si ningún objetivo tiene datos de prioridad
 * cargados todavía, el criterio de respaldo es el orden en que el
 * médico confirmó los objetivos (la primera mitad, redondeando hacia
 * arriba) — el orden de carga ya es una señal de prioridad clínica
 * dada por el profesional, no un dato inventado por el motor.
 */
export function separarObjetivosPrincipalesYSecundarios(objetivos: string[], prioridades: Map<string, Prioridad | null>): SplitObjetivos {
  const conDatoDePrioridad = objetivos.some(o => prioridades.get(o) != null);

  if (conDatoDePrioridad) {
    const principales = objetivos.filter(o => {
      const p = prioridades.get(o);
      return p === 'alta' || p === 'urgente';
    });
    const secundarios = objetivos.filter(o => !principales.includes(o));
    // Si por los datos cargados ningún objetivo calificara como principal, no dejar el protocolo sin objetivo principal.
    if (principales.length > 0) return { principales, secundarios };
  }

  const corte = Math.ceil(objetivos.length / 2);
  return { principales: objetivos.slice(0, corte), secundarios: objetivos.slice(corte) };
}

// ==================== 4) Principios activos candidatos ====================

export type CandidatoMPI = {
  nombre: string;
  objetivos: string[];
  esObjetivoPrincipal: boolean;
  disponibleEnBaseValidada: boolean;
  principio: PrincipioFarmacotecnico | null;
  prioridad: Prioridad;
  ordenSugerido: number;
  dosisConocimiento: { habitual: number | null; minima: number | null; maxima: number | null; unidad: DosisPrincipio['unidad'] | null } | null;
  horarioRecomendado: string | null;
  advertenciasIniciales: Alerta[];
};

/** Evidencia B/C/D de la sugerencia heredada de formulacion.ts → prioridad de respaldo (sólo mientras no haya dato validado en conocimiento_clinico). */
function prioridadDesdeEvidenciaLegacy(evidencia: 'B' | 'C' | 'D'): Prioridad {
  if (evidencia === 'B') return 'alta';
  if (evidencia === 'C') return 'media';
  return 'baja';
}

function indexarPorId(principios: PrincipioFarmacotecnico[]): Map<string, PrincipioFarmacotecnico> {
  return new Map(principios.map(p => [p.id, p]));
}

function indexarPorNombreYSinonimos(principios: PrincipioFarmacotecnico[]): Map<string, PrincipioFarmacotecnico> {
  const mapa = new Map<string, PrincipioFarmacotecnico>();
  for (const p of principios) {
    mapa.set(normalizarNombre(p.nombreCanonico), p);
    for (const s of p.sinonimos) mapa.set(normalizarNombre(s), p);
  }
  return mapa;
}

/**
 * Candidatos para UN objetivo: prioriza las indicaciones validadas de
 * `conocimiento_clinico` (dato auditado, con dosis/horario/prioridad
 * propios); si todavía no hay ninguna validada para este objetivo+fase,
 * cae en la misma lista heredada que ya usa el motor de formulación
 * (`SUGERENCIAS_POR_OBJETIVO`) — igual patrón "aditivo, la Base de
 * Conocimiento gana cuando existe" que ya usa el MIF.
 */
export function construirCandidatosParaObjetivo(
  objetivo: string,
  esObjetivoPrincipal: boolean,
  conocimientoValidado: ConocimientoClinico[],
  porId: Map<string, PrincipioFarmacotecnico>,
  porNombre: Map<string, PrincipioFarmacotecnico>
): CandidatoMPI[] {
  if (conocimientoValidado.length > 0) {
    return conocimientoValidado.map(ck => {
      const principio = porId.get(ck.principioActivoId) ?? null;
      const tieneDosis = ck.dosisHabitual != null || ck.dosisMinima != null || ck.dosisMaxima != null;
      return {
        nombre: principio?.nombreCanonico ?? `(principio ${ck.principioActivoId} no disponible)`,
        objetivos: [objetivo], esObjetivoPrincipal, disponibleEnBaseValidada: principio !== null, principio,
        prioridad: ck.prioridad, ordenSugerido: ck.ordenSugerido,
        dosisConocimiento: tieneDosis ? { habitual: ck.dosisHabitual, minima: ck.dosisMinima, maxima: ck.dosisMaxima, unidad: ck.unidadDosis as DosisPrincipio['unidad'] | null } : null,
        horarioRecomendado: ck.horario,
        advertenciasIniciales: principio ? [] : [{
          codigo: `conocimiento-sin-principio-${ck.id}`,
          descripcion: `La indicación validada para "${objetivo}" referencia un principio que ya no está validado en la Base Farmacotécnica.`,
          fuente: 'conocimiento-clinico',
        }],
      };
    });
  }

  return sugerirPrincipiosActivos([objetivo]).map(s => {
    const principio = porNombre.get(normalizarNombre(s.nombre)) ?? null;
    return {
      nombre: s.nombre, objetivos: [objetivo], esObjetivoPrincipal, disponibleEnBaseValidada: principio !== null, principio,
      prioridad: prioridadDesdeEvidenciaLegacy(s.evidencia), ordenSugerido: 0, dosisConocimiento: null, horarioRecomendado: null,
      advertenciasIniciales: principio ? [] : [{
        codigo: `sin-validar-${s.nombre}`,
        descripcion: `"${s.nombre}" es candidato para "${objetivo}" pero no tiene un registro validado en la Base Farmacotécnica todavía.`,
        fuente: 'base-farmacotecnica',
      }],
    };
  });
}

// ==================== 5) Exclusión por contraindicaciones ====================

export type TipoExclusionMPI = 'contraindicacion' | 'duplicidad' | 'incompatibilidad';
export type ExclusionMPI = { nombre: string; tipo: TipoExclusionMPI; motivo: string };

const PALABRAS_EMBARAZO = ['embarazo', 'embarazada', 'gestante', 'gestacion'];
const PALABRAS_LACTANCIA = ['lactancia', 'lactando', 'amamantando'];
const PALABRAS_ONCOLOGICO = ['cancer', 'oncologico', 'quimioterapia', 'neoplasia', 'tumor'];
const PALABRAS_ANTICOAGULANTES = ['warfarina', 'acenocumarol', 'heparina', 'rivaroxaban', 'apixaban', 'dabigatran', 'aspirina', 'clopidogrel'];
const PALABRAS_ANTIHIPERTENSIVOS = ['losartan', 'enalapril', 'amlodipina', 'valsartan', 'atenolol', 'captopril', 'hidroclorotiazida', 'lisinopril'];
const PALABRAS_HIPOGLUCEMIANTES = ['metformina', 'insulina', 'glibenclamida', 'glimepirida', 'sitagliptina', 'empagliflozina'];

function contieneAlguna(texto: string | null, palabras: string[]): boolean {
  if (!texto) return false;
  const t = normalizarNombre(texto);
  return palabras.some(p => t.includes(normalizarNombre(p)));
}

/**
 * Exclusión DURA (nunca se sugiere): sólo por los flags estructurados
 * `contraindicado_embarazo/lactancia/oncologico`, cruzados con
 * palabras clave en antecedentes — la misma técnica heurística que ya
 * usa `generarAlertas` en formulacion.ts, documentada con la misma
 * salvedad: interpretar automáticamente texto libre no sustituye la
 * revisión médica, así que el motivo siempre queda explícito.
 *
 * `precaucion_*` (anticoagulación/antihipertensivos/hipoglucemiantes)
 * NUNCA excluye por su cuenta — es una advertencia adjunta al
 * candidato, igual que ya hace formulacion.ts: "precaución" no es
 * "prohibido".
 */
export function excluirPorContraindicaciones(
  candidatos: CandidatoMPI[],
  contexto: PacienteContextoFormulacion | null,
  flagsPorId: Map<string, FlagsContraindicacion>
): { incluidos: CandidatoMPI[]; excluidos: ExclusionMPI[]; advertenciasPrecaucion: Map<string, Alerta[]> } {
  const excluidos: ExclusionMPI[] = [];
  const incluidos: CandidatoMPI[] = [];
  const advertenciasPrecaucion = new Map<string, Alerta[]>();

  const antecedentes = contexto ? [contexto.antecedentesPersonales, contexto.antecedentesFamiliares].filter(Boolean).join(' ') : '';
  const medicamentos = contexto?.medicamentosActuales ?? null;

  for (const c of candidatos) {
    if (!c.principio) { incluidos.push(c); continue; }
    const flags = flagsPorId.get(c.principio.id);
    if (!flags) { incluidos.push(c); continue; }

    if (flags.contraindicadoOncologico && contieneAlguna(antecedentes, PALABRAS_ONCOLOGICO)) {
      excluidos.push({ nombre: c.nombre, tipo: 'contraindicacion', motivo: `Contraindicado en contexto oncológico y el paciente tiene antecedentes compatibles.` });
      continue;
    }
    if (flags.contraindicadoEmbarazo && contieneAlguna(antecedentes, PALABRAS_EMBARAZO)) {
      excluidos.push({ nombre: c.nombre, tipo: 'contraindicacion', motivo: `Contraindicado en embarazo y los antecedentes registran embarazo.` });
      continue;
    }
    if (flags.contraindicadoLactancia && contieneAlguna(antecedentes, PALABRAS_LACTANCIA)) {
      excluidos.push({ nombre: c.nombre, tipo: 'contraindicacion', motivo: `Contraindicado en lactancia y los antecedentes registran lactancia.` });
      continue;
    }

    const advertencias: Alerta[] = [];
    if (flags.precaucionAnticoagulacion && contieneAlguna(medicamentos, PALABRAS_ANTICOAGULANTES)) {
      advertencias.push({ codigo: `precaucion-anticoagulacion-${c.nombre}`, descripcion: `"${c.nombre}" requiere precaución: el paciente registra medicación anticoagulante/antiagregante.`, fuente: 'precaucion' });
    }
    if (flags.precaucionAntihipertensivos && contieneAlguna(medicamentos, PALABRAS_ANTIHIPERTENSIVOS)) {
      advertencias.push({ codigo: `precaucion-antihipertensivos-${c.nombre}`, descripcion: `"${c.nombre}" requiere precaución: el paciente registra medicación antihipertensiva.`, fuente: 'precaucion' });
    }
    if (flags.precaucionHipoglucemiantes && contieneAlguna(medicamentos, PALABRAS_HIPOGLUCEMIANTES)) {
      advertencias.push({ codigo: `precaucion-hipoglucemiantes-${c.nombre}`, descripcion: `"${c.nombre}" requiere precaución: el paciente registra medicación hipoglucemiante.`, fuente: 'precaucion' });
    }
    if (advertencias.length > 0) advertenciasPrecaucion.set(c.nombre, advertencias);

    incluidos.push(c);
  }

  return { incluidos, excluidos, advertenciasPrecaucion };
}

// ==================== 6) Exclusión por duplicidad ====================

/** Un mismo principio candidato para más de un objetivo se consolida en una sola entrada; el resto queda registrado como excluido por duplicidad. */
export function consolidarDuplicados(candidatos: CandidatoMPI[]): { consolidados: CandidatoMPI[]; excluidos: ExclusionMPI[] } {
  const porNombre = new Map<string, CandidatoMPI>();
  const excluidos: ExclusionMPI[] = [];

  for (const c of candidatos) {
    const existente = porNombre.get(c.nombre);
    if (!existente) { porNombre.set(c.nombre, { ...c, objetivos: [...c.objetivos] }); continue; }

    existente.objetivos = [...new Set([...existente.objetivos, ...c.objetivos])];
    existente.esObjetivoPrincipal = existente.esObjetivoPrincipal || c.esObjetivoPrincipal;
    if (RANGO_PRIORIDAD[c.prioridad] > RANGO_PRIORIDAD[existente.prioridad]) existente.prioridad = c.prioridad;
    if (!existente.dosisConocimiento && c.dosisConocimiento) existente.dosisConocimiento = c.dosisConocimiento;
    if (!existente.horarioRecomendado && c.horarioRecomendado) existente.horarioRecomendado = c.horarioRecomendado;

    excluidos.push({ nombre: c.nombre, tipo: 'duplicidad', motivo: `"${c.nombre}" ya estaba seleccionado para "${existente.objetivos.join(', ')}"; se consolida en una sola entrada del protocolo.` });
  }

  return { consolidados: [...porNombre.values()], excluidos };
}

// ==================== 7) Exclusión por incompatibilidad ====================

/**
 * Sólo excluye cuando DOS candidatos del MISMO objetivo son
 * mutuamente incompatibles (alternativas que compiten por el mismo
 * fin terapéutico): se conserva el de mayor prioridad. Una
 * incompatibilidad entre principios de objetivos DISTINTOS no excluye
 * a ninguno — se resuelve separándolos en preparados distintos (ver
 * `agruparPreparados`), igual que ya hace el MIF: ambos siguen siendo
 * necesarios para fines terapéuticos distintos.
 */
export function excluirAlternativasIncompatiblesPorObjetivo(candidatosPorObjetivo: CandidatoMPI[]): { seleccionados: CandidatoMPI[]; excluidos: ExclusionMPI[] } {
  const excluidos: ExclusionMPI[] = [];
  const descartados = new Set<string>();

  for (let i = 0; i < candidatosPorObjetivo.length; i++) {
    const a = candidatosPorObjetivo[i];
    if (descartados.has(a.nombre) || !a.principio) continue;
    for (let j = i + 1; j < candidatosPorObjetivo.length; j++) {
      const b = candidatosPorObjetivo[j];
      if (descartados.has(b.nombre) || !b.principio) continue;
      const incompatibles = a.principio.incompatibilidadesNombres.includes(b.nombre) || b.principio.incompatibilidadesNombres.includes(a.nombre);
      if (!incompatibles) continue;

      const aGana = RANGO_PRIORIDAD[a.prioridad] >= RANGO_PRIORIDAD[b.prioridad];
      const [preferido, descartado] = aGana ? [a, b] : [b, a];
      descartados.add(descartado.nombre);
      excluidos.push({
        nombre: descartado.nombre, tipo: 'incompatibilidad',
        motivo: `Incompatible con "${preferido.nombre}" como alternativa para el mismo objetivo: se mantiene la de mayor prioridad.`,
      });
    }
  }

  return { seleccionados: candidatosPorObjetivo.filter(c => !descartados.has(c.nombre)), excluidos };
}

// ==================== 8-9-11-12) Presentación, sabor, horario, duración ====================

export type PrincipioSeleccionMPI = CandidatoMPI & {
  dosisElegida: DosisPrincipio | null;
  fuenteDosis: 'usual' | 'minima' | 'sin_dato';
  duracionSugerida: string | null;
  decisionPresentacion: DecisionPresentacion | null;
  decisionSabor: DecisionSabor | null;
  advertencias: Alerta[];
};

function elegirDosis(c: CandidatoMPI): { dosis: DosisPrincipio | null; fuente: PrincipioSeleccionMPI['fuenteDosis'] } {
  if (c.dosisConocimiento?.habitual != null && c.dosisConocimiento.unidad) return { dosis: { valor: c.dosisConocimiento.habitual, unidad: c.dosisConocimiento.unidad }, fuente: 'usual' };
  if (c.dosisConocimiento?.minima != null && c.dosisConocimiento.unidad) return { dosis: { valor: c.dosisConocimiento.minima, unidad: c.dosisConocimiento.unidad }, fuente: 'minima' };
  if (c.principio?.dosisUsual) return { dosis: c.principio.dosisUsual, fuente: 'usual' };
  if (c.principio?.dosisMinima) return { dosis: c.principio.dosisMinima, fuente: 'minima' };
  return { dosis: null, fuente: 'sin_dato' };
}

export function completarSeleccion(
  candidato: CandidatoMPI,
  preferencias: PreferenciasPaciente | null,
  duraciones: Map<string, string>,
  advertenciasPrecaucion: Map<string, Alerta[]>,
  reglas: ReglasFormulacion
): PrincipioSeleccionMPI {
  const advertencias: Alerta[] = [...candidato.advertenciasIniciales, ...(advertenciasPrecaucion.get(candidato.nombre) ?? [])];

  if (!candidato.principio) {
    return { ...candidato, dosisElegida: null, fuenteDosis: 'sin_dato', duracionSugerida: null, decisionPresentacion: null, decisionSabor: null, advertencias };
  }

  const { dosis, fuente } = elegirDosis(candidato);
  if (!dosis) {
    advertencias.push({ codigo: `sin-dosis-${candidato.nombre}`, descripcion: `"${candidato.nombre}" no tiene dosis usual ni mínima cargada: requiere que el médico la defina manualmente.`, fuente: 'dosis' });
  }

  const dosisMg = mgDesdeDosis(dosis);
  if (dosis && dosisMg === null) {
    advertencias.push({ codigo: `unidad-no-convertible-${candidato.nombre}`, descripcion: `La dosis de "${candidato.nombre}" está en ${dosis.unidad.toUpperCase()}: no se calculan cápsulas automáticamente.`, fuente: 'dosis' });
  }

  const decisionPresentacion = decidirPresentacion(candidato.principio, dosisMg, reglas);
  if (decisionPresentacion.superaLimite) {
    advertencias.push({ codigo: `supera-capsulas-${candidato.nombre}`, descripcion: decisionPresentacion.motivo, fuente: 'presentacion' });
  }

  const decisionSabor = seleccionarSabor(candidato.principio, preferencias);
  if (!decisionSabor.sabor) {
    advertencias.push({ codigo: `sin-sabor-${candidato.nombre}`, descripcion: `${candidato.nombre}: ${decisionSabor.motivo}`, fuente: 'sabor' });
  }

  const duracionSugerida = duraciones.get(candidato.principio.id) ?? null;

  return { ...candidato, dosisElegida: dosis, fuenteDosis: fuente, duracionSugerida, decisionPresentacion, decisionSabor, advertencias };
}

// ==================== 10) Agrupación inteligente de preparados ====================

export type PreparadoMPI = { horario: string | null; principios: string[] };

/**
 * Agrupa primero por horario recomendado (cuando está cargado en la
 * Base de Conocimiento Clínica); dentro de cada horario, separa
 * incompatibles reutilizando la misma regla del MIF
 * (`agruparPorCompatibilidad`) — ningún par mutuamente incompatible
 * termina en el mismo preparado.
 */
export function agruparPreparados(seleccion: PrincipioSeleccionMPI[]): PreparadoMPI[] {
  const porHorario = new Map<string | null, PrincipioSeleccionMPI[]>();
  for (const s of seleccion) {
    const clave = s.horarioRecomendado;
    if (!porHorario.has(clave)) porHorario.set(clave, []);
    porHorario.get(clave)!.push(s);
  }

  const preparados: PreparadoMPI[] = [];
  for (const [horario, items] of porHorario) {
    const principiosDelGrupo = items.map(i => i.principio).filter((p): p is PrincipioFarmacotecnico => p !== null);
    const principiosSinDato = items.filter(i => !i.principio).map(i => i.nombre);

    const grupos = agruparPorCompatibilidad(principiosDelGrupo);
    for (const grupo of grupos) preparados.push({ horario, principios: grupo.map(p => p.nombreCanonico) });
    if (principiosSinDato.length > 0) preparados.push({ horario, principios: principiosSinDato });
  }

  return preparados;
}

// ==================== 13) Orden terapéutico ====================

/** Objetivo principal primero, luego por prioridad, luego por `orden_sugerido` (menor primero) — determinista. */
export function ordenarTerapeuticamente(seleccion: PrincipioSeleccionMPI[]): string[] {
  return [...seleccion]
    .sort((a, b) => {
      if (a.esObjetivoPrincipal !== b.esObjetivoPrincipal) return a.esObjetivoPrincipal ? -1 : 1;
      if (RANGO_PRIORIDAD[a.prioridad] !== RANGO_PRIORIDAD[b.prioridad]) return RANGO_PRIORIDAD[b.prioridad] - RANGO_PRIORIDAD[a.prioridad];
      return a.ordenSugerido - b.ordenSugerido;
    })
    .map(s => s.nombre);
}

// ==================== Orquestación ====================

export type ProtocoloSugerido = {
  pacienteId: string;
  disponible: boolean;
  motivoNoDisponible: string | null;
  prioridadTerapeutica: BandaPrioridad | null;
  fase: string | null;
  objetivosPrincipales: string[];
  objetivosSecundarios: string[];
  principiosSeleccionados: PrincipioSeleccionMPI[];
  excluidos: ExclusionMPI[];
  preparados: PreparadoMPI[];
  ordenTerapeutico: string[];
  version: number;
  advertenciaLegal: string;
};

function protocoloNoDisponible(pacienteId: string, motivo: string, fase: string | null = null): ProtocoloSugerido {
  return {
    pacienteId, disponible: false, motivoNoDisponible: motivo, prioridadTerapeutica: null, fase,
    objetivosPrincipales: [], objetivosSecundarios: [], principiosSeleccionados: [], excluidos: [], preparados: [], ordenTerapeutico: [],
    version: VERSION_MPI, advertenciaLegal: ADVERTENCIA_MPI,
  };
}

/**
 * Orquesta el pipeline completo del MPI. Mismos requisitos mínimos que
 * el MIF (objetivos + fase confirmados); diagnóstico e IPT no
 * confirmados no bloquean el protocolo — sólo dejan `prioridadTerapeutica`
 * en null, con el motivo explícito.
 */
export async function generarProtocoloSugerido(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  pacienteId: string,
  reglas: ReglasFormulacion = REGLAS_FORMULACION_DEFECTO
): Promise<ProtocoloSugerido> {
  const contexto: ContextoClinicoPaciente = await obtenerContextoClinicoPaciente(supabase, tenantId, pacienteId);

  if (!contexto.objetivos?.confirmado) return protocoloNoDisponible(pacienteId, 'Los objetivos terapéuticos todavía no están confirmados.');
  if (!contexto.fase?.confirmado) return protocoloNoDisponible(pacienteId, 'La fase terapéutica todavía no está confirmada.');

  const fase = contexto.fase.faseSeleccionada as Fase;
  const objetivos = contexto.objetivos.objetivos;

  const [principiosValidados, preferencias, contraindicacionesPaciente, ipt, conocimientoPorObjetivoEntradas] = await Promise.all([
    listarPrincipiosValidadosCompletos(supabase, tenantId),
    obtenerPreferenciasPaciente(supabase, tenantId, pacienteId),
    obtenerContextoContraindicacionesPaciente(supabase, tenantId, pacienteId),
    obtenerIptParaProtocolo(supabase, tenantId, pacienteId),
    Promise.all(objetivos.map(o => listarConocimientoValidadoPorObjetivoYFase(supabase, tenantId, o, fase))),
  ]);

  const conocimientoPorObjetivo = new Map<string, ConocimientoClinico[]>(objetivos.map((o, i) => [o, conocimientoPorObjetivoEntradas[i]]));
  const prioridadTerapeutica = ipt.confirmado ? prioridadTerapeuticaDesdeIPT(ipt.resultado) : null;

  const prioridades = prioridadPorObjetivo(objetivos, conocimientoPorObjetivo);
  const { principales, secundarios } = separarObjetivosPrincipalesYSecundarios(objetivos, prioridades);

  const porId = indexarPorId(principiosValidados);
  const porNombre = indexarPorNombreYSinonimos(principiosValidados);

  const excluidos: ExclusionMPI[] = [];
  const seleccionadosPorObjetivo: CandidatoMPI[] = [];

  for (const objetivo of [...principales, ...secundarios]) {
    const esPrincipal = principales.includes(objetivo);
    const candidatos = construirCandidatosParaObjetivo(objetivo, esPrincipal, conocimientoPorObjetivo.get(objetivo) ?? [], porId, porNombre);
    const { seleccionados, excluidos: exIncomp } = excluirAlternativasIncompatiblesPorObjetivo(candidatos);
    seleccionadosPorObjetivo.push(...seleccionados);
    excluidos.push(...exIncomp);
  }

  const { consolidados, excluidos: exDuplicados } = consolidarDuplicados(seleccionadosPorObjetivo);
  excluidos.push(...exDuplicados);

  const idsParaFlags = consolidados.map(c => c.principio?.id).filter((id): id is string => Boolean(id));
  const flagsPorId = await obtenerFlagsContraindicacion(supabase, idsParaFlags);
  const { incluidos, excluidos: exContraindicacion, advertenciasPrecaucion } = excluirPorContraindicaciones(consolidados, contraindicacionesPaciente, flagsPorId);
  excluidos.push(...exContraindicacion);

  const duraciones = await obtenerDuracionesHabituales(supabase, idsParaFlags);
  const seleccionFinal = incluidos.map(c => completarSeleccion(c, preferencias, duraciones, advertenciasPrecaucion, reglas));

  return {
    pacienteId, disponible: true, motivoNoDisponible: null, prioridadTerapeutica, fase,
    objetivosPrincipales: principales, objetivosSecundarios: secundarios,
    principiosSeleccionados: seleccionFinal, excluidos,
    preparados: agruparPreparados(seleccionFinal), ordenTerapeutico: ordenarTerapeuticamente(seleccionFinal),
    version: VERSION_MPI, advertenciaLegal: ADVERTENCIA_MPI,
  };
}
