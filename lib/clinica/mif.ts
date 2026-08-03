/**
 * lib/clinica/mif.ts
 *
 * Motor Inteligente de Formulación (MIF): reglas puras (testeables sin
 * base de datos) más el servicio de orquestación que arma una
 * sugerencia de receta magistral a partir de la Base Farmacotécnica.
 *
 * Igual que lib/clinica/formulacion.ts, este módulo NUNCA prescribe ni
 * aprueba nada por su cuenta: `generarFormulaSugerida` es de sólo
 * lectura — no inserta ni actualiza ninguna fila. La persistencia de
 * una fórmula sigue siendo, exclusivamente, la del flujo ya existente
 * (app/api/pacientes/[id]/formulacion/route.ts), que este módulo no
 * toca ni reemplaza.
 *
 * Reutiliza deliberadamente piezas ya probadas de formulacion.ts en
 * vez de reimplementarlas (cálculo de cápsulas, reglas configurables,
 * sugerencia de principios por objetivo, tipo de alerta) — ver
 * BIOHEALTH_DECISIONS.md, ADR de reutilización de patrones.
 */

import {
  calcularCapsulasPorToma, sugerirPrincipiosActivos, REGLAS_FORMULACION_DEFECTO,
  type ReglasFormulacion, type Alerta, type SugerenciaPrincipioActivo,
} from './formulacion';
import { normalizarNombre } from './baseConocimiento';
import type { Sabor } from '@/lib/validation/baseFarmacotecnica';
import type {
  PrincipioFarmacotecnico, PreferenciasPaciente, ContextoClinicoPaciente, DosisPrincipio,
} from '@/lib/repositorios/baseFarmacotecnica';
import {
  obtenerContextoClinicoPaciente, listarPrincipiosValidadosCompletos, obtenerPreferenciasPaciente,
} from '@/lib/repositorios/baseFarmacotecnica';
import type { createClient } from '@/lib/supabase/server';

export const VERSION_MIF = 1;

export const ADVERTENCIA_MIF =
  'Motor Inteligente de Formulación: genera una sugerencia de receta a partir de la Base Farmacotécnica. ' +
  'No prescribe ni aprueba nada — toda sugerencia requiere revisión, ajuste y aprobación médica explícita antes de convertirse en receta.';

// ==================== Regla 0: conversión de unidades (sólo aritmética, nunca clínica) ====================

/**
 * Convierte a mg cuando la unidad es una unidad de masa (mg/g/mcg).
 * 'ui' (Unidades Internacionales) y 'ml' (líquido) NO son masa —
 * convertirlas a mg exigiría un factor específico de cada sustancia
 * que este módulo no tiene y no debe inventar. En esos casos se
 * devuelve null: el resto del motor debe tratar la ausencia de mg
 * como "no se puede calcular cápsulas automáticamente", nunca asumir
 * un valor.
 */
export function mgDesdeDosis(dosis: DosisPrincipio | null): number | null {
  if (!dosis) return null;
  switch (dosis.unidad) {
    case 'mg': return dosis.valor;
    case 'g': return dosis.valor * 1000;
    case 'mcg': return dosis.valor / 1000;
    case 'ui':
    case 'ml':
      return null;
  }
}

// ==================== Regla 1 y 2: presentación (cápsulas / sobre / líquido / dividir horario) ====================

export type OpcionPresentacion = 'capsula' | 'sobre' | 'liquido' | 'perlas' | 'polvo' | 'comprimidos' | 'comercial';

export type AlternativaEvaluada = {
  opcion: 'sobre' | 'liquido' | 'dividir_horario';
  viable: boolean;
  motivo: string;
};

export type DecisionPresentacion = {
  presentacionSugerida: OpcionPresentacion;
  capsulasPorToma: number | null;
  limiteCapsulasAplicado: number;
  superaLimite: boolean;
  alternativasEvaluadas: AlternativaEvaluada[];
  motivo: string;
};

/** Regla 3: perfil organoléptico muy desfavorable → nunca convertir automáticamente a sobre/líquido. */
export function perfilOrganolepticoBloqueaConversion(perfil: PrincipioFarmacotecnico['perfilOrganoleptico']): { bloqueado: boolean; motivo: string | null } {
  const tipoDesfavorable = perfil.tipoSabor === 'amargo' || perfil.tipoSabor === 'sulfuroso';
  const intensidadAlta = perfil.intensidad === 'alta' || perfil.intensidad === 'extrema';
  if (tipoDesfavorable && intensidadAlta) {
    return { bloqueado: true, motivo: `Perfil organoléptico muy desfavorable (${perfil.tipoSabor}, intensidad ${perfil.intensidad}): se mantiene en cápsulas.` };
  }
  if (perfil.facilidadEnmascarar === 'dificil') {
    return { bloqueado: true, motivo: 'El sabor es difícil de enmascarar: se mantiene en cápsulas.' };
  }
  return { bloqueado: false, motivo: null };
}

/**
 * Reglas 1-3: decide presentación para una toma. `dosisPorTomaMg` debe
 * venir ya en mg (ver `mgDesdeDosis`); si es null (unidad no
 * convertible, ej. UI o ml), no se puede calcular cápsulas y se
 * devuelve la presentación ideal cargada en el catálogo, marcando el
 * motivo.
 */
export function decidirPresentacion(
  principio: PrincipioFarmacotecnico,
  dosisPorTomaMg: number | null,
  reglas: ReglasFormulacion = REGLAS_FORMULACION_DEFECTO
): DecisionPresentacion {
  const limite = principio.maxCapsulasPorToma ?? reglas.limiteCapsulasAntesDeSobre;

  if (dosisPorTomaMg === null) {
    return {
      presentacionSugerida: (principio.presentacionIdeal as OpcionPresentacion | null) ?? 'capsula',
      capsulasPorToma: null,
      limiteCapsulasAplicado: limite,
      superaLimite: false,
      alternativasEvaluadas: [],
      motivo: 'La dosis está en una unidad que no se convierte automáticamente a mg (UI o ml): no se calculan cápsulas, se usa la presentación ideal cargada en la Base Farmacotécnica.',
    };
  }

  const capacidad = principio.capacidadCapsulaMg ?? reglas.capacidadCapsulaMgDefecto;
  const capsulasPorToma = calcularCapsulasPorToma(dosisPorTomaMg, capacidad);
  const bloqueo = perfilOrganolepticoBloqueaConversion(principio.perfilOrganoleptico);

  // Regla 3: perfil organoléptico desfavorable → cápsulas, sin importar la cantidad.
  if (bloqueo.bloqueado) {
    return {
      presentacionSugerida: 'capsula', capsulasPorToma, limiteCapsulasAplicado: limite,
      superaLimite: capsulasPorToma > limite, alternativasEvaluadas: [], motivo: bloqueo.motivo!,
    };
  }

  // Regla 1: dentro del límite → cápsulas, sin evaluar alternativas.
  if (capsulasPorToma <= limite) {
    return {
      presentacionSugerida: 'capsula', capsulasPorToma, limiteCapsulasAplicado: limite,
      superaLimite: false, alternativasEvaluadas: [],
      motivo: `Dosis por toma requiere ${capsulasPorToma} cápsula(s), dentro del límite de ${limite}.`,
    };
  }

  // Regla 2: supera el límite → evaluar sobre, líquido, dividir horario, en ese orden de preferencia.
  const alternativas: AlternativaEvaluada[] = [
    {
      opcion: 'sobre', viable: principio.farmacotecnia.compatibleSobres === true,
      motivo: principio.farmacotecnia.compatibleSobres === true
        ? 'Compatible con sobre según la Base Farmacotécnica.'
        : 'No cargado como compatible con sobre (o dato faltante): no se sugiere sobre sin confirmación.',
    },
    {
      opcion: 'liquido', viable: principio.farmacotecnia.compatibleLiquidos === true,
      motivo: principio.farmacotecnia.compatibleLiquidos === true
        ? 'Compatible con líquido según la Base Farmacotécnica.'
        : 'No cargado como compatible con líquido (o dato faltante): no se sugiere líquido sin confirmación.',
    },
    {
      opcion: 'dividir_horario', viable: true,
      motivo: 'Siempre disponible como alternativa: repartir la dosis diaria en más tomas reduce las cápsulas por toma.',
    },
  ];

  const elegida = alternativas.find(a => a.opcion !== 'dividir_horario' && a.viable) ?? alternativas[2];
  const presentacionSugerida: OpcionPresentacion = elegida.opcion === 'dividir_horario' ? 'capsula' : elegida.opcion;

  return {
    presentacionSugerida, capsulasPorToma, limiteCapsulasAplicado: limite, superaLimite: true,
    alternativasEvaluadas: alternativas,
    motivo: `Supera el límite de ${limite} cápsula(s) por toma (requiere ${capsulasPorToma}): se evaluaron sobre, líquido y división de horarios.`,
  };
}

// ==================== Reglas 4 y 5: selección de sabor ====================

export type DecisionSabor = { sabor: Sabor | null; motivo: string };

/**
 * Regla 4: sugiere el sabor compatible con mayor nivel de aceptación.
 * Regla 5: si el sabor favorito del paciente está entre los
 * compatibles (y no fue rechazado), tiene prioridad sobre el de mayor
 * aceptación general.
 */
export function seleccionarSabor(
  principio: PrincipioFarmacotecnico,
  preferencias: PreferenciasPaciente | null
): DecisionSabor {
  const rechazados = new Set(preferencias?.saboresRechazados ?? []);
  const compatibles = principio.saboresCompatibles.filter(s => !rechazados.has(s.sabor));

  if (compatibles.length === 0) {
    return { sabor: null, motivo: 'Sin sabor compatible disponible tras excluir los rechazados por el paciente (o sin sabores cargados en la Base Farmacotécnica).' };
  }

  if (preferencias?.saborFavorito && compatibles.some(s => s.sabor === preferencias.saborFavorito)) {
    return { sabor: preferencias.saborFavorito, motivo: 'Sabor favorito del paciente: tiene prioridad sobre el de mayor aceptación general (Regla 5).' };
  }

  const mejor = [...compatibles].sort((a, b) => b.nivelAceptacion - a.nivelAceptacion)[0];
  return { sabor: mejor.sabor, motivo: `Mayor aceptación entre los sabores compatibles (nivel ${mejor.nivelAceptacion}/5).` };
}

// ==================== Agrupar compatibles / separar incompatibles ====================

/**
 * Empaquetado voraz determinista: ningún par mutuamente listado como
 * incompatible cae en el mismo grupo. Análogo a
 * `separarIncompatibles` de formulacion.ts, pero sobre
 * `PrincipioFarmacotecnico` en vez de `IngredienteFormula` — se
 * mantiene independiente para no acoplar el MIF al tipo de dato del
 * motor existente.
 */
export function agruparPorCompatibilidad(principios: PrincipioFarmacotecnico[]): PrincipioFarmacotecnico[][] {
  const grupos: PrincipioFarmacotecnico[][] = [];
  for (const p of principios) {
    let colocado = false;
    for (const grupo of grupos) {
      const choca = grupo.some(otro =>
        p.incompatibilidadesNombres.includes(otro.nombreCanonico) || otro.incompatibilidadesNombres.includes(p.nombreCanonico)
      );
      if (!choca) { grupo.push(p); colocado = true; break; }
    }
    if (!colocado) grupos.push([p]);
  }
  return grupos;
}

// ==================== Servicio de orquestación ====================

export type CandidatoFormula = {
  nombre: string;
  objetivo: string;
  disponibleEnBaseValidada: boolean;
  principio: PrincipioFarmacotecnico | null;
  dosisElegida: DosisPrincipio | null;
  fuenteDosis: 'usual' | 'minima' | 'sin_dato';
  decisionPresentacion: DecisionPresentacion | null;
  decisionSabor: DecisionSabor | null;
  advertencias: Alerta[];
};

export type RecetaMagistralSugerida = {
  pacienteId: string;
  disponible: boolean;
  motivoNoDisponible: string | null;
  fase: string | null;
  objetivos: string[];
  candidatos: CandidatoFormula[];
  gruposCompatibilidad: string[][];
  advertenciasGenerales: Alerta[];
  version: number;
  advertenciaLegal: string;
};

function elegirDosis(principio: PrincipioFarmacotecnico): { dosis: DosisPrincipio | null; fuente: CandidatoFormula['fuenteDosis'] } {
  if (principio.dosisUsual) return { dosis: principio.dosisUsual, fuente: 'usual' };
  if (principio.dosisMinima) return { dosis: principio.dosisMinima, fuente: 'minima' };
  return { dosis: null, fuente: 'sin_dato' };
}

function indexarPorNombreYSinonimos(principios: PrincipioFarmacotecnico[]): Map<string, PrincipioFarmacotecnico> {
  const mapa = new Map<string, PrincipioFarmacotecnico>();
  for (const p of principios) {
    mapa.set(normalizarNombre(p.nombreCanonico), p);
    for (const s of p.sinonimos) mapa.set(normalizarNombre(s), p);
  }
  return mapa;
}

function construirCandidato(sugerencia: SugerenciaPrincipioActivo, porNombre: Map<string, PrincipioFarmacotecnico>, preferencias: PreferenciasPaciente | null, reglas: ReglasFormulacion): CandidatoFormula {
  const principio = porNombre.get(normalizarNombre(sugerencia.nombre)) ?? null;

  if (!principio) {
    return {
      nombre: sugerencia.nombre, objetivo: sugerencia.objetivo, disponibleEnBaseValidada: false,
      principio: null, dosisElegida: null, fuenteDosis: 'sin_dato', decisionPresentacion: null, decisionSabor: null,
      advertencias: [{
        codigo: `sin-validar-${sugerencia.nombre}`,
        descripcion: `"${sugerencia.nombre}" es candidato para el objetivo "${sugerencia.objetivo}" pero no tiene un registro validado en la Base Farmacotécnica todavía: no se puede calcular dosis, presentación ni sabor automáticamente.`,
        fuente: 'base-farmacotecnica',
      }],
    };
  }

  const { dosis, fuente } = elegirDosis(principio);
  const advertencias: Alerta[] = [];

  if (!dosis) {
    advertencias.push({
      codigo: `sin-dosis-${principio.nombreCanonico}`,
      descripcion: `"${principio.nombreCanonico}" está validado pero no tiene dosis usual ni mínima cargada: requiere que el médico defina la dosis manualmente.`,
      fuente: 'dosis',
    });
  }

  const dosisPorTomaMg = mgDesdeDosis(dosis);
  if (dosis && dosisPorTomaMg === null) {
    advertencias.push({
      codigo: `unidad-no-convertible-${principio.nombreCanonico}`,
      descripcion: `La dosis de "${principio.nombreCanonico}" está en ${dosis.unidad.toUpperCase()}: no se puede calcular cápsulas automáticamente, requiere definición manual de presentación.`,
      fuente: 'dosis',
    });
  }

  const decisionPresentacion = decidirPresentacion(principio, dosisPorTomaMg, reglas);
  if (decisionPresentacion.superaLimite) {
    advertencias.push({ codigo: `supera-capsulas-${principio.nombreCanonico}`, descripcion: decisionPresentacion.motivo, fuente: 'presentacion' });
  }

  const decisionSabor = seleccionarSabor(principio, preferencias);
  if (!decisionSabor.sabor) {
    advertencias.push({ codigo: `sin-sabor-${principio.nombreCanonico}`, descripcion: `${principio.nombreCanonico}: ${decisionSabor.motivo}`, fuente: 'sabor' });
  }

  if (dosis && principio.dosisMaxima) {
    const maximaMg = mgDesdeDosis(principio.dosisMaxima);
    if (maximaMg !== null && dosisPorTomaMg !== null && dosisPorTomaMg > maximaMg) {
      advertencias.push({ codigo: `excede-maxima-${principio.nombreCanonico}`, descripcion: `La dosis elegida de "${principio.nombreCanonico}" supera la dosis máxima cargada en la Base Farmacotécnica.`, fuente: 'dosis' });
    }
  }

  return {
    nombre: principio.nombreCanonico, objetivo: sugerencia.objetivo, disponibleEnBaseValidada: true,
    principio, dosisElegida: dosis, fuenteDosis: fuente, decisionPresentacion, decisionSabor, advertencias,
  };
}

function advertenciasDeDuplicadosEIncompatibilidades(candidatos: CandidatoFormula[]): Alerta[] {
  const advertencias: Alerta[] = [];

  const conteo = new Map<string, number>();
  for (const c of candidatos) conteo.set(c.nombre, (conteo.get(c.nombre) ?? 0) + 1);
  for (const [nombre, n] of conteo) {
    if (n > 1) advertencias.push({ codigo: `duplicado-${nombre}`, descripcion: `"${nombre}" aparece más de una vez entre los candidatos.`, fuente: 'duplicacion' });
  }

  const vistos = new Set<string>();
  for (const c of candidatos) {
    if (!c.principio) continue;
    for (const otro of candidatos) {
      if (!otro.principio || otro.nombre === c.nombre) continue;
      if (!c.principio.incompatibilidadesNombres.includes(otro.nombre)) continue;
      const clave = [c.nombre, otro.nombre].sort().join('|');
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      advertencias.push({ codigo: `incompatible-${clave}`, descripcion: `"${c.nombre}" es incompatible con "${otro.nombre}": separar en preparaciones distintas.`, fuente: 'incompatibilidad' });
    }
  }

  return advertencias;
}

/**
 * Orquesta el pipeline completo pedido para "GENERAR FÓRMULA": lee
 * diagnóstico → IPT → fase → objetivos, consulta la Base
 * Farmacotécnica, selecciona principios candidatos por objetivo
 * confirmado, calcula dosis (nunca inventada: usual o mínima
 * cargada, o ninguna), decide presentación, agrupa compatibles,
 * separa incompatibles, selecciona sabor, y devuelve advertencias —
 * todo como una sugerencia de sólo lectura, sin persistir nada.
 *
 * No requiere que el diagnóstico ni el IPT estén confirmados para
 * poder generar la sugerencia (son insumos informativos de contexto,
 * ya usados aguas abajo por fase/objetivos); sí exige que fase y
 * objetivos estén confirmados, igual que ya exige hoy
 * app/api/pacientes/[id]/formulacion/route.ts.
 */
export async function generarFormulaSugerida(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  pacienteId: string,
  reglas: ReglasFormulacion = REGLAS_FORMULACION_DEFECTO
): Promise<RecetaMagistralSugerida> {
  const contexto: ContextoClinicoPaciente = await obtenerContextoClinicoPaciente(supabase, tenantId, pacienteId);

  if (!contexto.objetivos?.confirmado) {
    return {
      pacienteId, disponible: false, motivoNoDisponible: 'Los objetivos terapéuticos todavía no están confirmados.',
      fase: contexto.fase?.faseSeleccionada ?? null, objetivos: [], candidatos: [], gruposCompatibilidad: [],
      advertenciasGenerales: [], version: VERSION_MIF, advertenciaLegal: ADVERTENCIA_MIF,
    };
  }
  if (!contexto.fase?.confirmado) {
    return {
      pacienteId, disponible: false, motivoNoDisponible: 'La fase terapéutica todavía no está confirmada.',
      fase: null, objetivos: contexto.objetivos.objetivos, candidatos: [], gruposCompatibilidad: [],
      advertenciasGenerales: [], version: VERSION_MIF, advertenciaLegal: ADVERTENCIA_MIF,
    };
  }

  const [principiosValidados, preferencias] = await Promise.all([
    listarPrincipiosValidadosCompletos(supabase, tenantId),
    obtenerPreferenciasPaciente(supabase, tenantId, pacienteId),
  ]);

  const porNombre = indexarPorNombreYSinonimos(principiosValidados);
  const sugerencias = sugerirPrincipiosActivos(contexto.objetivos.objetivos);
  const candidatos = sugerencias.map(s => construirCandidato(s, porNombre, preferencias, reglas));

  const gruposCompatibilidad = agruparPorCompatibilidad(
    candidatos.map(c => c.principio).filter((p): p is PrincipioFarmacotecnico => p !== null)
  ).map(grupo => grupo.map(p => p.nombreCanonico));

  const advertenciasGenerales = advertenciasDeDuplicadosEIncompatibilidades(candidatos);

  return {
    pacienteId, disponible: true, motivoNoDisponible: null,
    fase: contexto.fase.faseSeleccionada, objetivos: contexto.objetivos.objetivos,
    candidatos, gruposCompatibilidad, advertenciasGenerales,
    version: VERSION_MIF, advertenciaLegal: ADVERTENCIA_MIF,
  };
}
