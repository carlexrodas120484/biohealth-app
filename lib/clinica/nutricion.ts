/**
 * Motor de nutrición clínica inteligente. Calcula y organiza — nunca
 * genera un plan definitivo por sí solo. Toda salida es una sugerencia
 * de partida para que el profesional revise, edite y apruebe
 * (app/api/pacientes/[id]/nutricion/route.ts).
 *
 * Fórmulas usadas, todas estándar y documentadas (no inventadas):
 *  - GEB: Mifflin-St Jeor (1990), la fórmula vigente recomendada por la
 *    Academy of Nutrition and Dietetics para adultos.
 *  - GET: GEB × factor de actividad (tabla FAO/OMS/UNU de uso habitual).
 *  - Fibra: ~14g por cada 1000 kcal (Institute of Medicine).
 *  - Agua: ~35ml por kg de peso corporal (regla clínica habitual).
 * El profesional puede sobrescribir cualquier valor calculado.
 */

export type Sexo = 'femenino' | 'masculino';
export type NivelActividad = 'sedentario' | 'ligero' | 'moderado' | 'intenso' | 'muy_intenso';
export type Horario = 'desayuno' | 'media_manana' | 'almuerzo' | 'media_tarde' | 'cena' | 'antes_de_dormir';
export type EstadoPlanNutricional = 'borrador' | 'sugerido' | 'revisado' | 'aprobado' | 'archivado';

export const NIVELES_ACTIVIDAD: NivelActividad[] = ['sedentario', 'ligero', 'moderado', 'intenso', 'muy_intenso'];
export const HORARIOS_COMIDA: Horario[] = ['desayuno', 'media_manana', 'almuerzo', 'media_tarde', 'cena', 'antes_de_dormir'];
export const ESTADOS_PLAN_NUTRICIONAL: EstadoPlanNutricional[] = ['borrador', 'sugerido', 'revisado', 'aprobado', 'archivado'];
export const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;

export const VERSION_MOTOR_NUTRICION = 1;

export const ADVERTENCIA_NUTRICION =
  'Asistente de nutrición clínica: organiza y calcula a partir de datos ya registrados. No reemplaza la evaluación de un profesional ni constituye un tratamiento definitivo.';

export type ObjetivoClinico =
  | 'perdida-grasa' | 'mantenimiento' | 'ganancia-masa-muscular' | 'resistencia-insulina'
  | 'diabetes-tipo-2' | 'hipertension' | 'higado-graso' | 'hipertrigliceridemia'
  | 'sindrome-metabolico' | 'estrenimiento' | 'colon-irritable' | 'reflujo'
  | 'menopausia' | 'soporte-oncologico' | 'recuperacion-nutricional' | 'plan-antiinflamatorio';

type PlantillaObjetivo = { codigo: ObjetivoClinico; nombre: string; priorizarDefecto: string; evitarDefecto: string };

export const OBJETIVOS_CLINICOS: PlantillaObjetivo[] = [
  { codigo: 'perdida-grasa', nombre: 'Pérdida de grasa', priorizarDefecto: 'Proteína magra, vegetales, fibra, hidratación adecuada.', evitarDefecto: 'Azúcares simples, ultraprocesados, bebidas azucaradas.' },
  { codigo: 'mantenimiento', nombre: 'Mantenimiento', priorizarDefecto: 'Alimentación variada y equilibrada según hábitos actuales.', evitarDefecto: 'Excesos puntuales sostenidos en el tiempo.' },
  { codigo: 'ganancia-masa-muscular', nombre: 'Ganancia de masa muscular', priorizarDefecto: 'Proteína distribuida en todas las comidas, carbohidratos alrededor del entrenamiento.', evitarDefecto: 'Déficit calórico sostenido, alcohol frecuente.' },
  { codigo: 'resistencia-insulina', nombre: 'Resistencia a la insulina', priorizarDefecto: 'Carbohidratos de bajo índice glucémico, fibra, proteína en cada comida.', evitarDefecto: 'Azúcares simples y harinas refinadas.' },
  { codigo: 'diabetes-tipo-2', nombre: 'Diabetes tipo 2', priorizarDefecto: 'Carbohidratos complejos distribuidos, control de porciones, fibra.', evitarDefecto: 'Azúcares simples, jugos, bebidas azucaradas.' },
  { codigo: 'hipertension', nombre: 'Hipertensión', priorizarDefecto: 'Frutas, verduras, potasio, preparaciones caseras.', evitarDefecto: 'Sodio agregado, embutidos, caldos concentrados.' },
  { codigo: 'higado-graso', nombre: 'Hígado graso', priorizarDefecto: 'Fibra, grasas insaturadas, control de porciones.', evitarDefecto: 'Azúcares simples, frituras, alcohol.' },
  { codigo: 'hipertrigliceridemia', nombre: 'Hipertrigliceridemia', priorizarDefecto: 'Omega-3, fibra soluble, grasas insaturadas.', evitarDefecto: 'Azúcares simples, alcohol, grasas saturadas en exceso.' },
  { codigo: 'sindrome-metabolico', nombre: 'Síndrome metabólico', priorizarDefecto: 'Fibra, proteína magra, actividad física regular.', evitarDefecto: 'Ultraprocesados, azúcares simples, sedentarismo.' },
  { codigo: 'estrenimiento', nombre: 'Estreñimiento', priorizarDefecto: 'Fibra, hidratación, actividad física.', evitarDefecto: 'Baja ingesta de líquidos y fibra.' },
  { codigo: 'colon-irritable', nombre: 'Colon irritable', priorizarDefecto: 'Identificar tolerancia individual; considerar un patrón bajo en FODMAP con guía profesional.', evitarDefecto: 'Alimentos que el paciente ya identificó como desencadenantes.' },
  { codigo: 'reflujo', nombre: 'Reflujo', priorizarDefecto: 'Comidas más pequeñas y frecuentes; evitar acostarse inmediatamente después de comer.', evitarDefecto: 'Café, alcohol, picante, comidas copiosas antes de dormir.' },
  { codigo: 'menopausia', nombre: 'Menopausia', priorizarDefecto: 'Calcio, vitamina D, proteína, fitoestrógenos si tolera.', evitarDefecto: 'Excesos de cafeína y alcohol.' },
  { codigo: 'soporte-oncologico', nombre: 'Soporte oncológico', priorizarDefecto: 'Densidad nutricional y proteica; coordinar siempre con el equipo oncológico tratante.', evitarDefecto: 'Restricciones no indicadas por el equipo tratante.' },
  { codigo: 'recuperacion-nutricional', nombre: 'Recuperación nutricional', priorizarDefecto: 'Densidad calórica y proteica progresiva.', evitarDefecto: 'Restricciones no justificadas mientras dure la recuperación.' },
  { codigo: 'plan-antiinflamatorio', nombre: 'Plan antiinflamatorio', priorizarDefecto: 'Omega-3, frutas y verduras variadas, especias antiinflamatorias.', evitarDefecto: 'Ultraprocesados, azúcares simples, grasas trans.' },
];

export const CODIGOS_OBJETIVOS_CLINICOS = OBJETIVOS_CLINICOS.map(o => o.codigo);

const ADVERTENCIA_POR_OBJETIVO: Partial<Record<ObjetivoClinico, string>> = {
  'diabetes-tipo-2': 'Plan orientado a diabetes tipo 2: requiere control glicémico y seguimiento médico regular.',
  hipertension: 'Plan orientado a hipertensión: requiere control de presión arterial y seguimiento médico regular.',
  'higado-graso': 'Plan orientado a hígado graso: requiere seguimiento con función hepática.',
  'soporte-oncologico': 'Soporte oncológico: coordinar siempre con el equipo oncológico tratante.',
};

// ---- Cálculos ----

export function calcularIMC(pesoKg: number, tallaCm: number): number {
  const tallaM = tallaCm / 100;
  return Math.round((pesoKg / (tallaM * tallaM)) * 10) / 10;
}

export function clasificarIMC(imc: number): 'bajo_peso' | 'normal' | 'sobrepeso' | 'obesidad' {
  if (imc < 18.5) return 'bajo_peso';
  if (imc < 25) return 'normal';
  if (imc < 30) return 'sobrepeso';
  return 'obesidad';
}

/** GEB — Mifflin-St Jeor (1990). */
export function calcularGEB(pesoKg: number, tallaCm: number, edadAnios: number, sexo: Sexo): number {
  const base = 10 * pesoKg + 6.25 * tallaCm - 5 * edadAnios;
  return Math.round(sexo === 'masculino' ? base + 5 : base - 161);
}

const FACTOR_ACTIVIDAD: Record<NivelActividad, number> = {
  sedentario: 1.2, ligero: 1.375, moderado: 1.55, intenso: 1.725, muy_intenso: 1.9,
};

export function calcularGET(geb: number, nivelActividad: NivelActividad): number {
  return Math.round(geb * FACTOR_ACTIVIDAD[nivelActividad]);
}

const AJUSTE_CALORICO_POR_OBJETIVO: Partial<Record<ObjetivoClinico, number>> = {
  'perdida-grasa': -500,
  'ganancia-masa-muscular': 300,
};

/** Nunca por debajo del GEB: piso de seguridad ante cualquier objetivo. */
export function calcularObjetivoCalorico(get: number, geb: number, objetivo: ObjetivoClinico): number {
  const ajuste = AJUSTE_CALORICO_POR_OBJETIVO[objetivo] ?? 0;
  return Math.max(geb, Math.round(get + ajuste));
}

type DistribucionMacros = { proteinaPct: number; carbohidratosPct: number; grasasPct: number };

const DISTRIBUCION_MACROS_POR_OBJETIVO: Record<ObjetivoClinico, DistribucionMacros> = {
  'perdida-grasa': { proteinaPct: 35, carbohidratosPct: 35, grasasPct: 30 },
  mantenimiento: { proteinaPct: 30, carbohidratosPct: 40, grasasPct: 30 },
  'ganancia-masa-muscular': { proteinaPct: 30, carbohidratosPct: 45, grasasPct: 25 },
  'resistencia-insulina': { proteinaPct: 30, carbohidratosPct: 35, grasasPct: 35 },
  'diabetes-tipo-2': { proteinaPct: 30, carbohidratosPct: 35, grasasPct: 35 },
  hipertension: { proteinaPct: 25, carbohidratosPct: 45, grasasPct: 30 },
  'higado-graso': { proteinaPct: 25, carbohidratosPct: 40, grasasPct: 35 },
  hipertrigliceridemia: { proteinaPct: 25, carbohidratosPct: 40, grasasPct: 35 },
  'sindrome-metabolico': { proteinaPct: 30, carbohidratosPct: 35, grasasPct: 35 },
  estrenimiento: { proteinaPct: 20, carbohidratosPct: 50, grasasPct: 30 },
  'colon-irritable': { proteinaPct: 25, carbohidratosPct: 45, grasasPct: 30 },
  reflujo: { proteinaPct: 25, carbohidratosPct: 45, grasasPct: 30 },
  menopausia: { proteinaPct: 25, carbohidratosPct: 45, grasasPct: 30 },
  'soporte-oncologico': { proteinaPct: 25, carbohidratosPct: 45, grasasPct: 30 },
  'recuperacion-nutricional': { proteinaPct: 25, carbohidratosPct: 45, grasasPct: 30 },
  'plan-antiinflamatorio': { proteinaPct: 20, carbohidratosPct: 45, grasasPct: 35 },
};

export function calcularMacros(calorias: number, objetivo: ObjetivoClinico): { proteinaG: number; carbohidratosG: number; grasasG: number } {
  const d = DISTRIBUCION_MACROS_POR_OBJETIVO[objetivo];
  return {
    proteinaG: Math.round((calorias * d.proteinaPct) / 100 / 4),
    carbohidratosG: Math.round((calorias * d.carbohidratosPct) / 100 / 4),
    grasasG: Math.round((calorias * d.grasasPct) / 100 / 9),
  };
}

/** IOM: ~14g de fibra por cada 1000 kcal. */
export function calcularFibraG(calorias: number): number {
  return Math.round((calorias / 1000) * 14);
}

/** Regla clínica habitual: ~35ml de agua por kg de peso corporal. */
export function calcularAguaMl(pesoKg: number): number {
  return Math.round(pesoKg * 35);
}

const ORDEN_PRIORIDAD_HORARIOS: Horario[] = ['desayuno', 'almuerzo', 'cena', 'media_manana', 'media_tarde', 'antes_de_dormir'];

export function distribuirHorarios(numeroComidas: number): Horario[] {
  const n = Math.min(Math.max(Math.round(numeroComidas), 1), ORDEN_PRIORIDAD_HORARIOS.length);
  return ORDEN_PRIORIDAD_HORARIOS.slice(0, n);
}

export type ComidaMenu = { horario: Horario; descripcion: string; alternativas: string[] };

export function estructuraMenuVacio(horarios: Horario[]): ComidaMenu[] {
  return horarios.map(horario => ({ horario, descripcion: '', alternativas: [] }));
}

export function estructuraMenuSemanalVacio(horarios: Horario[]): Record<string, ComidaMenu[]> {
  return Object.fromEntries(DIAS_SEMANA.map(dia => [dia, estructuraMenuVacio(horarios)]));
}

export function sugerirListaCompras(alimentosRecomendados: string[]): string[] {
  return [...new Set(alimentosRecomendados.map(a => a.trim()).filter(Boolean))];
}

// ---- Catálogo de alimentos locales (Paraguay) ----

export type CategoriaAlimento = 'carbohidrato' | 'proteina' | 'grasa' | 'lacteo' | 'fruta' | 'verdura' | 'bebida' | 'preparacion_tradicional';

export type Alimento = {
  codigo: string;
  nombre: string;
  categoria: CategoriaAlimento;
  altoIndiceGlucemico?: boolean;
  altoEnSodio?: boolean;
  contieneCafeina?: boolean;
  contieneGluten?: boolean;
  contieneLactosa?: boolean;
  alergenoComun?: boolean;
  altoEnFibra?: boolean;
  aptoVegetariano: boolean;
  aptoVegano: boolean;
};

/** No se marcan como prohibidos: sólo se etiquetan con atributos estructurados que alimentan advertencias contextuales. */
export const ALIMENTOS_LOCALES: Alimento[] = [
  { codigo: 'mandioca', nombre: 'Mandioca', categoria: 'carbohidrato', altoIndiceGlucemico: true, aptoVegetariano: true, aptoVegano: true },
  { codigo: 'batata', nombre: 'Batata', categoria: 'carbohidrato', altoIndiceGlucemico: true, aptoVegetariano: true, aptoVegano: true },
  { codigo: 'maiz', nombre: 'Maíz', categoria: 'carbohidrato', altoIndiceGlucemico: true, aptoVegetariano: true, aptoVegano: true },
  { codigo: 'arroz', nombre: 'Arroz', categoria: 'carbohidrato', altoIndiceGlucemico: true, aptoVegetariano: true, aptoVegano: true },
  { codigo: 'poroto', nombre: 'Poroto', categoria: 'proteina', altoEnFibra: true, aptoVegetariano: true, aptoVegano: true },
  { codigo: 'carne-vacuna', nombre: 'Carne vacuna', categoria: 'proteina', aptoVegetariano: false, aptoVegano: false },
  { codigo: 'pollo', nombre: 'Pollo', categoria: 'proteina', aptoVegetariano: false, aptoVegano: false },
  { codigo: 'pescado', nombre: 'Pescado', categoria: 'proteina', aptoVegetariano: false, aptoVegano: false },
  { codigo: 'huevo', nombre: 'Huevo', categoria: 'proteina', alergenoComun: true, aptoVegetariano: true, aptoVegano: false },
  { codigo: 'leche-derivados', nombre: 'Leche y derivados', categoria: 'lacteo', contieneLactosa: true, alergenoComun: true, aptoVegetariano: true, aptoVegano: false },
  { codigo: 'frutas-locales', nombre: 'Frutas locales', categoria: 'fruta', aptoVegetariano: true, aptoVegano: true },
  { codigo: 'verduras-locales', nombre: 'Verduras locales', categoria: 'verdura', altoEnFibra: true, aptoVegetariano: true, aptoVegano: true },
  { codigo: 'avena', nombre: 'Avena', categoria: 'carbohidrato', altoEnFibra: true, contieneGluten: true, aptoVegetariano: true, aptoVegano: true },
  { codigo: 'mani', nombre: 'Maní', categoria: 'grasa', alergenoComun: true, aptoVegetariano: true, aptoVegano: true },
  { codigo: 'chia', nombre: 'Chía', categoria: 'grasa', altoEnFibra: true, aptoVegetariano: true, aptoVegano: true },
  { codigo: 'yerba-mate', nombre: 'Yerba mate', categoria: 'bebida', contieneCafeina: true, aptoVegetariano: true, aptoVegano: true },
  { codigo: 'cocido', nombre: 'Cocido', categoria: 'bebida', contieneCafeina: true, aptoVegetariano: true, aptoVegano: true },
  { codigo: 'sopa-paraguaya', nombre: 'Sopa paraguaya', categoria: 'preparacion_tradicional', altoEnSodio: true, contieneLactosa: true, aptoVegetariano: true, aptoVegano: false },
  { codigo: 'chipa', nombre: 'Chipa', categoria: 'preparacion_tradicional', altoIndiceGlucemico: true, contieneLactosa: true, aptoVegetariano: true, aptoVegano: false },
  { codigo: 'mbeju', nombre: 'Mbejú', categoria: 'preparacion_tradicional', altoIndiceGlucemico: true, contieneLactosa: true, aptoVegetariano: true, aptoVegano: false },
];

export type Advertencia = { codigo: string; descripcion: string; fuente: string };

const OBJETIVOS_SENSIBLES_GLUCEMIA: ObjetivoClinico[] = ['resistencia-insulina', 'diabetes-tipo-2', 'sindrome-metabolico', 'higado-graso'];
const OBJETIVOS_SENSIBLES_SODIO: ObjetivoClinico[] = ['hipertension'];
const OBJETIVOS_SENSIBLES_CAFEINA: ObjetivoClinico[] = ['reflujo', 'menopausia'];

/** Advertencias contextuales por alimento — nunca prohíben, sólo informan. */
export function advertenciasPorAlimentoYObjetivo(objetivo: ObjetivoClinico, catalogo: Alimento[] = ALIMENTOS_LOCALES): Advertencia[] {
  const advertencias: Advertencia[] = [];
  for (const a of catalogo) {
    if (a.altoIndiceGlucemico && OBJETIVOS_SENSIBLES_GLUCEMIA.includes(objetivo)) {
      advertencias.push({ codigo: `glucemia-${a.codigo}`, descripcion: `${a.nombre} tiene índice glucémico alto: ajustar porción según tolerancia.`, fuente: 'alimento' });
    }
    if (a.altoEnSodio && OBJETIVOS_SENSIBLES_SODIO.includes(objetivo)) {
      advertencias.push({ codigo: `sodio-${a.codigo}`, descripcion: `${a.nombre} es alto en sodio: moderar frecuencia y porción.`, fuente: 'alimento' });
    }
    if (a.contieneCafeina && OBJETIVOS_SENSIBLES_CAFEINA.includes(objetivo)) {
      advertencias.push({ codigo: `cafeina-${a.codigo}`, descripcion: `${a.nombre} contiene cafeína: evaluar tolerancia individual.`, fuente: 'alimento' });
    }
  }
  return advertencias;
}

// ---- Restricciones declaradas (estructuradas, no inferidas de texto libre) ----

export type RestriccionesDeclaradas = {
  alergiasAlimentarias: string[];
  celiaquia: boolean;
  vegetarianismo: boolean;
  veganismo: boolean;
};

export function alimentosNoRecomendados(
  restricciones: RestriccionesDeclaradas,
  catalogo: Alimento[] = ALIMENTOS_LOCALES
): Array<{ alimento: string; motivo: string }> {
  const resultado: Array<{ alimento: string; motivo: string }> = [];
  const alergiasNormalizadas = restricciones.alergiasAlimentarias.map(a => a.trim().toLowerCase());
  for (const a of catalogo) {
    if (restricciones.celiaquia && a.contieneGluten) resultado.push({ alimento: a.nombre, motivo: 'Contiene gluten (celiaquía declarada).' });
    if (restricciones.vegetarianismo && !a.aptoVegetariano) resultado.push({ alimento: a.nombre, motivo: 'No es apto para vegetarianismo declarado.' });
    if (restricciones.veganismo && !a.aptoVegano) resultado.push({ alimento: a.nombre, motivo: 'No es apto para veganismo declarado.' });
    if (alergiasNormalizadas.includes(a.codigo) || alergiasNormalizadas.includes(a.nombre.toLowerCase())) {
      resultado.push({ alimento: a.nombre, motivo: 'Alergia alimentaria declarada.' });
    }
  }
  return resultado;
}

// ---- Advertencias clínicas (medicación, antecedentes) ----

export type PacienteContextoNutricion = {
  alergias: string | null;
  medicamentosActuales: string | null;
  antecedentesPersonales: string | null;
  antecedentesFamiliares: string | null;
};

const PALABRAS_ANTICOAGULANTES = ['warfarina', 'acenocumarol', 'heparina', 'rivaroxaban', 'apixaban', 'dabigatran', 'aspirina', 'clopidogrel'];
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

export function generarAdvertenciasClinicas(paciente: PacienteContextoNutricion): Advertencia[] {
  const advertencias: Advertencia[] = [];
  if (paciente.alergias) {
    advertencias.push({ codigo: 'alergias', descripcion: `Alergias registradas: ${paciente.alergias}`, fuente: 'alergias' });
  }
  if (paciente.medicamentosActuales) {
    advertencias.push({ codigo: 'medicacion-actual', descripcion: `Medicación actual: ${paciente.medicamentosActuales}`, fuente: 'medicacion' });
    if (contieneAlguna(paciente.medicamentosActuales, PALABRAS_ANTICOAGULANTES)) {
      advertencias.push({ codigo: 'anticoagulantes', descripcion: 'Medicación anticoagulante/antiagregante registrada: coordinar cambios de vitamina K y fibra con el médico.', fuente: 'medicacion' });
    }
  }
  const antecedentes = [paciente.antecedentesPersonales, paciente.antecedentesFamiliares].filter(Boolean).join(' ');
  if (contieneAlguna(antecedentes, PALABRAS_HEPATOPATIA)) {
    advertencias.push({ codigo: 'hepatopatia', descripcion: 'Antecedentes compatibles con hepatopatía: ajustar proteína y grasas con seguimiento profesional.', fuente: 'antecedentes' });
  }
  if (contieneAlguna(antecedentes, PALABRAS_NEFROPATIA)) {
    advertencias.push({ codigo: 'nefropatia', descripcion: 'Antecedentes compatibles con nefropatía: ajustar proteína, sodio y potasio con seguimiento profesional.', fuente: 'antecedentes' });
  }
  if (contieneAlguna(antecedentes, PALABRAS_ONCOLOGICO)) {
    advertencias.push({ codigo: 'oncologico', descripcion: 'Antecedentes oncológicos registrados: coordinar el plan con el equipo tratante.', fuente: 'antecedentes' });
  }
  return advertencias;
}

// ---- Integración con Formulación (sólo lectura: nunca modifica la formulación) ----

/** Coincidencia exacta (no difusa) entre lo recomendado en nutrición y los ingredientes ya aprobados en la formulación. */
export function advertenciasIntegracionFormulacion(alimentosRecomendados: string[], ingredientesFormulacionAprobada: string[]): Advertencia[] {
  const formulacionNormalizada = new Set(ingredientesFormulacionAprobada.map(n => n.trim().toLowerCase()));
  return alimentosRecomendados
    .filter(a => formulacionNormalizada.has(a.trim().toLowerCase()))
    .map(a => ({
      codigo: `duplicado-formulacion-${a}`,
      descripcion: `"${a}" ya forma parte de la formulación ortomolecular aprobada: coordinar para no duplicar aporte.`,
      fuente: 'formulacion',
    }));
}

// ---- Cálculo integral ----

export type CalculosNutricionales = {
  imc: number;
  clasificacionImc: ReturnType<typeof clasificarIMC>;
  gebKcal: number;
  getKcal: number;
  objetivoCaloricoKcal: number;
  proteinaG: number;
  carbohidratosG: number;
  grasasG: number;
  fibraG: number;
  aguaMl: number;
};

export function calcularValoresNutricionales(entrada: {
  pesoKg: number; tallaCm: number; edadAnios: number; sexo: Sexo;
  nivelActividad: NivelActividad; objetivo: ObjetivoClinico;
}): CalculosNutricionales {
  const imc = calcularIMC(entrada.pesoKg, entrada.tallaCm);
  const gebKcal = calcularGEB(entrada.pesoKg, entrada.tallaCm, entrada.edadAnios, entrada.sexo);
  const getKcal = calcularGET(gebKcal, entrada.nivelActividad);
  const objetivoCaloricoKcal = calcularObjetivoCalorico(getKcal, gebKcal, entrada.objetivo);
  const macros = calcularMacros(objetivoCaloricoKcal, entrada.objetivo);
  return {
    imc, clasificacionImc: clasificarIMC(imc), gebKcal, getKcal, objetivoCaloricoKcal,
    ...macros,
    fibraG: calcularFibraG(objetivoCaloricoKcal),
    aguaMl: calcularAguaMl(entrada.pesoKg),
  };
}

export function generarAdvertenciasPlan(entrada: {
  objetivo: ObjetivoClinico;
  paciente: PacienteContextoNutricion;
  restricciones: RestriccionesDeclaradas;
  alimentosRecomendados: string[];
  ingredientesFormulacionAprobada: string[];
}): Advertencia[] {
  const advertenciaObjetivo = ADVERTENCIA_POR_OBJETIVO[entrada.objetivo];
  const noRecomendados = alimentosNoRecomendados(entrada.restricciones);
  return [
    ...(advertenciaObjetivo ? [{ codigo: `objetivo-${entrada.objetivo}`, descripcion: advertenciaObjetivo, fuente: 'objetivo' }] : []),
    ...generarAdvertenciasClinicas(entrada.paciente),
    ...advertenciasPorAlimentoYObjetivo(entrada.objetivo),
    ...noRecomendados.map(n => ({ codigo: `restriccion-${n.alimento}`, descripcion: `${n.alimento}: ${n.motivo}`, fuente: 'restriccion' })),
    ...advertenciasIntegracionFormulacion(entrada.alimentosRecomendados, entrada.ingredientesFormulacionAprobada),
  ];
}
