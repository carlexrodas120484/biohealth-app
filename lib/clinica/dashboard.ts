/**
 * lib/clinica/dashboard.ts
 *
 * Motor del Dashboard Clínico Inteligente. Igual que el resto de los
 * motores de este proyecto: funciones puras, sin acceso a Supabase.
 * Es la "IA interna" pedida — no llama a ningún modelo externo, es un
 * conjunto de reglas determinísticas y explicables: clasifica cada
 * indicador en un semáforo con su explicación clínica, arma los 6
 * semáforos de sistema (cardiovascular/metabólico/inflamación/
 * intestinal/hormonal/mitocondrial), genera alertas, detecta
 * inconsistencias entre módulos y prioriza los problemas encontrados.
 * Nunca decide por el profesional ni aprueba nada — sólo prioriza y
 * explica, siempre citando el dato que sustenta cada conclusión.
 */

import type { Severidad } from './cuestionario';
import type { PatronFuncional } from './patrones';

export type Semaforo = 'verde' | 'amarillo' | 'rojo' | 'sin_datos';

export const ORDEN_SEMAFORO: Record<Semaforo, number> = { rojo: 3, amarillo: 2, verde: 1, sin_datos: 0 };

export type Sexo = 'femenino' | 'masculino';

export type IndicadorClinico = {
  codigo: string;
  nombre: string;
  valor: number | null;
  unidad: string;
  semaforo: Semaforo;
  explicacion: string;
  rangoReferencia: string;
};

function indicador(codigo: string, nombre: string, unidad: string, rangoReferencia: string, valor: number | null, semaforo: Semaforo, explicacion: string): IndicadorClinico {
  return { codigo, nombre, unidad, rangoReferencia, valor, semaforo, explicacion };
}

const SIN_DATOS = (codigo: string, nombre: string, unidad: string, rango: string): IndicadorClinico =>
  indicador(codigo, nombre, unidad, rango, null, 'sin_datos', 'Sin valor registrado para este paciente.');

export function clasificarIMC(pesoKg: number, tallaCm: number): IndicadorClinico {
  const tallaM = tallaCm / 100;
  const imc = tallaM > 0 ? Math.round((pesoKg / (tallaM * tallaM)) * 10) / 10 : 0;
  let semaforo: Semaforo = 'verde';
  let explicacion = `IMC ${imc} — rango normal (18.5–24.9).`;
  if (imc < 16 || imc >= 35) {
    semaforo = 'rojo';
    explicacion = imc < 16 ? `IMC ${imc} — bajo peso severo (<16).` : `IMC ${imc} — obesidad grado II o mayor (≥35).`;
  } else if (imc < 18.5 || imc >= 25) {
    semaforo = 'amarillo';
    explicacion = imc < 18.5 ? `IMC ${imc} — bajo peso (16–18.4).` : `IMC ${imc} — sobrepeso u obesidad grado I (25–34.9).`;
  }
  return indicador('imc', 'IMC', 'kg/m²', '18.5–24.9', imc, semaforo, explicacion);
}

export function clasificarCintura(cm: number, sexo: Sexo | null): IndicadorClinico {
  const limiteAlto = sexo === 'masculino' ? 94 : 80;
  const limiteMuyAlto = sexo === 'masculino' ? 102 : 88;
  let semaforo: Semaforo = 'verde';
  let explicacion = `Cintura ${cm} cm — riesgo cardiometabólico bajo.`;
  if (cm >= limiteMuyAlto) {
    semaforo = 'rojo';
    explicacion = `Cintura ${cm} cm — riesgo cardiometabólico muy alto (≥${limiteMuyAlto} cm).`;
  } else if (cm >= limiteAlto) {
    semaforo = 'amarillo';
    explicacion = `Cintura ${cm} cm — riesgo cardiometabólico aumentado (≥${limiteAlto} cm).`;
  }
  return indicador('cintura', 'Circunferencia de cintura', 'cm', sexo === 'masculino' ? '<94 cm' : '<80 cm', cm, semaforo, explicacion);
}

export function clasificarPresionArterial(sistolica: number, diastolica: number): IndicadorClinico {
  let semaforo: Semaforo = 'verde';
  let explicacion = `${sistolica}/${diastolica} mmHg — presión normal (<120/80).`;
  if (sistolica >= 140 || diastolica >= 90) {
    semaforo = 'rojo';
    explicacion = `${sistolica}/${diastolica} mmHg — hipertensión (≥140/90).`;
  } else if (sistolica >= 120 || diastolica >= 80) {
    semaforo = 'amarillo';
    explicacion = `${sistolica}/${diastolica} mmHg — presión elevada / prehipertensión (120–139 / 80–89).`;
  }
  return indicador('presion_arterial', 'Presión arterial', 'mmHg', '<120/80', sistolica, semaforo, explicacion);
}

export function clasificarGlucemia(mgDl: number): IndicadorClinico {
  let semaforo: Semaforo = 'verde';
  let explicacion = `Glucemia en ayunas ${mgDl} mg/dL — normal (<100).`;
  if (mgDl >= 126) {
    semaforo = 'rojo';
    explicacion = `Glucemia en ayunas ${mgDl} mg/dL — rango diabetes (≥126).`;
  } else if (mgDl >= 100) {
    semaforo = 'amarillo';
    explicacion = `Glucemia en ayunas ${mgDl} mg/dL — prediabetes (100–125).`;
  }
  return indicador('glucemia', 'Glucemia en ayunas', 'mg/dL', '<100', mgDl, semaforo, explicacion);
}

export function clasificarHbA1c(pct: number): IndicadorClinico {
  let semaforo: Semaforo = 'verde';
  let explicacion = `HbA1c ${pct}% — normal (<5.7%).`;
  if (pct >= 6.5) {
    semaforo = 'rojo';
    explicacion = `HbA1c ${pct}% — rango diabetes (≥6.5%).`;
  } else if (pct >= 5.7) {
    semaforo = 'amarillo';
    explicacion = `HbA1c ${pct}% — prediabetes (5.7–6.4%).`;
  }
  return indicador('hba1c', 'HbA1c', '%', '<5.7%', pct, semaforo, explicacion);
}

export function clasificarTrigliceridos(mgDl: number): IndicadorClinico {
  let semaforo: Semaforo = 'verde';
  let explicacion = `Triglicéridos ${mgDl} mg/dL — normal (<150).`;
  if (mgDl >= 200) {
    semaforo = 'rojo';
    explicacion = `Triglicéridos ${mgDl} mg/dL — alto (≥200).`;
  } else if (mgDl >= 150) {
    semaforo = 'amarillo';
    explicacion = `Triglicéridos ${mgDl} mg/dL — límite alto (150–199).`;
  }
  return indicador('trigliceridos', 'Triglicéridos', 'mg/dL', '<150', mgDl, semaforo, explicacion);
}

export function clasificarHDL(mgDl: number, sexo: Sexo | null): IndicadorClinico {
  const limiteBajo = sexo === 'masculino' ? 40 : 50;
  let semaforo: Semaforo = 'verde';
  let explicacion = `HDL ${mgDl} mg/dL — protector (≥${limiteBajo}).`;
  if (mgDl < limiteBajo - 5) {
    semaforo = 'rojo';
    explicacion = `HDL ${mgDl} mg/dL — bajo, mayor riesgo cardiovascular (<${limiteBajo - 5}).`;
  } else if (mgDl < limiteBajo) {
    semaforo = 'amarillo';
    explicacion = `HDL ${mgDl} mg/dL — límite bajo (${limiteBajo - 5}–${limiteBajo - 1}).`;
  }
  return indicador('hdl', 'HDL', 'mg/dL', sexo === 'masculino' ? '≥40' : '≥50', mgDl, semaforo, explicacion);
}

export function clasificarLDL(mgDl: number): IndicadorClinico {
  let semaforo: Semaforo = 'verde';
  let explicacion = `LDL ${mgDl} mg/dL — óptimo (<100).`;
  if (mgDl >= 160) {
    semaforo = 'rojo';
    explicacion = `LDL ${mgDl} mg/dL — alto (≥160).`;
  } else if (mgDl >= 100) {
    semaforo = 'amarillo';
    explicacion = `LDL ${mgDl} mg/dL — límite alto (100–159).`;
  }
  return indicador('ldl', 'LDL', 'mg/dL', '<100', mgDl, semaforo, explicacion);
}

export function clasificarVitaminaD(ngMl: number): IndicadorClinico {
  let semaforo: Semaforo = 'verde';
  let explicacion = `Vitamina D ${ngMl} ng/mL — suficiente (≥30).`;
  if (ngMl < 20) {
    semaforo = 'rojo';
    explicacion = `Vitamina D ${ngMl} ng/mL — deficiencia (<20).`;
  } else if (ngMl < 30) {
    semaforo = 'amarillo';
    explicacion = `Vitamina D ${ngMl} ng/mL — insuficiencia (20–29).`;
  }
  return indicador('vitamina_d', 'Vitamina D', 'ng/mL', '≥30', ngMl, semaforo, explicacion);
}

export function clasificarHOMA(valor: number): IndicadorClinico {
  let semaforo: Semaforo = 'verde';
  let explicacion = `HOMA-IR ${valor} — sensibilidad a la insulina normal (<2.5).`;
  if (valor >= 4) {
    semaforo = 'rojo';
    explicacion = `HOMA-IR ${valor} — resistencia a la insulina marcada (≥4).`;
  } else if (valor >= 2.5) {
    semaforo = 'amarillo';
    explicacion = `HOMA-IR ${valor} — posible resistencia a la insulina (2.5–3.9).`;
  }
  return indicador('homa_ir', 'HOMA-IR', '', '<2.5', valor, semaforo, explicacion);
}

export function clasificarPCR(mgL: number): IndicadorClinico {
  let semaforo: Semaforo = 'verde';
  let explicacion = `PCR ${mgL} mg/L — riesgo inflamatorio/cardiovascular bajo (<1).`;
  if (mgL > 3) {
    semaforo = 'rojo';
    explicacion = `PCR ${mgL} mg/L — riesgo inflamatorio/cardiovascular alto (>3).`;
  } else if (mgL >= 1) {
    semaforo = 'amarillo';
    explicacion = `PCR ${mgL} mg/L — riesgo inflamatorio/cardiovascular moderado (1–3).`;
  }
  return indicador('pcr', 'PCR', 'mg/L', '<1', mgL, semaforo, explicacion);
}

export function clasificarFerritina(ngMl: number, sexo: Sexo | null): IndicadorClinico {
  const min = sexo === 'masculino' ? 20 : 15;
  const max = sexo === 'masculino' ? 250 : 150;
  let semaforo: Semaforo = 'verde';
  let explicacion = `Ferritina ${ngMl} ng/mL — dentro de rango (${min}–${max}).`;
  if (ngMl < min / 2 || ngMl > max * 1.5) {
    semaforo = 'rojo';
    explicacion = ngMl < min / 2
      ? `Ferritina ${ngMl} ng/mL — déficit marcado de reservas de hierro (<${Math.round(min / 2)}).`
      : `Ferritina ${ngMl} ng/mL — muy elevada, evaluar causa inflamatoria/sobrecarga (>${Math.round(max * 1.5)}).`;
  } else if (ngMl < min || ngMl > max) {
    semaforo = 'amarillo';
    explicacion = ngMl < min
      ? `Ferritina ${ngMl} ng/mL — reservas de hierro bajas (<${min}).`
      : `Ferritina ${ngMl} ng/mL — elevada (>${max}).`;
  }
  return indicador('ferritina', 'Ferritina', 'ng/mL', `${min}–${max}`, ngMl, semaforo, explicacion);
}

/** Entrada cruda de una toma de laboratorio (valores ya persistidos, ninguno se recalcula). */
export type LaboratorioEntrada = {
  fecha: string;
  pesoKg?: number | null;
  tallaCm?: number | null;
  cinturaCm?: number | null;
  presionSistolica?: number | null;
  presionDiastolica?: number | null;
  glucemiaMgDl?: number | null;
  hba1cPct?: number | null;
  trigliceridosMgDl?: number | null;
  hdlMgDl?: number | null;
  ldlMgDl?: number | null;
  vitaminaDNgMl?: number | null;
  homaIr?: number | null;
  pcrMgL?: number | null;
  ferritinaNgMl?: number | null;
};

/** Arma los 13 indicadores del último registro de laboratorio, con semáforo y explicación. */
export function construirIndicadores(entrada: LaboratorioEntrada | null, sexo: Sexo | null): IndicadorClinico[] {
  if (!entrada) {
    return [
      SIN_DATOS('peso', 'Peso', 'kg', '—'),
      SIN_DATOS('imc', 'IMC', 'kg/m²', '18.5–24.9'),
      SIN_DATOS('cintura', 'Circunferencia de cintura', 'cm', '—'),
      SIN_DATOS('presion_arterial', 'Presión arterial', 'mmHg', '<120/80'),
      SIN_DATOS('glucemia', 'Glucemia en ayunas', 'mg/dL', '<100'),
      SIN_DATOS('hba1c', 'HbA1c', '%', '<5.7%'),
      SIN_DATOS('trigliceridos', 'Triglicéridos', 'mg/dL', '<150'),
      SIN_DATOS('hdl', 'HDL', 'mg/dL', '—'),
      SIN_DATOS('ldl', 'LDL', 'mg/dL', '<100'),
      SIN_DATOS('vitamina_d', 'Vitamina D', 'ng/mL', '≥30'),
      SIN_DATOS('homa_ir', 'HOMA-IR', '', '<2.5'),
      SIN_DATOS('pcr', 'PCR', 'mg/L', '<1'),
      SIN_DATOS('ferritina', 'Ferritina', 'ng/mL', '—'),
    ];
  }

  const resultado: IndicadorClinico[] = [];
  resultado.push(entrada.pesoKg != null ? indicador('peso', 'Peso', 'kg', '—', entrada.pesoKg, 'verde', `Peso registrado: ${entrada.pesoKg} kg.`) : SIN_DATOS('peso', 'Peso', 'kg', '—'));
  resultado.push(entrada.pesoKg != null && entrada.tallaCm != null ? clasificarIMC(entrada.pesoKg, entrada.tallaCm) : SIN_DATOS('imc', 'IMC', 'kg/m²', '18.5–24.9'));
  resultado.push(entrada.cinturaCm != null ? clasificarCintura(entrada.cinturaCm, sexo) : SIN_DATOS('cintura', 'Circunferencia de cintura', 'cm', '—'));
  resultado.push(entrada.presionSistolica != null && entrada.presionDiastolica != null ? clasificarPresionArterial(entrada.presionSistolica, entrada.presionDiastolica) : SIN_DATOS('presion_arterial', 'Presión arterial', 'mmHg', '<120/80'));
  resultado.push(entrada.glucemiaMgDl != null ? clasificarGlucemia(entrada.glucemiaMgDl) : SIN_DATOS('glucemia', 'Glucemia en ayunas', 'mg/dL', '<100'));
  resultado.push(entrada.hba1cPct != null ? clasificarHbA1c(entrada.hba1cPct) : SIN_DATOS('hba1c', 'HbA1c', '%', '<5.7%'));
  resultado.push(entrada.trigliceridosMgDl != null ? clasificarTrigliceridos(entrada.trigliceridosMgDl) : SIN_DATOS('trigliceridos', 'Triglicéridos', 'mg/dL', '<150'));
  resultado.push(entrada.hdlMgDl != null ? clasificarHDL(entrada.hdlMgDl, sexo) : SIN_DATOS('hdl', 'HDL', 'mg/dL', '—'));
  resultado.push(entrada.ldlMgDl != null ? clasificarLDL(entrada.ldlMgDl) : SIN_DATOS('ldl', 'LDL', 'mg/dL', '<100'));
  resultado.push(entrada.vitaminaDNgMl != null ? clasificarVitaminaD(entrada.vitaminaDNgMl) : SIN_DATOS('vitamina_d', 'Vitamina D', 'ng/mL', '≥30'));
  resultado.push(entrada.homaIr != null ? clasificarHOMA(entrada.homaIr) : SIN_DATOS('homa_ir', 'HOMA-IR', '', '<2.5'));
  resultado.push(entrada.pcrMgL != null ? clasificarPCR(entrada.pcrMgL) : SIN_DATOS('pcr', 'PCR', 'mg/L', '<1'));
  resultado.push(entrada.ferritinaNgMl != null ? clasificarFerritina(entrada.ferritinaNgMl, sexo) : SIN_DATOS('ferritina', 'Ferritina', 'ng/mL', '—'));
  return resultado;
}

function porCodigo(indicadores: IndicadorClinico[], codigo: string): IndicadorClinico | undefined {
  return indicadores.find(i => i.codigo === codigo);
}

function peorSemaforo(semaforos: Semaforo[]): Semaforo {
  const conDatos = semaforos.filter(s => s !== 'sin_datos');
  if (conDatos.length === 0) return 'sin_datos';
  return conDatos.reduce((peor, s) => (ORDEN_SEMAFORO[s] > ORDEN_SEMAFORO[peor] ? s : peor), 'verde' as Semaforo);
}

export type EstadoSistema = { semaforo: Semaforo; explicacion: string; indicadoresConsiderados: string[] };

/** Combina presión, LDL/HDL, triglicéridos, PCR, cintura y el patrón 'riesgo-cardiovascular' confirmado. */
export function calcularRiesgoCardiovascular(indicadores: IndicadorClinico[], patrones: PatronFuncional[]): EstadoSistema {
  const relevantes = ['presion_arterial', 'ldl', 'hdl', 'trigliceridos', 'pcr', 'cintura'].map(c => porCodigo(indicadores, c)).filter((i): i is IndicadorClinico => Boolean(i));
  const patronConfirmado = patrones.find(p => p.codigo === 'riesgo-cardiovascular' && p.estado === 'confirmado');
  const semaforo = peorSemaforo([...relevantes.map(i => i.semaforo), patronConfirmado ? 'rojo' : 'sin_datos']);
  const alertas = relevantes.filter(i => i.semaforo === 'rojo' || i.semaforo === 'amarillo').map(i => i.explicacion);
  if (patronConfirmado) alertas.push('Patrón funcional de riesgo cardiovascular confirmado por el profesional.');
  const explicacion = alertas.length > 0 ? alertas.join(' ') : semaforo === 'sin_datos' ? 'Sin datos suficientes para estimar el riesgo cardiovascular.' : 'Indicadores cardiovasculares dentro de rango.';
  return { semaforo, explicacion, indicadoresConsiderados: relevantes.map(i => i.codigo) };
}

/** Combina glucemia, HbA1c, HOMA, triglicéridos, cintura, IMC y el patrón 'metabolico-glucemico' confirmado. */
export function calcularRiesgoMetabolico(indicadores: IndicadorClinico[], patrones: PatronFuncional[]): EstadoSistema {
  const relevantes = ['glucemia', 'hba1c', 'homa_ir', 'trigliceridos', 'cintura', 'imc'].map(c => porCodigo(indicadores, c)).filter((i): i is IndicadorClinico => Boolean(i));
  const patronConfirmado = patrones.find(p => p.codigo === 'metabolico-glucemico' && p.estado === 'confirmado');
  const semaforo = peorSemaforo([...relevantes.map(i => i.semaforo), patronConfirmado ? 'rojo' : 'sin_datos']);
  const alertas = relevantes.filter(i => i.semaforo === 'rojo' || i.semaforo === 'amarillo').map(i => i.explicacion);
  if (patronConfirmado) alertas.push('Patrón funcional metabólico/glucémico confirmado por el profesional.');
  const explicacion = alertas.length > 0 ? alertas.join(' ') : semaforo === 'sin_datos' ? 'Sin datos suficientes para estimar el riesgo metabólico.' : 'Indicadores metabólicos dentro de rango.';
  return { semaforo, explicacion, indicadoresConsiderados: relevantes.map(i => i.codigo) };
}

/** PCR + patrón funcional 'inflamacion-sistemica' confirmado. */
export function calcularInflamacion(indicadores: IndicadorClinico[], patrones: PatronFuncional[]): EstadoSistema {
  const pcr = porCodigo(indicadores, 'pcr');
  const patron = patrones.find(p => p.codigo === 'inflamacion-sistemica' && p.estado === 'confirmado');
  const semaforo = peorSemaforo([pcr?.semaforo ?? 'sin_datos', patron ? (patron.nivel === 'muy_alta' || patron.nivel === 'alta' ? 'rojo' : 'amarillo') : 'sin_datos']);
  const partes: string[] = [];
  if (pcr && pcr.semaforo !== 'sin_datos') partes.push(pcr.explicacion);
  if (patron) partes.push(`Patrón funcional de inflamación sistémica confirmado (nivel ${patron.nivel}).`);
  return { semaforo, explicacion: partes.length > 0 ? partes.join(' ') : 'Sin datos de PCR ni patrón de inflamación confirmado.', indicadoresConsiderados: ['pcr'] };
}

function estadoDesdePatron(patrones: PatronFuncional[], codigos: string[], etiqueta: string): EstadoSistema {
  const confirmados = patrones.filter(p => codigos.includes(p.codigo) && p.estado === 'confirmado');
  if (confirmados.length === 0) {
    return { semaforo: 'sin_datos', explicacion: `Sin patrones funcionales de ${etiqueta} confirmados.`, indicadoresConsiderados: [] };
  }
  const peor = confirmados.reduce((p, c) => (['muy_alta', 'alta'].includes(c.nivel) && !['muy_alta', 'alta'].includes(p.nivel) ? c : p), confirmados[0]);
  const semaforo: Semaforo = peor.nivel === 'muy_alta' || peor.nivel === 'alta' ? 'rojo' : peor.nivel === 'moderada' ? 'amarillo' : 'verde';
  return {
    semaforo,
    explicacion: confirmados.map(c => `${c.nombre} (nivel ${c.nivel}).`).join(' '),
    indicadoresConsiderados: confirmados.map(c => c.codigo),
  };
}

export function calcularEstadoIntestinal(patrones: PatronFuncional[]): EstadoSistema {
  return estadoDesdePatron(patrones, ['intestinal', 'digestivo-alto'], 'estado intestinal');
}

export function calcularEstadoHormonal(patrones: PatronFuncional[]): EstadoSistema {
  return estadoDesdePatron(patrones, ['hormonal', 'tiroides-funcional', 'suprarrenal-estres-cronico'], 'estado hormonal');
}

export function calcularEstadoMitocondrial(patrones: PatronFuncional[]): EstadoSistema {
  return estadoDesdePatron(patrones, ['disfuncion-mitocondrial', 'estres-oxidativo'], 'estado mitocondrial');
}

// ---- Alertas, inconsistencias y priorización ----

export type AlertaClinica = {
  codigo: string;
  severidad: Semaforo;
  titulo: string;
  explicacion: string;
  origen: string;
};

export type ContextoDashboard = {
  paciente: { sexo: Sexo | null };
  historiaCompletada: boolean;
  diagnosticoConfirmado: boolean;
  patrones: PatronFuncional[];
  fasesActivas: number;
  fasesSugeridas: number;
  formulacionEstado: string | null;
  nutricionEstado: string | null;
  indicadores: IndicadorClinico[];
};

/** Alertas por indicador fuera de rango (rojo/amarillo) + por patrón confirmado de alta prioridad. */
export function generarAlertasClinicas(ctx: ContextoDashboard): AlertaClinica[] {
  const alertas: AlertaClinica[] = [];

  for (const i of ctx.indicadores) {
    if (i.semaforo === 'rojo' || i.semaforo === 'amarillo') {
      alertas.push({ codigo: `indicador-${i.codigo}`, severidad: i.semaforo, titulo: `${i.nombre} fuera de rango`, explicacion: i.explicacion, origen: 'laboratorio' });
    }
  }

  for (const p of ctx.patrones) {
    if (p.estado === 'confirmado' && (p.nivel === 'alta' || p.nivel === 'muy_alta')) {
      alertas.push({
        codigo: `patron-${p.codigo}`,
        severidad: p.nivel === 'muy_alta' ? 'rojo' : 'amarillo',
        titulo: p.nombre,
        explicacion: `Patrón funcional confirmado con nivel ${p.nivel} (puntaje ${p.puntaje}).`,
        origen: 'diagnostico',
      });
    }
  }

  return alertas;
}

/** Cruces entre módulos que no deberían pasar desapercibidos (nunca bloquea nada, sólo avisa). */
export function detectarInconsistencias(ctx: ContextoDashboard): AlertaClinica[] {
  const inconsistencias: AlertaClinica[] = [];

  if (ctx.formulacionEstado === 'aprobada' && !ctx.diagnosticoConfirmado) {
    inconsistencias.push({
      codigo: 'inconsistencia-formulacion-sin-diagnostico',
      severidad: 'amarillo',
      titulo: 'Formulación aprobada sin diagnóstico confirmado',
      explicacion: 'Hay una formulación ortomolecular aprobada, pero el diagnóstico funcional del paciente todavía no fue confirmado.',
      origen: 'consistencia',
    });
  }

  if (ctx.nutricionEstado === 'aprobado' && !ctx.historiaCompletada) {
    inconsistencias.push({
      codigo: 'inconsistencia-nutricion-sin-historia',
      severidad: 'amarillo',
      titulo: 'Plan nutricional aprobado con historia clínica incompleta',
      explicacion: 'El plan nutricional está aprobado, pero la historia clínica del paciente todavía no está marcada como completa.',
      origen: 'consistencia',
    });
  }

  if (ctx.fasesActivas === 0 && ctx.fasesSugeridas > 0 && ctx.diagnosticoConfirmado) {
    inconsistencias.push({
      codigo: 'inconsistencia-plan-sin-activar',
      severidad: 'amarillo',
      titulo: 'Plan terapéutico sin fases activas',
      explicacion: 'Hay fases sugeridas por el sistema para este paciente pero ninguna fue activada por el profesional.',
      origen: 'consistencia',
    });
  }

  if (ctx.diagnosticoConfirmado && ctx.patrones.every(p => p.estado !== 'confirmado')) {
    inconsistencias.push({
      codigo: 'inconsistencia-diagnostico-sin-patrones',
      severidad: 'amarillo',
      titulo: 'Diagnóstico confirmado sin patrones funcionales confirmados',
      explicacion: 'El diagnóstico funcional está marcado como confirmado pero ningún patrón funcional fue confirmado individualmente.',
      origen: 'consistencia',
    });
  }

  return inconsistencias;
}

export type ProblemaPriorizado = {
  prioridad: number;
  codigo: string;
  titulo: string;
  severidad: Semaforo;
  porQue: string;
  recomendacion: string;
};

const RECOMENDACIONES_POR_ORIGEN: Record<string, string> = {
  laboratorio: 'Revisar el valor con el paciente y considerar repetir el control o ajustar el plan según corresponda.',
  diagnostico: 'Revisar el patrón funcional confirmado y su prioridad terapéutica en el plan.',
  consistencia: 'Revisar los módulos involucrados antes de continuar con el siguiente paso del flujo clínico.',
};

/**
 * Combina alertas + inconsistencias, ordena por severidad (rojo > amarillo)
 * y devuelve una lista priorizada con "por qué" y una recomendación —
 * nunca una decisión tomada por el sistema, sólo una sugerencia a revisar.
 */
export function priorizarProblemas(ctx: ContextoDashboard): ProblemaPriorizado[] {
  const alertas = [...generarAlertasClinicas(ctx), ...detectarInconsistencias(ctx)];
  const ordenadas = alertas
    .slice()
    .sort((a, b) => ORDEN_SEMAFORO[b.severidad] - ORDEN_SEMAFORO[a.severidad]);

  return ordenadas.map((a, i) => ({
    prioridad: i + 1,
    codigo: a.codigo,
    titulo: a.titulo,
    severidad: a.severidad,
    porQue: a.explicacion,
    recomendacion: RECOMENDACIONES_POR_ORIGEN[a.origen] ?? 'Revisar con el profesional a cargo.',
  }));
}

/** Resumen de una línea por cada módulo pendiente/incompleto, para la tarjeta de recordatorios. */
export function generarRecordatorios(ctx: ContextoDashboard): string[] {
  const recordatorios: string[] = [];
  if (!ctx.historiaCompletada) recordatorios.push('Completar la historia clínica.');
  if (!ctx.diagnosticoConfirmado) recordatorios.push('Confirmar el diagnóstico funcional.');
  if (ctx.fasesActivas === 0) recordatorios.push('Activar al menos una fase del plan terapéutico.');
  if (ctx.formulacionEstado && ctx.formulacionEstado !== 'aprobada' && ctx.formulacionEstado !== 'archivada') {
    recordatorios.push('Revisar y aprobar la formulación ortomolecular pendiente.');
  }
  if (ctx.nutricionEstado && ctx.nutricionEstado !== 'aprobado' && ctx.nutricionEstado !== 'archivado') {
    recordatorios.push('Revisar y aprobar el plan nutricional pendiente.');
  }
  return recordatorios;
}

/** Fecha sugerida de próximo control, a partir de la fase activa de mayor prioridad (nunca agenda un turno real). */
export function sugerirProximoControl(fases: Array<{ estado: string; duracionEstimadaSemanas: number }>, desde: Date = new Date()): { fecha: string; semanas: number } | null {
  const activa = fases.find(f => f.estado === 'activa');
  if (!activa) return null;
  const semanas = Math.max(1, Math.min(activa.duracionEstimadaSemanas, 4));
  const fecha = new Date(desde);
  fecha.setDate(fecha.getDate() + semanas * 7);
  return { fecha: fecha.toISOString().slice(0, 10), semanas };
}
