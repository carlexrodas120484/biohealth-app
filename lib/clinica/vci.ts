/**
 * lib/clinica/vci.ts
 *
 * Validador Clínico Inteligente (VCI) — Etapa 1 (núcleo).
 *
 * Corre DESPUÉS del MPI (y, en el futuro, del MIPO), sobre su
 * resultado ya calculado. Nunca modifica, corrige, elimina ni agrega
 * nada a la prescripción: sólo la audita y devuelve un informe
 * separado (`ResultadoVCI`). Estructuralmente no hay forma de que
 * mute la entrada — todas las funciones acá son de sólo lectura sobre
 * `ProtocoloSugerido` y devuelven objetos nuevos.
 *
 * Etapa 1 implementa únicamente las verificaciones que no requieren
 * ninguna lectura nueva a Supabase: todo lo que necesitan ya está
 * calculado dentro de `ProtocoloSugerido` (dosis elegida, decisión de
 * presentación del MIF, farmacotecnia y categorías de la Base
 * Farmacotécnica, agrupación en preparados). Por eso
 * `validarPrescripcion` es una función pura y SINCRÓNICA — no hace
 * ninguna llamada a la base de datos. Contraindicaciones/alergias del
 * paciente, interacciones, cofactores y palatabilidad quedan para
 * etapas siguientes, cuando el VCI incorpore sus propias lecturas
 * (ver BIOHEALTH_DECISIONS.md / diseño aprobado del VCI).
 *
 * No importa nada de app/api ni de componentes de UI. No toca
 * lib/clinica/mif.ts ni lib/clinica/mpi.ts salvo para leer sus tipos
 * y reutilizar `mgDesdeDosis` (función pura, ya probada).
 */

import { mgDesdeDosis } from './mif';
import type { DosisPrincipio } from '@/lib/repositorios/baseFarmacotecnica';
import type { ProtocoloSugerido, PrincipioSeleccionMPI, PreparadoMPI } from './mpi';

export const VERSION_VCI = 1;

export const ADVERTENCIA_VCI =
  'Validador Clínico Inteligente: audita la prescripción sugerida y devuelve alertas, score y nivel de confianza. ' +
  'No modifica la receta, no elimina principios, no cambia dosis ni presentación, y no bloquea la firma por sí solo — ' +
  'toda decisión final sigue siendo del profesional.';

// ==================== Tipos e interfaces ====================

export type SeveridadAlerta = 'critica' | 'importante' | 'sugerencia';

export type CategoriaAlerta =
  | 'seguridad-alergia'
  | 'seguridad-contraindicacion-excluida'
  | 'dosis-fuera-de-rango'
  | 'interaccion'
  | 'duplicidad-terapeutica'
  | 'redundancia'
  | 'compatibilidad-farmacotecnica'
  | 'exceso-capsulas'
  | 'exceso-gramos-sobre'
  | 'exceso-principios-preparado'
  | 'horario'
  | 'cofactor-ausente'
  | 'palatabilidad'
  | 'adherencia'
  | 'integridad-datos';

export type AlertaVCI = {
  codigo: string;
  categoria: CategoriaAlerta;
  severidad: SeveridadAlerta;
  titulo: string;
  descripcion: string;
  principiosImplicados: string[];
  evidenciaOFuente: string;
  /** Negativo o cero. Nunca positivo — las bonificaciones son un tipo aparte (`BonificacionVCI`). */
  impactoScore: number;
  recomendacion: string | null;
  requiereRevisionAntesDeFirmar: boolean;
};

export type BonificacionVCI = {
  codigo: string;
  descripcion: string;
  impacto: number;
};

export type ComponenteScore = {
  origen: 'alerta' | 'bonificacion';
  codigo: string;
  descripcion: string;
  impacto: number;
};

export type DesgloseScore = {
  scoreInicial: 100;
  componentes: ComponenteScore[];
  /** Suma antes del clamp a [0,100] — para poder mostrar "hubiera sido -5, se muestra 0". */
  sumaCruda: number;
  scoreFinal: number;
  huboClamp: boolean;
};

export type ScoreCalidad = {
  valor: number;
  desglose: DesgloseScore;
};

export type NivelConfianza = 'alta' | 'media' | 'baja';

export type FactorConfianza = {
  campo: string;
  peso: 'alto' | 'medio' | 'bajo';
  descripcion: string;
};

export type MotivoConfianza = {
  nivel: NivelConfianza;
  factoresFaltantes: FactorConfianza[];
  factoresPresentes: string[];
  explicacion: string;
};

export type ResultadoVCI = {
  pacienteId: string;
  disponible: boolean;
  motivoNoDisponible: string | null;

  scoreGlobal: number;
  confianza: NivelConfianza;
  motivosConfianza: MotivoConfianza;

  alertasCriticas: AlertaVCI[];
  alertasImportantes: AlertaVCI[];
  sugerencias: AlertaVCI[];

  desgloseScore: DesgloseScore;
  datosFaltantes: FactorConfianza[];

  advertenciaLegal: string;
  versionReglas: number;
};

export type ReglasVCI = {
  /** mg — umbral de referencia farmacotécnica, no un límite clínico. */
  limiteGramosPorSobreDefecto: number;
  maxPrincipiosPorPreparadoDefecto: number;
  /** Fracción [0,1): a partir de qué proporción del máximo se considera "dosis cercana al máximo". */
  umbralDosisCercanaAlMaximo: number;
};

export const REGLAS_VCI_DEFECTO: ReglasVCI = {
  limiteGramosPorSobreDefecto: 5000,
  maxPrincipiosPorPreparadoDefecto: 5,
  umbralDosisCercanaAlMaximo: 0.9,
};

const HORARIOS_VALIDOS = new Set(['ayunas', 'desayuno', 'almuerzo', 'cena', 'antes_de_dormir']);

// ==================== Verificación 1: dosis fuera de rango ====================

function resolverRangoDosisMg(c: PrincipioSeleccionMPI): { minimaMg: number | null; maximaMg: number | null; fuente: 'conocimiento_clinico' | 'base_farmacotecnica' | 'sin_dato' } {
  if (c.dosisConocimiento?.unidad && (c.dosisConocimiento.minima != null || c.dosisConocimiento.maxima != null)) {
    const unidad = c.dosisConocimiento.unidad;
    return {
      minimaMg: c.dosisConocimiento.minima != null ? mgDesdeDosis({ valor: c.dosisConocimiento.minima, unidad }) : null,
      maximaMg: c.dosisConocimiento.maxima != null ? mgDesdeDosis({ valor: c.dosisConocimiento.maxima, unidad }) : null,
      fuente: 'conocimiento_clinico',
    };
  }
  if (c.principio) {
    return {
      minimaMg: mgDesdeDosis(c.principio.dosisMinima),
      maximaMg: mgDesdeDosis(c.principio.dosisMaxima),
      fuente: 'base_farmacotecnica',
    };
  }
  return { minimaMg: null, maximaMg: null, fuente: 'sin_dato' };
}

const NOMBRE_FUENTE_RANGO: Record<'conocimiento_clinico' | 'base_farmacotecnica', string> = {
  conocimiento_clinico: 'la Base de Conocimiento Clínica validada',
  base_farmacotecnica: 'la Base Farmacotécnica',
};

export function verificarDosisFueraDeRango(seleccionados: PrincipioSeleccionMPI[], reglas: ReglasVCI): AlertaVCI[] {
  const alertas: AlertaVCI[] = [];

  for (const c of seleccionados) {
    if (!c.dosisElegida) continue; // MIF/MPI ya advierten "sin dosis" — el VCI no duplica esa alerta acá.
    const dosisMg = mgDesdeDosis(c.dosisElegida);
    if (dosisMg === null) continue; // Unidad no convertible (UI/ml): no se puede verificar el rango numéricamente.

    const { minimaMg, maximaMg, fuente } = resolverRangoDosisMg(c);
    if (minimaMg === null && maximaMg === null) continue; // Sin rango cargado: nada que verificar.
    const fuenteTexto = fuente === 'sin_dato' ? '' : NOMBRE_FUENTE_RANGO[fuente];

    if (maximaMg !== null && dosisMg > maximaMg) {
      alertas.push({
        codigo: `dosis-excede-maxima-${c.nombre}`, categoria: 'dosis-fuera-de-rango', severidad: 'critica',
        titulo: `Dosis de ${c.nombre} supera el máximo cargado`,
        descripcion: `La dosis elegida (${dosisMg} mg) supera el máximo (${maximaMg} mg) cargado en ${fuenteTexto}.`,
        principiosImplicados: [c.nombre], evidenciaOFuente: fuente, impactoScore: -20,
        recomendacion: 'Revisar y ajustar la dosis antes de firmar.', requiereRevisionAntesDeFirmar: true,
      });
      continue; // Ya está excedida: no evaluar además "cercana al máximo" para el mismo principio.
    }

    if (maximaMg !== null && dosisMg >= maximaMg * reglas.umbralDosisCercanaAlMaximo) {
      alertas.push({
        codigo: `dosis-cerca-maxima-${c.nombre}`, categoria: 'dosis-fuera-de-rango', severidad: 'importante',
        titulo: `Dosis de ${c.nombre} cercana al máximo`,
        descripcion: `La dosis elegida (${dosisMg} mg) está a menos del ${Math.round((1 - reglas.umbralDosisCercanaAlMaximo) * 100)}% del máximo cargado (${maximaMg} mg) en ${fuenteTexto}.`,
        principiosImplicados: [c.nombre], evidenciaOFuente: fuente, impactoScore: -8,
        recomendacion: 'Valorar si conviene ajustar la dosis con más margen de seguridad.', requiereRevisionAntesDeFirmar: false,
      });
    }

    if (minimaMg !== null && dosisMg < minimaMg) {
      alertas.push({
        codigo: `dosis-bajo-minima-${c.nombre}`, categoria: 'dosis-fuera-de-rango', severidad: 'importante',
        titulo: `Dosis de ${c.nombre} por debajo de la mínima cargada`,
        descripcion: `La dosis elegida (${dosisMg} mg) está por debajo del mínimo (${minimaMg} mg) cargado en ${fuenteTexto}.`,
        principiosImplicados: [c.nombre], evidenciaOFuente: fuente, impactoScore: -6,
        recomendacion: 'Confirmar si la dosis subterapéutica es intencional.', requiereRevisionAntesDeFirmar: false,
      });
    }
  }

  return alertas;
}

// ==================== Verificación 2: duplicidad terapéutica ====================

export function verificarDuplicidadTerapeutica(seleccionados: PrincipioSeleccionMPI[]): AlertaVCI[] {
  const alertas: AlertaVCI[] = [];
  const vistos = new Set<string>();

  for (let i = 0; i < seleccionados.length; i++) {
    const a = seleccionados[i];
    if (!a.principio || a.principio.categorias.length === 0) continue;
    for (let j = i + 1; j < seleccionados.length; j++) {
      const b = seleccionados[j];
      if (!b.principio || b.principio.categorias.length === 0) continue;
      const comunes = a.principio.categorias.filter(cat => b.principio!.categorias.includes(cat));
      if (comunes.length === 0) continue;

      const clave = [a.nombre, b.nombre].sort().join('|');
      if (vistos.has(clave)) continue;
      vistos.add(clave);

      alertas.push({
        codigo: `duplicidad-terapeutica-${clave}`, categoria: 'duplicidad-terapeutica', severidad: 'importante',
        titulo: `Posible duplicidad terapéutica entre ${a.nombre} y ${b.nombre}`,
        descripcion: `Ambos comparten categoría clínica (${comunes.join(', ')}): revisar si cumplen la misma función en este protocolo.`,
        principiosImplicados: [a.nombre, b.nombre], evidenciaOFuente: 'categorías clínicas compartidas (Base Farmacotécnica)',
        impactoScore: -8, recomendacion: 'Confirmar si ambos son necesarios o si uno es redundante.', requiereRevisionAntesDeFirmar: false,
      });
    }
  }

  return alertas;
}

// ==================== Verificación 3: más de 2 cápsulas por toma ====================

export function verificarExcesoCapsulas(seleccionados: PrincipioSeleccionMPI[]): AlertaVCI[] {
  const alertas: AlertaVCI[] = [];

  for (const c of seleccionados) {
    const d = c.decisionPresentacion;
    if (!d || !d.superaLimite || d.presentacionSugerida !== 'capsula') continue;

    alertas.push({
      codigo: `exceso-capsulas-${c.nombre}`, categoria: 'exceso-capsulas', severidad: 'importante',
      titulo: `${c.nombre} requiere más cápsulas de las recomendadas por toma`,
      descripcion: `Requiere ${d.capsulasPorToma} cápsula(s) por toma, superando el límite de ${d.limiteCapsulasAplicado}. ${d.motivo}`,
      principiosImplicados: [c.nombre], evidenciaOFuente: 'decisión de presentación del MIF',
      impactoScore: -5, recomendacion: 'Valorar dividir horarios o ajustar la capsulación con la botica.', requiereRevisionAntesDeFirmar: false,
    });
  }

  return alertas;
}

// ==================== Verificación 4: exceso de gramos por sobre ====================

export function verificarExcesoGramosPorSobre(seleccionados: PrincipioSeleccionMPI[], reglas: ReglasVCI): AlertaVCI[] {
  const alertas: AlertaVCI[] = [];

  for (const c of seleccionados) {
    if (c.decisionPresentacion?.presentacionSugerida !== 'sobre' || !c.dosisElegida) continue;
    const dosisMg = mgDesdeDosis(c.dosisElegida);
    if (dosisMg === null || dosisMg <= reglas.limiteGramosPorSobreDefecto) continue;

    alertas.push({
      codigo: `exceso-gramos-sobre-${c.nombre}`, categoria: 'exceso-gramos-sobre', severidad: 'importante',
      titulo: `${c.nombre} podría superar el peso práctico de un sobre`,
      descripcion: `La dosis por toma (${dosisMg} mg) supera el umbral de referencia de ${reglas.limiteGramosPorSobreDefecto} mg para un sobre.`,
      principiosImplicados: [c.nombre], evidenciaOFuente: `umbral configurable (REGLAS_VCI_DEFECTO.limiteGramosPorSobreDefecto=${reglas.limiteGramosPorSobreDefecto})`,
      impactoScore: -5, recomendacion: 'Confirmar con la botica si el sobre es viable en la práctica a ese peso.', requiereRevisionAntesDeFirmar: false,
    });
  }

  return alertas;
}

// ==================== Verificación 5: incompatibilidades de presentación ====================

export function verificarIncompatibilidadesPresentacion(seleccionados: PrincipioSeleccionMPI[]): AlertaVCI[] {
  const alertas: AlertaVCI[] = [];

  for (const c of seleccionados) {
    if (!c.principio || !c.decisionPresentacion) continue;
    const presentacion = c.decisionPresentacion.presentacionSugerida;
    const f = c.principio.farmacotecnia;
    const contradice =
      (presentacion === 'capsula' && f.compatibleCapsulas === false) ||
      (presentacion === 'sobre' && f.compatibleSobres === false);
    if (!contradice) continue;

    alertas.push({
      codigo: `incompatibilidad-presentacion-${c.nombre}`, categoria: 'compatibilidad-farmacotecnica', severidad: 'critica',
      titulo: `${c.nombre}: presentación sugerida contradice los datos de farmacotecnia`,
      descripcion: `Se sugirió "${presentacion}" pero la Base Farmacotécnica marca este principio como no compatible con esa forma.`,
      principiosImplicados: [c.nombre], evidenciaOFuente: 'farmacotecnia_principios (Base Farmacotécnica)',
      impactoScore: -15, recomendacion: 'Revisar manualmente la presentación antes de firmar.', requiereRevisionAntesDeFirmar: true,
    });
  }

  return alertas;
}

// ==================== Verificación 6: horarios imposibles ====================

export function verificarHorariosImposibles(seleccionados: PrincipioSeleccionMPI[], preparados: PreparadoMPI[]): AlertaVCI[] {
  const alertas: AlertaVCI[] = [];

  for (const c of seleccionados) {
    if (c.horarioRecomendado && !HORARIOS_VALIDOS.has(c.horarioRecomendado)) {
      alertas.push({
        codigo: `horario-invalido-${c.nombre}`, categoria: 'horario', severidad: 'critica',
        titulo: `Horario recomendado inválido para ${c.nombre}`,
        descripcion: `El horario cargado ("${c.horarioRecomendado}") no pertenece al catálogo válido de horarios.`,
        principiosImplicados: [c.nombre], evidenciaOFuente: 'conocimiento_clinico', impactoScore: -10,
        recomendacion: 'Corregir el dato de horario en la Base de Conocimiento Clínica.', requiereRevisionAntesDeFirmar: true,
      });
    }
  }

  for (const p of preparados) {
    for (const nombre of p.principios) {
      const c = seleccionados.find(s => s.nombre === nombre);
      if (!c || !c.horarioRecomendado || c.horarioRecomendado === p.horario) continue;

      alertas.push({
        codigo: `horario-inconsistente-${nombre}`, categoria: 'horario', severidad: 'importante',
        titulo: `${nombre} agrupado en un horario distinto al recomendado`,
        descripcion: `Quedó agrupado en el preparado de "${p.horario ?? 'sin horario asignado'}", pero su horario recomendado individual es "${c.horarioRecomendado}".`,
        principiosImplicados: [nombre], evidenciaOFuente: 'agrupación de preparados del MPI', impactoScore: -4,
        recomendacion: 'Confirmar el horario definitivo con el médico.', requiereRevisionAntesDeFirmar: false,
      });
    }
  }

  return alertas;
}

// ==================== Verificación 7: exceso de principios por preparado ====================

export function verificarExcesoPrincipiosPorPreparado(preparados: PreparadoMPI[], reglas: ReglasVCI): AlertaVCI[] {
  const alertas: AlertaVCI[] = [];

  preparados.forEach((p, indice) => {
    if (p.principios.length <= reglas.maxPrincipiosPorPreparadoDefecto) return;

    alertas.push({
      codigo: `exceso-principios-preparado-${p.horario ?? 'sin-horario'}-${indice}`, categoria: 'exceso-principios-preparado', severidad: 'importante',
      titulo: 'Preparado con demasiados principios activos',
      descripcion: `El preparado de "${p.horario ?? 'sin horario asignado'}" agrupa ${p.principios.length} principios (${p.principios.join(', ')}), por encima del umbral de referencia (${reglas.maxPrincipiosPorPreparadoDefecto}).`,
      principiosImplicados: p.principios, evidenciaOFuente: `umbral configurable (REGLAS_VCI_DEFECTO.maxPrincipiosPorPreparadoDefecto=${reglas.maxPrincipiosPorPreparadoDefecto})`,
      impactoScore: -4, recomendacion: 'Valorar simplificar o dividir el preparado.', requiereRevisionAntesDeFirmar: false,
    });
  });

  return alertas;
}

// ==================== Verificación 8: principios redundantes ====================

/**
 * Re-chequeo defensivo: `consolidarDuplicados` del MPI ya debería
 * garantizar que ningún principio aparezca dos veces. Si esta alerta
 * llega a dispararse, es una señal de una falla en el pipeline aguas
 * arriba (posible doble dosis efectiva) — por eso es crítica.
 */
export function verificarRedundancia(seleccionados: PrincipioSeleccionMPI[]): AlertaVCI[] {
  const alertas: AlertaVCI[] = [];
  const conteo = new Map<string, number>();
  for (const c of seleccionados) conteo.set(c.nombre, (conteo.get(c.nombre) ?? 0) + 1);

  for (const [nombre, n] of conteo) {
    if (n <= 1) continue;
    alertas.push({
      codigo: `redundancia-${nombre}`, categoria: 'redundancia', severidad: 'critica',
      titulo: `${nombre} aparece más de una vez en la prescripción`,
      descripcion: `"${nombre}" aparece ${n} veces entre los principios seleccionados: la consolidación de duplicados no debería permitir esto.`,
      principiosImplicados: [nombre], evidenciaOFuente: 'principiosSeleccionados (integridad del pipeline)',
      impactoScore: -20, recomendacion: 'Revisar manualmente antes de firmar: podría implicar doble dosis efectiva.', requiereRevisionAntesDeFirmar: true,
    });
  }

  return alertas;
}

// ==================== Integridad de datos → alertas + factores de confianza ====================

function principioSinFarmacotecniaCargada(c: PrincipioSeleccionMPI): boolean {
  if (!c.principio) return false;
  const f = c.principio.farmacotecnia;
  return f.compatibleCapsulas === null && f.compatibleLiquidos === null && f.compatibleSobres === null
    && f.higroscopico === null && f.fotosensible === null && f.sensibleCalor === null;
}

/**
 * Etapa 1 sólo puede evaluar completitud de datos DEL PROTOCOLO (Base
 * Farmacotécnica / Base de Conocimiento). Los factores de confianza
 * relativos al PACIENTE (medicación, alergias, función renal/hepática,
 * embarazo/lactancia, peso/edad) quedan para la etapa en que el VCI
 * incorpore esa lectura — ver diseño aprobado, sección 2.
 */
export function evaluarIntegridadYConfianza(seleccionados: PrincipioSeleccionMPI[]): { alertas: AlertaVCI[]; factores: FactorConfianza[] } {
  const alertas: AlertaVCI[] = [];
  const factores: FactorConfianza[] = [];

  for (const c of seleccionados) {
    if (!c.disponibleEnBaseValidada || !c.principio) {
      factores.push({
        campo: `principio:${c.nombre}`, peso: 'alto',
        descripcion: `"${c.nombre}" no tiene un registro validado en la Base de Conocimiento Clínica ni en la Base Farmacotécnica: se sugirió desde el catálogo heredado.`,
      });
      alertas.push({
        codigo: `integridad-sin-validar-${c.nombre}`, categoria: 'integridad-datos', severidad: 'sugerencia',
        titulo: `${c.nombre} sin validar en la Base de Conocimiento`,
        descripcion: 'Se sugirió sin respaldo validado; los cálculos de dosis/presentación no tienen la misma solidez que un principio validado.',
        principiosImplicados: [c.nombre], evidenciaOFuente: 'disponibleEnBaseValidada=false', impactoScore: -1,
        recomendacion: 'Validar este principio en la Base de Conocimiento Clínica.', requiereRevisionAntesDeFirmar: false,
      });
      continue;
    }

    if (!c.dosisElegida) {
      factores.push({ campo: `dosis:${c.nombre}`, peso: 'alto', descripcion: `Sin dosis validada (ni usual ni mínima) para "${c.nombre}".` });
    }

    if (principioSinFarmacotecniaCargada(c)) {
      factores.push({ campo: `farmacotecnia:${c.nombre}`, peso: 'medio', descripcion: `Sin datos de farmacotecnia cargados para "${c.nombre}".` });
    }
  }

  return { alertas, factores };
}

export function clasificarConfianza(factores: FactorConfianza[]): NivelConfianza {
  const altos = factores.filter(f => f.peso === 'alto').length;
  const medios = factores.filter(f => f.peso === 'medio').length;
  if (altos >= 1 || medios >= 3) return 'baja';
  if (medios >= 1) return 'media';
  return 'alta';
}

function construirExplicacionConfianza(nivel: NivelConfianza, factores: FactorConfianza[]): string {
  if (factores.length === 0) {
    return 'Confianza alta: todos los principios seleccionados están validados, con dosis y datos farmacotécnicos completos.';
  }
  return `Confianza ${nivel}: ${factores.map(f => f.descripcion).join(' ')}`;
}

// ==================== Score global ====================

export function calcularScore(alertas: AlertaVCI[], preparados: PreparadoMPI[]): DesgloseScore {
  const componentes: ComponenteScore[] = alertas
    .filter(a => a.impactoScore !== 0)
    .map(a => ({ origen: 'alerta' as const, codigo: a.codigo, descripcion: `${a.impactoScore} — ${a.titulo}`, impacto: a.impactoScore }));

  const hayAlertaGrave = alertas.some(a => a.severidad === 'critica' || a.severidad === 'importante');
  if (!hayAlertaGrave && preparados.length > 0) {
    const horariosDistintos = new Set(preparados.map(p => p.horario)).size;
    const sinFragmentacionExtra = preparados.length <= horariosDistintos;
    if (sinFragmentacionExtra) {
      componentes.push({ origen: 'bonificacion', codigo: 'agrupacion-farmacotecnica-adecuada', descripcion: '+2 — agrupación de preparados sin fragmentación innecesaria', impacto: 2 });
    }
  }

  const sumaCruda = 100 + componentes.reduce((acc, c) => acc + c.impacto, 0);
  const scoreFinal = Math.max(0, Math.min(100, sumaCruda));
  return { scoreInicial: 100, componentes, sumaCruda, scoreFinal, huboClamp: scoreFinal !== sumaCruda };
}

// ==================== Orquestación ====================

function resultadoNoDisponible(protocolo: ProtocoloSugerido): ResultadoVCI {
  return {
    pacienteId: protocolo.pacienteId, disponible: false, motivoNoDisponible: protocolo.motivoNoDisponible,
    scoreGlobal: 0, confianza: 'baja',
    motivosConfianza: { nivel: 'baja', factoresFaltantes: [], factoresPresentes: [], explicacion: 'No se generó protocolo: no hay nada que validar.' },
    alertasCriticas: [], alertasImportantes: [], sugerencias: [],
    desgloseScore: { scoreInicial: 100, componentes: [], sumaCruda: 100, scoreFinal: 0, huboClamp: true },
    datosFaltantes: [], advertenciaLegal: ADVERTENCIA_VCI, versionReglas: VERSION_VCI,
  };
}

/**
 * Punto de entrada del VCI (Etapa 1). Función pura y sincrónica: no
 * llama a Supabase, no muta `protocolo` ni ninguno de sus arreglos —
 * sólo lee y devuelve un `ResultadoVCI` nuevo.
 */
export function validarPrescripcion(protocolo: ProtocoloSugerido, reglas: ReglasVCI = REGLAS_VCI_DEFECTO): ResultadoVCI {
  if (!protocolo.disponible) return resultadoNoDisponible(protocolo);

  const seleccionados = protocolo.principiosSeleccionados;
  const { alertas: alertasIntegridad, factores } = evaluarIntegridadYConfianza(seleccionados);

  const todasLasAlertas: AlertaVCI[] = [
    ...verificarDosisFueraDeRango(seleccionados, reglas),
    ...verificarDuplicidadTerapeutica(seleccionados),
    ...verificarExcesoCapsulas(seleccionados),
    ...verificarExcesoGramosPorSobre(seleccionados, reglas),
    ...verificarIncompatibilidadesPresentacion(seleccionados),
    ...verificarHorariosImposibles(seleccionados, protocolo.preparados),
    ...verificarExcesoPrincipiosPorPreparado(protocolo.preparados, reglas),
    ...verificarRedundancia(seleccionados),
    ...alertasIntegridad,
  ];

  const desgloseScore = calcularScore(todasLasAlertas, protocolo.preparados);
  const nivelConfianza = clasificarConfianza(factores);
  const motivosConfianza: MotivoConfianza = {
    nivel: nivelConfianza,
    factoresFaltantes: factores,
    factoresPresentes: seleccionados.filter(c => c.disponibleEnBaseValidada && c.dosisElegida).map(c => c.nombre),
    explicacion: construirExplicacionConfianza(nivelConfianza, factores),
  };

  return {
    pacienteId: protocolo.pacienteId, disponible: true, motivoNoDisponible: null,
    scoreGlobal: desgloseScore.scoreFinal, confianza: nivelConfianza, motivosConfianza,
    alertasCriticas: todasLasAlertas.filter(a => a.severidad === 'critica'),
    alertasImportantes: todasLasAlertas.filter(a => a.severidad === 'importante'),
    sugerencias: todasLasAlertas.filter(a => a.severidad === 'sugerencia'),
    desgloseScore, datosFaltantes: factores,
    advertenciaLegal: ADVERTENCIA_VCI, versionReglas: VERSION_VCI,
  };
}
