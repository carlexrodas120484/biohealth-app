/**
 * Motor de formulación ortomolecular. Organiza y calcula — nunca
 * prescribe ni aprueba. Toda salida de este módulo es una sugerencia
 * para revisión médica; el estado de una fórmula sólo avanza a
 * 'aprobada' por acción explícita del médico
 * (app/api/pacientes/[id]/formulacion/route.ts).
 *
 * Usa el catálogo `catalogo_formulacion` cuando existe una entrada para
 * el principio activo; si no, aplica los valores por defecto de este
 * archivo. No inventa dosis clínicas: la dosis por toma siempre la
 * define el médico (`IngredienteFormula.dosisPorTomaMg`).
 */

export type Sabor = 'neutro' | 'leve' | 'moderado' | 'amargo' | 'muy_amargo';
export type Presentacion = 'capsula' | 'sobre' | 'liquido' | 'comercial';
export type Horario = 'ayunas' | 'desayuno' | 'almuerzo' | 'cena' | 'antes_de_dormir';
export type EstadoFormulacion = 'borrador' | 'sugerida' | 'revisada' | 'aprobada' | 'archivada';

export const HORARIOS: Horario[] = ['ayunas', 'desayuno', 'almuerzo', 'cena', 'antes_de_dormir'];
export const ESTADOS_FORMULACION: EstadoFormulacion[] = ['borrador', 'sugerida', 'revisada', 'aprobada', 'archivada'];

/** Regla 1: capacidad máxima por cápsula cuando el principio no trae su propia capacidad de catálogo. */
export const CAPACIDAD_CAPSULA_MG_DEFECTO = 1000;
/** Regla 3: más de esta cantidad de cápsulas por toma sugiere sobre. */
export const LIMITE_CAPSULAS_ANTES_DE_SOBRE = 2;
/** Amargor (escala 0-5 de catalogo_formulacion) a partir del cual se considera "muy amargo" para la regla 4a. */
export const AMARGOR_QUE_BLOQUEA_SOBRE_AUTOMATICO = 3;

export const VERSION_MOTOR_FORMULACION = 1;

export function clasificarSabor(amargor: number): Sabor {
  if (amargor <= 0) return 'neutro';
  if (amargor === 1) return 'leve';
  if (amargor === 2) return 'moderado';
  if (amargor === 3) return 'amargo';
  return 'muy_amargo';
}

export type InfoCatalogo = {
  nombre: string;
  capacidadCapsulaMg: number;
  amargor: number;
  solubleEnAgua: boolean | null;
  presentacionPreferida: Presentacion | 'individualizar';
  incompatibilidades: string[];
  doseReferenciaMaxMg: number | null;
  limiteSuperiorMg: number | null;
};

export type IngredienteFormula = {
  id: string;
  nombre: string;
  dosisPorTomaMg: number;
  vecesPorDia: number;
  horario: Horario;
  presentacionElegida?: Presentacion;
  bloquearPresentacion?: boolean;
};

/** Regla 2. */
export function calcularCapsulasPorToma(dosisPorTomaMg: number, capacidadCapsulaMg: number): number {
  if (dosisPorTomaMg <= 0 || capacidadCapsulaMg <= 0) return 0;
  return Math.ceil(dosisPorTomaMg / capacidadCapsulaMg);
}

export function calcularDosisDiariaTotalMg(ingrediente: IngredienteFormula): number {
  return ingrediente.dosisPorTomaMg * ingrediente.vecesPorDia;
}

export function calcularCargaTotalMg(ingredientes: IngredienteFormula[]): number {
  return ingredientes.reduce((acc, i) => acc + i.dosisPorTomaMg, 0);
}

/** Regla 8: cantidad total (mg) para preparar, dada una duración en días. */
export function calcularCantidadParaDuracion(ingrediente: IngredienteFormula, duracionDias: number): number {
  return calcularDosisDiariaTotalMg(ingrediente) * duracionDias;
}

/** Regla 11. */
export function detectarDuplicados(ingredientes: IngredienteFormula[]): string[] {
  const conteo = new Map<string, number>();
  for (const i of ingredientes) conteo.set(i.nombre, (conteo.get(i.nombre) ?? 0) + 1);
  return [...conteo.entries()].filter(([, n]) => n > 1).map(([nombre]) => nombre);
}

/** Regla 10. */
export function excedeLimite(ingrediente: IngredienteFormula, catalogo: InfoCatalogo | null): boolean {
  if (!catalogo) return false;
  const dosisDiaria = calcularDosisDiariaTotalMg(ingrediente);
  if (catalogo.limiteSuperiorMg !== null && dosisDiaria > catalogo.limiteSuperiorMg) return true;
  if (catalogo.doseReferenciaMaxMg !== null && dosisDiaria > catalogo.doseReferenciaMaxMg) return true;
  return false;
}

/**
 * Regla 3 y 4: decide cápsula vs. sobre, salvo que alguna condición de
 * la regla 4 bloquee el cambio automático — en ese caso se mantiene en
 * cápsula (o la presentación preferida del catálogo si no es "sobre")
 * y se explican los motivos para que el médico decida.
 */
export function calcularPresentacion(
  ingrediente: IngredienteFormula,
  catalogo: InfoCatalogo | null,
  incompatibleConOtroDeLaPreparacion: boolean
): {
  capsulasPorToma: number;
  presentacionSugerida: Presentacion;
  cambioAutomaticoBloqueado: boolean;
  motivosBloqueo: string[];
} {
  const capacidad = catalogo?.capacidadCapsulaMg ?? CAPACIDAD_CAPSULA_MG_DEFECTO;
  const capsulasPorToma = calcularCapsulasPorToma(ingrediente.dosisPorTomaMg, capacidad);

  const motivosBloqueo: string[] = [];
  if (catalogo && catalogo.amargor >= AMARGOR_QUE_BLOQUEA_SOBRE_AUTOMATICO) {
    motivosBloqueo.push('El principio es muy amargo: no se cambia a sobre automáticamente.');
  }
  if (catalogo?.solubleEnAgua === false) {
    motivosBloqueo.push('Tiene mala solubilidad en agua: no se cambia a sobre automáticamente.');
  }
  if (incompatibleConOtroDeLaPreparacion) {
    motivosBloqueo.push('Es incompatible con otro componente de esta preparación.');
  }
  if (catalogo?.presentacionPreferida === 'comercial') {
    motivosBloqueo.push('Requiere protección especial (producto comercial preferido).');
  }
  if (ingrediente.bloquearPresentacion) {
    motivosBloqueo.push('El médico bloqueó el cambio de presentación para este principio.');
  }

  const cambioAutomaticoBloqueado = motivosBloqueo.length > 0;

  let presentacionSugerida: Presentacion;
  if (ingrediente.presentacionElegida) {
    presentacionSugerida = ingrediente.presentacionElegida;
  } else if (cambioAutomaticoBloqueado) {
    presentacionSugerida =
      catalogo?.presentacionPreferida && catalogo.presentacionPreferida !== 'individualizar'
        ? (catalogo.presentacionPreferida as Presentacion)
        : 'capsula';
  } else {
    presentacionSugerida = capsulasPorToma > LIMITE_CAPSULAS_ANTES_DE_SOBRE ? 'sobre' : 'capsula';
  }

  return { capsulasPorToma, presentacionSugerida, cambioAutomaticoBloqueado, motivosBloqueo };
}

/** Regla 6. */
export function agruparPorHorario(ingredientes: IngredienteFormula[]): Record<Horario, IngredienteFormula[]> {
  const grupos = Object.fromEntries(HORARIOS.map(h => [h, [] as IngredienteFormula[]])) as Record<Horario, IngredienteFormula[]>;
  for (const ing of ingredientes) grupos[ing.horario].push(ing);
  return grupos;
}

/**
 * Regla 5: separa en sub-preparaciones para que ningún par de
 * ingredientes mutuamente listados como incompatibles en el catálogo
 * termine en la misma preparación. Empaquetado voraz, determinista
 * según el orden de entrada.
 */
export function separarIncompatibles(
  ingredientes: IngredienteFormula[],
  catalogoPorNombre: Map<string, InfoCatalogo>
): IngredienteFormula[][] {
  const grupos: IngredienteFormula[][] = [];
  for (const ing of ingredientes) {
    const incompatibilidades = catalogoPorNombre.get(ing.nombre)?.incompatibilidades ?? [];
    let colocado = false;
    for (const grupo of grupos) {
      const choca = grupo.some(otro => {
        const incompOtro = catalogoPorNombre.get(otro.nombre)?.incompatibilidades ?? [];
        return incompatibilidades.includes(otro.nombre) || incompOtro.includes(ing.nombre);
      });
      if (!choca) {
        grupo.push(ing);
        colocado = true;
        break;
      }
    }
    if (!colocado) grupos.push([ing]);
  }
  return grupos;
}

export type IngredienteCalculado = IngredienteFormula & {
  capsulasPorToma: number;
  presentacionSugerida: Presentacion;
  cambioAutomaticoBloqueado: boolean;
  motivosBloqueoPresentacion: string[];
  dosisDiariaTotalMg: number;
  sabor: Sabor;
};

export type PreparacionCalculada = {
  horario: Horario;
  ingredientes: IngredienteCalculado[];
  cargaTotalMg: number;
  requiereEnmascararSabor: boolean;
};

/** Aplica las reglas 1-6, 9 y 12 y arma las preparaciones agrupadas por horario. */
export function construirPreparaciones(
  ingredientes: IngredienteFormula[],
  catalogoPorNombre: Map<string, InfoCatalogo>
): PreparacionCalculada[] {
  const porHorario = agruparPorHorario(ingredientes);
  const preparaciones: PreparacionCalculada[] = [];

  for (const horario of HORARIOS) {
    const delHorario = porHorario[horario];
    if (delHorario.length === 0) continue;

    for (const subgrupo of separarIncompatibles(delHorario, catalogoPorNombre)) {
      const ingredientesCalculados: IngredienteCalculado[] = subgrupo.map(ing => {
        const catalogo = catalogoPorNombre.get(ing.nombre) ?? null;
        const incompatibleConOtro = subgrupo.some(
          otro => otro.nombre !== ing.nombre && (catalogo?.incompatibilidades.includes(otro.nombre) ?? false)
        );
        const { capsulasPorToma, presentacionSugerida, cambioAutomaticoBloqueado, motivosBloqueo } =
          calcularPresentacion(ing, catalogo, incompatibleConOtro);
        return {
          ...ing,
          capsulasPorToma,
          presentacionSugerida,
          cambioAutomaticoBloqueado,
          motivosBloqueoPresentacion: motivosBloqueo,
          dosisDiariaTotalMg: calcularDosisDiariaTotalMg(ing),
          sabor: clasificarSabor(catalogo?.amargor ?? 0),
        };
      });

      preparaciones.push({
        horario,
        ingredientes: ingredientesCalculados,
        cargaTotalMg: calcularCargaTotalMg(subgrupo),
        requiereEnmascararSabor: ingredientesCalculados.some(i => i.sabor === 'amargo' || i.sabor === 'muy_amargo'),
      });
    }
  }

  return preparaciones;
}

export type Alerta = { codigo: string; descripcion: string; fuente: string };

export type PacienteContextoFormulacion = {
  alergias: string | null;
  medicamentosActuales: string | null;
  antecedentesPersonales: string | null;
  antecedentesFamiliares: string | null;
};

const PALABRAS_ANTICOAGULANTES = ['warfarina', 'acenocumarol', 'heparina', 'rivaroxaban', 'apixaban', 'dabigatran', 'aspirina', 'clopidogrel'];
const PALABRAS_ANTIHIPERTENSIVOS = ['losartan', 'enalapril', 'amlodipina', 'valsartan', 'atenolol', 'captopril', 'hidroclorotiazida', 'lisinopril'];
const PALABRAS_HIPOGLUCEMIANTES = ['metformina', 'insulina', 'glibenclamida', 'glimepirida', 'sitagliptina', 'empagliflozina'];
const PALABRAS_HEPATOPATIA = ['hepatitis', 'cirrosis', 'higado graso', 'hepatopatia', 'esteatosis hepatica'];
const PALABRAS_NEFROPATIA = ['insuficiencia renal', 'nefropatia', 'dialisis', 'enfermedad renal cronica'];
const PALABRAS_ONCOLOGICO = ['cancer', 'oncologico', 'quimioterapia', 'neoplasia', 'tumor'];

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function contieneAlguna(texto: string | null, palabras: string[]): boolean {
  if (!texto) return false;
  const t = normalizar(texto);
  return palabras.some(p => t.includes(normalizar(p)));
}

/**
 * Alertas informativas para revisión médica — nunca bloquean nada
 * automáticamente salvo que ya exista una regla estructurada explícita
 * (por eso duplicación, dosis elevada e incompatibilidad se calculan de
 * datos ya estructurados del catálogo/fórmula). Alergias, medicación y
 * antecedentes se muestran siempre íntegros; las coincidencias por
 * palabra clave son heurísticas de apoyo, no un diagnóstico.
 */
export function generarAlertas(entrada: {
  ingredientes: IngredienteFormula[];
  catalogoPorNombre: Map<string, InfoCatalogo>;
  paciente: PacienteContextoFormulacion;
}): Alerta[] {
  const alertas: Alerta[] = [];
  const { paciente, ingredientes, catalogoPorNombre } = entrada;

  if (paciente.alergias) {
    alertas.push({ codigo: 'alergias', descripcion: `Alergias registradas: ${paciente.alergias}`, fuente: 'alergias' });
  }
  if (paciente.medicamentosActuales) {
    alertas.push({ codigo: 'medicacion-actual', descripcion: `Medicación actual: ${paciente.medicamentosActuales}`, fuente: 'medicacion' });
    if (contieneAlguna(paciente.medicamentosActuales, PALABRAS_ANTICOAGULANTES)) {
      alertas.push({ codigo: 'anticoagulantes', descripcion: 'Medicación anticoagulante/antiagregante registrada: revisar interacción antes de formular.', fuente: 'medicacion' });
    }
    if (contieneAlguna(paciente.medicamentosActuales, PALABRAS_ANTIHIPERTENSIVOS)) {
      alertas.push({ codigo: 'antihipertensivos', descripcion: 'Medicación antihipertensiva registrada: revisar interacción antes de formular.', fuente: 'medicacion' });
    }
    if (contieneAlguna(paciente.medicamentosActuales, PALABRAS_HIPOGLUCEMIANTES)) {
      alertas.push({ codigo: 'hipoglucemiantes', descripcion: 'Medicación hipoglucemiante registrada: revisar interacción antes de formular.', fuente: 'medicacion' });
    }
  }

  const antecedentes = [paciente.antecedentesPersonales, paciente.antecedentesFamiliares].filter(Boolean).join(' ');
  if (contieneAlguna(antecedentes, PALABRAS_HEPATOPATIA)) {
    alertas.push({ codigo: 'hepatopatia', descripcion: 'Antecedentes compatibles con hepatopatía: ajustar dosis y revisar metabolismo hepático.', fuente: 'antecedentes' });
  }
  if (contieneAlguna(antecedentes, PALABRAS_NEFROPATIA)) {
    alertas.push({ codigo: 'nefropatia', descripcion: 'Antecedentes compatibles con nefropatía: ajustar dosis y revisar eliminación renal.', fuente: 'antecedentes' });
  }
  if (contieneAlguna(antecedentes, PALABRAS_ONCOLOGICO)) {
    alertas.push({ codigo: 'oncologico', descripcion: 'Antecedentes oncológicos registrados: revisar cada principio con el equipo tratante.', fuente: 'antecedentes' });
  }

  for (const nombre of detectarDuplicados(ingredientes)) {
    alertas.push({ codigo: `duplicado-${nombre}`, descripcion: `"${nombre}" aparece más de una vez en la fórmula.`, fuente: 'duplicacion' });
  }

  for (const ing of ingredientes) {
    if (excedeLimite(ing, catalogoPorNombre.get(ing.nombre) ?? null)) {
      alertas.push({ codigo: `dosis-elevada-${ing.nombre}`, descripcion: `La dosis diaria de "${ing.nombre}" supera el límite de referencia configurado.`, fuente: 'dosis' });
    }
  }

  const vistos = new Set<string>();
  for (const ing of ingredientes) {
    const incompatibilidades = catalogoPorNombre.get(ing.nombre)?.incompatibilidades ?? [];
    for (const otro of ingredientes) {
      if (otro.nombre === ing.nombre || !incompatibilidades.includes(otro.nombre)) continue;
      const clave = [ing.nombre, otro.nombre].sort().join('|');
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      alertas.push({ codigo: `incompatible-${clave}`, descripcion: `"${ing.nombre}" es incompatible con "${otro.nombre}": separar en preparaciones distintas.`, fuente: 'incompatibilidad' });
    }
  }

  return alertas;
}

/**
 * Sugerencias de principios activos por objetivo terapéutico confirmado
 * (`objetivos_terapeuticos.objetivos`). Vivía duplicada dentro de la
 * ruta de formulación; se centraliza acá para que el motor de IA
 * clínica (lib/clinica/motorIA.ts) pueda ofrecer las mismas
 * recomendaciones ortomoleculares sin mantener dos copias.
 */
export type SugerenciaPrincipioActivo = {
  id: string; nombre: string; objetivo: string; precaucion: string; evidencia: 'B' | 'C' | 'D'; fuente: string;
};

export const SUGERENCIAS_POR_OBJETIVO: Record<string, SugerenciaPrincipioActivo[]> = {
  'Reparar mucosa intestinal': [
    { id: 'l-glutamina', nombre: 'L-glutamina', objetivo: 'Reparar mucosa intestinal', precaucion: 'Individualizar en enfermedad hepática, renal o contexto oncológico.', evidencia: 'C', fuente: 'Material docente aportado' },
    { id: 'zinc-carnosina', nombre: 'Zinc-L-carnosina', objetivo: 'Reparar mucosa intestinal', precaucion: 'Considerar aporte total de zinc y uso prolongado.', evidencia: 'C', fuente: 'Material docente aportado' },
  ],
  'Disminuir inflamación': [
    { id: 'omega-3', nombre: 'Omega-3 (EPA + DHA)', objetivo: 'Disminuir inflamación', precaucion: 'Revisar anticoagulantes, antiagregantes y riesgo hemorrágico.', evidencia: 'B', fuente: 'Manual profesional; validar indicación' },
    { id: 'curcumina', nombre: 'Curcumina', objetivo: 'Disminuir inflamación', precaucion: 'Revisar anticoagulación, patología biliar e interacciones.', evidencia: 'C', fuente: 'Material docente aportado' },
  ],
  'Mejorar microbiota': [
    { id: 'probiotico', nombre: 'Probiótico con cepa identificada', objetivo: 'Mejorar microbiota', precaucion: 'Seleccionar cepa según indicación; cautela en inmunosupresión grave.', evidencia: 'C', fuente: 'Material docente aportado' },
    { id: 's-boulardii', nombre: 'Saccharomyces boulardii', objetivo: 'Mejorar microbiota', precaucion: 'Evitar en pacientes críticos, inmunosupresión grave o con catéter venoso central.', evidencia: 'C', fuente: 'Material docente aportado' },
  ],
  'Optimizar digestión enzimática': [
    { id: 'enzimas-digestivas', nombre: 'Complejo de enzimas digestivas', objetivo: 'Optimizar digestión enzimática', precaucion: 'Definir composición según clínica; no sustituye evaluación pancreática o biliar.', evidencia: 'D', fuente: 'Resumen de fórmula aportado' },
  ],
  'Restaurar pH gástrico': [
    { id: 'betaina-hcl', nombre: 'Betaína HCl', objetivo: 'Restaurar pH gástrico', precaucion: 'No usar sin evaluar gastritis, úlcera, reflujo y medicación gastroprotectora.', evidencia: 'D', fuente: 'Formulario aportado' },
  ],
};

/** Aplana las sugerencias de todos los objetivos confirmados, sin duplicar por objetivo repetido. */
export function sugerirPrincipiosActivos(objetivos: string[]): SugerenciaPrincipioActivo[] {
  return objetivos.flatMap(o => SUGERENCIAS_POR_OBJETIVO[o] ?? []);
}
