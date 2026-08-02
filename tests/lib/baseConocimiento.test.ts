import { describe, it, expect } from 'vitest';
import {
  normalizarNombre, generarPlantillaCSV, parsearCSV, validarEncabezados, parsearFilasCSV,
  validarFilaCSV, validarFilasCSV, generarCSVExportacion, principiosValidadosAInfoCatalogo,
  COLUMNAS_CSV_PRINCIPIOS, type PrincipioValidadoParaMotor,
} from '@/lib/clinica/baseConocimiento';

describe('baseConocimiento — normalizarNombre', () => {
  it('quita acentos y normaliza mayúsculas/espacios para comparar', () => {
    expect(normalizarNombre('Vitamina D3')).toBe('vitamina d3');
    expect(normalizarNombre('Vitamina D3')).toBe(normalizarNombre('vitamina  d3 ')); // NBSP/espacios extra
    expect(normalizarNombre('Cúrcuma')).toBe('curcuma');
    expect(normalizarNombre('Magnésio')).toBe(normalizarNombre('Magnesio'));
  });

  it('distingue nombres genuinamente distintos', () => {
    expect(normalizarNombre('Zinc')).not.toBe(normalizarNombre('Zinc-L-carnosina'));
  });
});

describe('baseConocimiento — plantilla y parseo CSV', () => {
  it('la plantilla trae el encabezado con todas las columnas y BOM UTF-8', () => {
    const plantilla = generarPlantillaCSV();
    expect(plantilla.startsWith('﻿')).toBe(true);
    for (const col of COLUMNAS_CSV_PRINCIPIOS) expect(plantilla).toContain(col);
  });

  it('parsea filas simples separadas por coma', () => {
    const filas = parsearCSV('a,b,c\n1,2,3\n');
    expect(filas).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('respeta comillas con comas y saltos de línea dentro del campo, y "" como comilla literal', () => {
    const filas = parsearCSV('nombre,descripcion\n"Magnesio","Mineral, esencial.\ncon salto"\n"Con ""comillas"" internas",x\n');
    expect(filas[1]).toEqual(['Magnesio', 'Mineral, esencial.\ncon salto']);
    expect(filas[2]).toEqual(['Con "comillas" internas', 'x']);
  });

  it('soporta UTF-8 y caracteres especiales (acentos, ñ) sin corromperlos', () => {
    const filas = parsearCSV('nombre_canonico\nCúrcuma\nMagnesio (óxido)\nPiña colada ñ\n');
    expect(filas).toEqual([['nombre_canonico'], ['Cúrcuma'], ['Magnesio (óxido)'], ['Piña colada ñ']]);
  });

  it('ignora el BOM inicial si está presente', () => {
    const filas = parsearCSV('﻿nombre_canonico\nMagnesio\n');
    expect(filas[0]).toEqual(['nombre_canonico']);
  });
});

describe('baseConocimiento — validarEncabezados / parsearFilasCSV', () => {
  it('acepta encabezados con la columna obligatoria presente, en cualquier orden', () => {
    const r = validarEncabezados(['descripcion', 'nombre_canonico', 'sabor']);
    expect(r.validos).toBe(true);
  });

  it('rechaza un CSV sin la columna nombre_canonico (encabezados faltantes)', () => {
    const r = validarEncabezados(['descripcion', 'sabor']);
    expect(r.validos).toBe(false);
    expect(r.faltantes).toContain('nombre_canonico');
  });

  it('parsearFilasCSV devuelve error si el archivo está vacío', () => {
    const r = parsearFilasCSV('');
    expect('error' in r).toBe(true);
  });

  it('parsearFilasCSV devuelve error si faltan encabezados obligatorios', () => {
    const r = parsearFilasCSV('descripcion,sabor\nx,y\n');
    expect('error' in r).toBe(true);
  });

  it('parsearFilasCSV arma un registro por fila, indexado por nombre de columna', () => {
    const r = parsearFilasCSV('nombre_canonico,descripcion\nMagnesio,Mineral\nZinc,Oligoelemento\n');
    if ('error' in r) throw new Error('no debería fallar');
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0]).toMatchObject({ nombre_canonico: 'Magnesio', descripcion: 'Mineral' });
  });
});

describe('baseConocimiento — validarFilaCSV', () => {
  it('fila válida sin errores', () => {
    const r = validarFilaCSV({ nombre_canonico: 'Magnesio', dosis_unidad: 'mg' }, 2, new Set(), new Set());
    expect(r.valida).toBe(true);
  });

  it('rechaza fila sin nombre_canonico (dato incompleto)', () => {
    const r = validarFilaCSV({ nombre_canonico: '' }, 2, new Set(), new Set());
    expect(r.valida).toBe(false);
    expect(r.errores.some(e => e.columna === 'nombre_canonico')).toBe(true);
  });

  it('rechaza dosis con valor no numérico (dosis inválida)', () => {
    const r = validarFilaCSV({ nombre_canonico: 'Magnesio', dosis_usual_valor: 'abc' }, 2, new Set(), new Set());
    expect(r.valida).toBe(false);
    expect(r.errores.some(e => e.columna === 'dosis_usual_valor')).toBe(true);
  });

  it('rechaza cuando la dosis máxima es menor que la dosis mínima', () => {
    const r = validarFilaCSV({ nombre_canonico: 'Magnesio', dosis_minima_valor: '500', dosis_maxima_valor: '100' }, 2, new Set(), new Set());
    expect(r.valida).toBe(false);
    expect(r.errores.some(e => e.mensaje.includes('no puede ser menor'))).toBe(true);
  });

  it('rechaza una unidad de dosis inválida', () => {
    const r = validarFilaCSV({ nombre_canonico: 'Magnesio', dosis_unidad: 'litros' }, 2, new Set(), new Set());
    expect(r.valida).toBe(false);
    expect(r.errores.some(e => e.columna === 'dosis_unidad')).toBe(true);
  });

  it('rechaza una forma farmacéutica inválida', () => {
    const r = validarFilaCSV({ nombre_canonico: 'Magnesio', forma_farmaceutica: 'inyectable' }, 2, new Set(), new Set());
    expect(r.valida).toBe(false);
  });

  it('rechaza un nivel de evidencia inválido', () => {
    const r = validarFilaCSV({ nombre_canonico: 'Magnesio', evidencia_nivel: 'Z' }, 2, new Set(), new Set());
    expect(r.valida).toBe(false);
  });

  it('detecta un nombre duplicado dentro del mismo archivo', () => {
    const vistos = new Set<string>();
    const r1 = validarFilaCSV({ nombre_canonico: 'Magnesio' }, 2, vistos, new Set());
    const r2 = validarFilaCSV({ nombre_canonico: 'magnesio' }, 3, vistos, new Set());
    expect(r1.valida).toBe(true);
    expect(r2.valida).toBe(false);
    expect(r2.duplicadoEnArchivo).toBe(true);
  });

  it('marca duplicadoExistente cuando el nombre ya está en la base, sin rechazar por sí solo', () => {
    const existentes = new Set([normalizarNombre('Omega-3')]);
    const r = validarFilaCSV({ nombre_canonico: 'Omega-3' }, 2, new Set(), existentes);
    expect(r.duplicadoExistente).toBe(true);
    expect(r.valida).toBe(true); // la ruta decide si lo permite (edición) o no (validado sin autorización)
  });

  it('caracteres especiales en el nombre no rompen la validación', () => {
    const r = validarFilaCSV({ nombre_canonico: 'Cúrcuma (raíz) — 95% curcuminoides' }, 2, new Set(), new Set());
    expect(r.valida).toBe(true);
  });

  it('validarFilasCSV numera las filas humanas empezando en 2 (después del encabezado)', () => {
    const resultados = validarFilasCSV([{ nombre_canonico: 'A' }, { nombre_canonico: 'B' }], new Set());
    expect(resultados.map(r => r.numeroFila)).toEqual([2, 3]);
  });

  it('errores por fila: cada fila inválida trae su propio detalle, sin afectar a las demás', () => {
    const resultados = validarFilasCSV([
      { nombre_canonico: 'Magnesio', dosis_unidad: 'mg' },
      { nombre_canonico: '' },
      { nombre_canonico: 'Zinc', dosis_minima_valor: '100', dosis_maxima_valor: '10' },
    ], new Set());
    expect(resultados[0].valida).toBe(true);
    expect(resultados[1].valida).toBe(false);
    expect(resultados[2].valida).toBe(false);
  });
});

describe('baseConocimiento — exportación CSV', () => {
  it('genera un CSV con encabezado y una fila por principio, con listas unidas por "|"', () => {
    const csv = generarCSVExportacion([{
      nombreCanonico: 'Magnesio', nombreComercial: '', sinonimos: ['Óxido de magnesio', 'Citrato de magnesio'],
      descripcion: 'Mineral', dosisMinima: 200, dosisUsual: 300, dosisMaxima: 400, dosisUnidad: 'mg', dosisFrecuencia: 'noche',
      formaFarmaceutica: 'capsula', capacidadCapsulaMg: 500, sabor: 'neutro', intensidadSabor: 0, solubilidad: 'soluble',
      contraindicaciones: ['Insuficiencia renal grave'], evidenciaNivel: 'B',
    }]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Magnesio');
    expect(csv).toContain('Óxido de magnesio|Citrato de magnesio');
  });

  it('exportación vacía sigue teniendo el encabezado', () => {
    const csv = generarCSVExportacion([]);
    expect(csv).toContain(COLUMNAS_CSV_PRINCIPIOS[0]);
  });

  it('escapa campos con comas o comillas para poder reimportarlos', () => {
    const csv = generarCSVExportacion([{
      nombreCanonico: 'Prueba, con coma', nombreComercial: '', sinonimos: [], descripcion: 'Con "comillas"',
      dosisMinima: null, dosisUsual: null, dosisMaxima: null, dosisUnidad: '', dosisFrecuencia: '',
      formaFarmaceutica: '', capacidadCapsulaMg: null, sabor: '', intensidadSabor: null, solubilidad: '',
      contraindicaciones: [], evidenciaNivel: '',
    }]);
    expect(csv).toContain('"Prueba, con coma"');
    expect(csv).toContain('"Con ""comillas"""');
  });
});

describe('baseConocimiento — principiosValidadosAInfoCatalogo (integración con el motor)', () => {
  function principio(overrides: Partial<PrincipioValidadoParaMotor> = {}): PrincipioValidadoParaMotor {
    return {
      nombreCanonico: 'Magnesio', estado: 'validado', sinonimos: [], capacidadCapsulaMg: 500,
      intensidadSabor: 2, solubilidad: 'soluble', formaFarmaceuticaPreferida: 'capsula',
      incompatibilidadesNombres: [], dosisMaximaMg: 400,
      ...overrides,
    };
  }

  it('sólo incluye principios en estado "validado"', () => {
    const mapa = principiosValidadosAInfoCatalogo([
      principio({ nombreCanonico: 'Magnesio', estado: 'validado' }),
      principio({ nombreCanonico: 'Zinc', estado: 'borrador' }),
      principio({ nombreCanonico: 'Selenio', estado: 'en_revision' }),
      principio({ nombreCanonico: 'Colina', estado: 'archivado' }),
    ]);
    expect(mapa.has(normalizarNombre('Magnesio'))).toBe(true);
    expect(mapa.has(normalizarNombre('Zinc'))).toBe(false);
    expect(mapa.has(normalizarNombre('Selenio'))).toBe(false);
    expect(mapa.has(normalizarNombre('Colina'))).toBe(false);
  });

  it('un principio archivado nunca llega al motor, aunque tenga todos los datos completos', () => {
    const mapa = principiosValidadosAInfoCatalogo([principio({ nombreCanonico: 'Colina', estado: 'archivado', capacidadCapsulaMg: 500 })]);
    expect(mapa.size).toBe(0);
  });

  it('también indexa por cada sinónimo', () => {
    const mapa = principiosValidadosAInfoCatalogo([principio({ nombreCanonico: 'Zinc', sinonimos: ['Zinc-L-carnosina'] })]);
    expect(mapa.has(normalizarNombre('Zinc-L-carnosina'))).toBe(true);
  });

  it('usa la capacidad de cápsula por defecto cuando no está cargada', () => {
    const mapa = principiosValidadosAInfoCatalogo([principio({ capacidadCapsulaMg: null })]);
    expect(mapa.get(normalizarNombre('Magnesio'))!.capacidadCapsulaMg).toBeGreaterThan(0);
  });
});
