/**
 * lib/clinica/baseConocimiento.ts
 *
 * Motor puro de la Base de Conocimiento Clínica: parseo/validación de
 * CSV, normalización de nombres para detectar duplicados, y el puente
 * que traduce un principio activo ya validado (más sus tablas
 * relacionadas) a la misma forma `InfoCatalogo` que ya consume
 * lib/clinica/formulacion.ts — así el motor de formulación no necesita
 * saber que existen estas tablas nuevas, sólo sigue leyendo un mapa
 * nombre → InfoCatalogo como siempre.
 *
 * Nada acá llama a Supabase ni decide si algo se guarda: sólo parsea,
 * valida y mapea datos ya provistos.
 */

import { REGLAS_FORMULACION_DEFECTO, type InfoCatalogo, type Presentacion } from './formulacion';
import { UNIDADES_DOSIS, type EstadoPrincipio } from '@/lib/validation/baseConocimiento';

export const COLUMNAS_CSV_PRINCIPIOS = [
  'nombre_canonico', 'nombre_comercial', 'sinonimos', 'descripcion',
  'dosis_minima_valor', 'dosis_usual_valor', 'dosis_maxima_valor', 'dosis_unidad', 'dosis_frecuencia',
  'forma_farmaceutica', 'capacidad_capsula_mg',
  'sabor', 'intensidad_sabor', 'solubilidad',
  'contraindicaciones', 'evidencia_nivel',
] as const;

const COLUMNA_REQUERIDA = 'nombre_canonico';

/** Quita acentos para comparar, sin tocar el texto que se guarda. */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function generarPlantillaCSV(): string {
  return '﻿' + COLUMNAS_CSV_PRINCIPIOS.join(',') + '\n';
}

/** Parser CSV mínimo (RFC 4180: comillas dobles, comas y saltos de línea dentro de campos entrecomillados, "" = comilla literal). */
export function parsearCSV(texto: string): string[][] {
  const contenido = texto.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;

  for (let i = 0; i < contenido.length; i++) {
    const c = contenido[i];
    if (entreComillas) {
      if (c === '"') {
        if (contenido[i + 1] === '"') { campo += '"'; i++; } else { entreComillas = false; }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ',') {
      fila.push(campo); campo = '';
    } else if (c === '\n') {
      fila.push(campo); campo = '';
      filas.push(fila); fila = [];
    } else {
      campo += c;
    }
  }
  if (campo.length > 0 || fila.length > 0) { fila.push(campo); filas.push(fila); }

  return filas.filter(f => !(f.length === 1 && f[0].trim() === ''));
}

function escaparCampoCSV(valor: string): string {
  if (/[",\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

export function filaACSV(valores: string[]): string {
  return valores.map(escaparCampoCSV).join(',');
}

export type EncabezadosCSV = { validos: boolean; faltantes: string[]; encabezados: string[] };

export function validarEncabezados(primeraFila: string[]): EncabezadosCSV {
  const encabezados = primeraFila.map(h => h.trim().toLowerCase());
  const faltantes = encabezados.includes(COLUMNA_REQUERIDA) ? [] : [COLUMNA_REQUERIDA];
  return { validos: faltantes.length === 0, faltantes, encabezados };
}

export function parsearFilasCSV(texto: string): { encabezados: string[]; filas: Record<string, string>[] } | { error: string } {
  const tabla = parsearCSV(texto);
  if (tabla.length === 0) return { error: 'El archivo está vacío.' };

  const { validos, faltantes, encabezados } = validarEncabezados(tabla[0]);
  if (!validos) return { error: `Faltan columnas obligatorias: ${faltantes.join(', ')}.` };

  const filas = tabla.slice(1).map(valores => {
    const registro: Record<string, string> = {};
    encabezados.forEach((col, i) => { registro[col] = (valores[i] ?? '').trim(); });
    return registro;
  });

  return { encabezados, filas };
}

export type ErrorFilaImportacion = { columna: string | null; valor: string | null; mensaje: string };
export type ResultadoValidacionFila = {
  numeroFila: number;
  datos: Record<string, string>;
  errores: ErrorFilaImportacion[];
  duplicadoEnArchivo: boolean;
  duplicadoExistente: boolean;
  valida: boolean;
};

/**
 * Valida una fila ya parseada. `nombresVistosEnArchivo` se va llenando
 * fila a fila por quien llama (para detectar duplicados dentro del
 * mismo CSV); `nombresExistentes` son los nombres ya cargados en la
 * base (normalizados), para avisar que la fila pisaría un registro
 * existente — la decisión de permitirlo o no es de la ruta, no de esta
 * función.
 */
export function validarFilaCSV(
  datos: Record<string, string>,
  numeroFila: number,
  nombresVistosEnArchivo: Set<string>,
  nombresExistentes: Set<string>
): ResultadoValidacionFila {
  const errores: ErrorFilaImportacion[] = [];
  const nombre = datos.nombre_canonico?.trim() ?? '';

  if (!nombre) {
    errores.push({ columna: 'nombre_canonico', valor: nombre, mensaje: 'El nombre canónico es obligatorio.' });
  }

  const normalizado = normalizarNombre(nombre);
  const duplicadoEnArchivo = Boolean(normalizado) && nombresVistosEnArchivo.has(normalizado);
  const duplicadoExistente = Boolean(normalizado) && nombresExistentes.has(normalizado);
  if (duplicadoEnArchivo) {
    errores.push({ columna: 'nombre_canonico', valor: nombre, mensaje: 'Nombre duplicado dentro del mismo archivo.' });
  }

  for (const campo of ['dosis_minima_valor', 'dosis_usual_valor', 'dosis_maxima_valor'] as const) {
    const valor = datos[campo];
    if (valor && Number.isNaN(Number(valor))) {
      errores.push({ columna: campo, valor, mensaje: `"${valor}" no es un número válido.` });
    }
  }

  const minima = Number(datos.dosis_minima_valor);
  const maxima = Number(datos.dosis_maxima_valor);
  if (datos.dosis_minima_valor && datos.dosis_maxima_valor && !Number.isNaN(minima) && !Number.isNaN(maxima) && maxima < minima) {
    errores.push({ columna: 'dosis_maxima_valor', valor: datos.dosis_maxima_valor, mensaje: 'La dosis máxima no puede ser menor que la dosis mínima.' });
  }

  const unidad = datos.dosis_unidad?.trim();
  if (unidad && !(UNIDADES_DOSIS as readonly string[]).includes(unidad)) {
    errores.push({ columna: 'dosis_unidad', valor: unidad, mensaje: `Unidad inválida "${unidad}". Use una de: ${UNIDADES_DOSIS.join(', ')}.` });
  }

  const forma = datos.forma_farmaceutica?.trim();
  if (forma && !['capsula', 'sobre', 'liquido', 'comercial'].includes(forma)) {
    errores.push({ columna: 'forma_farmaceutica', valor: forma, mensaje: `Forma farmacéutica inválida "${forma}".` });
  }

  const nivel = datos.evidencia_nivel?.trim();
  if (nivel && !['A', 'B', 'C', 'D'].includes(nivel)) {
    errores.push({ columna: 'evidencia_nivel', valor: nivel, mensaje: `Nivel de evidencia inválido "${nivel}". Use A, B, C o D.` });
  }

  if (normalizado) nombresVistosEnArchivo.add(normalizado);

  return { numeroFila, datos, errores, duplicadoEnArchivo, duplicadoExistente, valida: errores.length === 0 };
}

export function validarFilasCSV(filas: Record<string, string>[], nombresExistentes: Set<string>): ResultadoValidacionFila[] {
  const vistos = new Set<string>();
  return filas.map((datos, i) => validarFilaCSV(datos, i + 2, vistos, nombresExistentes)); // +2: fila 1 es encabezado, filas humanas empiezan en 1
}

export type FilaExportacion = {
  nombreCanonico: string; nombreComercial: string; sinonimos: string[]; descripcion: string;
  dosisMinima: number | null; dosisUsual: number | null; dosisMaxima: number | null; dosisUnidad: string; dosisFrecuencia: string;
  formaFarmaceutica: string; capacidadCapsulaMg: number | null;
  sabor: string; intensidadSabor: number | null; solubilidad: string;
  contraindicaciones: string[]; evidenciaNivel: string;
};

export function generarCSVExportacion(principios: FilaExportacion[]): string {
  const lineas = [COLUMNAS_CSV_PRINCIPIOS.join(',')];
  for (const p of principios) {
    lineas.push(filaACSV([
      p.nombreCanonico, p.nombreComercial, p.sinonimos.join('|'), p.descripcion,
      p.dosisMinima?.toString() ?? '', p.dosisUsual?.toString() ?? '', p.dosisMaxima?.toString() ?? '',
      p.dosisUnidad, p.dosisFrecuencia, p.formaFarmaceutica, p.capacidadCapsulaMg?.toString() ?? '',
      p.sabor, p.intensidadSabor?.toString() ?? '', p.solubilidad,
      p.contraindicaciones.join('|'), p.evidenciaNivel,
    ]));
  }
  return '﻿' + lineas.join('\n') + '\n';
}

// ---- Puente hacia el motor de formulación existente ----

export type PrincipioValidadoParaMotor = {
  nombreCanonico: string;
  estado: EstadoPrincipio;
  sinonimos: string[];
  capacidadCapsulaMg: number | null;
  intensidadSabor: number | null;
  solubilidad: string | null;
  formaFarmaceuticaPreferida: string | null;
  incompatibilidadesNombres: string[];
  dosisMaximaMg: number | null;
};

/**
 * Sólo traduce principios en estado 'validado' — el resto (borrador,
 * en_revision, archivado) nunca llega al motor clínico, sin importar
 * qué tan completos estén sus datos.
 */
export function principiosValidadosAInfoCatalogo(principios: PrincipioValidadoParaMotor[]): Map<string, InfoCatalogo> {
  const mapa = new Map<string, InfoCatalogo>();
  for (const p of principios) {
    if (p.estado !== 'validado') continue;
    const info: InfoCatalogo = {
      nombre: p.nombreCanonico,
      capacidadCapsulaMg: p.capacidadCapsulaMg ?? REGLAS_FORMULACION_DEFECTO.capacidadCapsulaMgDefecto,
      amargor: p.intensidadSabor ?? 0,
      solubleEnAgua: p.solubilidad ? !/insoluble|mala solubilidad/i.test(p.solubilidad) : null,
      presentacionPreferida: (p.formaFarmaceuticaPreferida as Presentacion | null) ?? 'individualizar',
      incompatibilidades: p.incompatibilidadesNombres,
      doseReferenciaMaxMg: p.dosisMaximaMg,
      limiteSuperiorMg: p.dosisMaximaMg,
    };
    mapa.set(normalizarNombre(p.nombreCanonico), info);
    for (const s of p.sinonimos) mapa.set(normalizarNombre(s), info);
  }
  return mapa;
}
