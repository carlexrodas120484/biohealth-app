import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { crearSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { POST as IMPORTAR } from '@/app/api/admin/base-conocimiento/importar/route';
import { GET as EXPORTAR } from '@/app/api/admin/base-conocimiento/exportar/route';
import { GET as PLANTILLA } from '@/app/api/admin/base-conocimiento/plantilla/route';
import { COLUMNAS_CSV_PRINCIPIOS } from '@/lib/clinica/baseConocimiento';

const USUARIO = { id: 'auth-1' };
const TITULAR_ROW = { data: { tenant_id: 'tenant-1', rol: 'medico_titular' }, error: null };
const INVITADO_ROW = { data: { tenant_id: 'tenant-1', rol: 'medico_invitado' }, error: null };

function usarMock(user: { id: string } | null, queue: any[]) {
  const { client, from } = crearSupabaseMock(user, queue);
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client);
  return from;
}

function csvReq(csv: string, opciones: { confirmar?: boolean; sobrescribirValidados?: boolean } = {}) {
  const form = new FormData();
  form.set('archivo', new File([csv], 'principios.csv', { type: 'text/csv' }));
  if (opciones.confirmar !== undefined) form.set('confirmar', String(opciones.confirmar));
  if (opciones.sobrescribirValidados !== undefined) form.set('sobrescribirValidados', String(opciones.sobrescribirValidados));
  return new NextRequest('http://localhost/api/admin/base-conocimiento/importar', { method: 'POST', body: form });
}

const ENCABEZADO = COLUMNAS_CSV_PRINCIPIOS.join(',');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /importar — seguridad', () => {
  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await IMPORTAR(csvReq(`${ENCABEZADO}\nMagnesio,,,,,,,,,,,,,,,`));
    expect(res.status).toBe(401);
  });

  it('devuelve 403 si el usuario no tiene rol autorizado', async () => {
    usarMock(USUARIO, [INVITADO_ROW]);
    const res = await IMPORTAR(csvReq(`${ENCABEZADO}\nMagnesio,,,,,,,,,,,,,,,`));
    expect(res.status).toBe(403);
  });

  it('devuelve 422 si falta el archivo', async () => {
    usarMock(USUARIO, [TITULAR_ROW]);
    const form = new FormData();
    const req = new NextRequest('http://localhost/x', { method: 'POST', body: form });
    const res = await IMPORTAR(req);
    expect(res.status).toBe(422);
  });
});

describe('POST /importar — validación del CSV', () => {
  it('devuelve 422 si faltan encabezados obligatorios (nombre_canonico)', async () => {
    usarMock(USUARIO, [TITULAR_ROW]);
    const res = await IMPORTAR(csvReq('nombre_comercial,descripcion\nAlgo,Desc'));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/nombre_canonico/);
  });

  it('devuelve 422 si el CSV está vacío', async () => {
    usarMock(USUARIO, [TITULAR_ROW]);
    const res = await IMPORTAR(csvReq(''));
    expect(res.status).toBe(422);
  });

  it('soporta caracteres especiales y acentos (UTF-8) en la previsualización', async () => {
    const from = usarMock(USUARIO, [TITULAR_ROW, { data: [], error: null }, { data: { id: 'imp-1' }, error: null }]);
    const fila = `"Árnica, montaña",,,"Descripción con ñ y comillas ""dobles""",,,,,,,,,,,,`;
    const res = await IMPORTAR(csvReq(`${ENCABEZADO}\n${fila}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.previsualizacion).toBe(true);
    expect(body.filas[0].datos.nombre_canonico).toBe('Árnica, montaña');
    expect(body.filas[0].valida).toBe(true);
    void from;
  });

  it('marca por fila los errores de datos (dosis inválida, unidad inválida, max<min)', async () => {
    usarMock(USUARIO, [TITULAR_ROW, { data: [], error: null }, { data: { id: 'imp-1' }, error: null }]);
    const filas = [
      'Fila Uno,,,,abc,,,,,,,,,,,',
      'Fila Dos,,,,,,,kilogramos,,,,,,,,',
      'Fila Tres,,,,500,,100,mg,,,,,,,,',
    ].join('\n');
    const res = await IMPORTAR(csvReq(`${ENCABEZADO}\n${filas}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filasRechazadas).toBe(3);
    expect(body.filas[0].errores.length).toBeGreaterThan(0);
    expect(body.filas[1].errores[0].mensaje).toMatch(/Unidad inválida/);
    expect(body.filas[2].errores[0].mensaje).toMatch(/dosis máxima/);
  });

  it('detecta un nombre duplicado dentro del mismo archivo', async () => {
    usarMock(USUARIO, [TITULAR_ROW, { data: [], error: null }, { data: { id: 'imp-1' }, error: null }]);
    const filas = ['Magnesio,,,,,,,,,,,,,,,', 'magnesio,,,,,,,,,,,,,,,'].join('\n');
    const res = await IMPORTAR(csvReq(`${ENCABEZADO}\n${filas}`));
    const body = await res.json();
    expect(body.filas[1].duplicadoEnArchivo).toBe(true);
    expect(body.filas[1].valida).toBe(false);
  });
});

describe('POST /importar — previsualización vs confirmación, e importación parcial', () => {
  it('en modo previsualización (confirmar=false) no inserta ni actualiza principios', async () => {
    const from = usarMock(USUARIO, [TITULAR_ROW, { data: [], error: null }, { data: { id: 'imp-1' }, error: null }]);
    const res = await IMPORTAR(csvReq(`${ENCABEZADO}\nMagnesio,,,,,,,,,,,,,,,`, { confirmar: false }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.previsualizacion).toBe(true);
    const tablas = from.mock.calls.map((c: unknown[]) => c[0]);
    expect(tablas).not.toContain('dosis_principios');
  });

  it('con confirmar=true importa sólo las filas válidas (importación parcial) y registra la importación', async () => {
    const from = usarMock(USUARIO, [
      TITULAR_ROW,
      { data: [], error: null },
      { data: { id: 'nuevo-1' }, error: null },
      { data: null, error: null },
      { data: { id: 'importacion-1' }, error: null },
      { data: null, error: null },
    ]);
    const filas = ['Magnesio,,,,,,,,,,,,,,,', ',,,,,,,,,,,,,,,'].join('\n');
    const res = await IMPORTAR(csvReq(`${ENCABEZADO}\n${filas}`, { confirmar: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.previsualizacion).toBe(false);
    expect(body.creadas).toBe(1);
    expect(body.filasRechazadas).toBe(1);
    const tablas = from.mock.calls.map((c: unknown[]) => c[0]);
    expect(tablas).toContain('importaciones_catalogo');
    expect(tablas).toContain('errores_importacion');
  });

  it('no sobrescribe un principio ya validado sin autorización explícita', async () => {
    usarMock(USUARIO, [
      TITULAR_ROW,
      { data: [{ id: 'existente-1', nombre_canonico: 'Magnesio', estado: 'validado' }], error: null },
      { data: { id: 'importacion-1' }, error: null },
    ]);
    const res = await IMPORTAR(csvReq(`${ENCABEZADO}\nMagnesio,,,,,,,,,,,,,,,`, { confirmar: true, sobrescribirValidados: false }));
    const body = await res.json();
    expect(body.creadas).toBe(0);
    expect(body.editadas).toBe(0);
    expect(body.filasRechazadas).toBe(1);
  });

  it('permite sobrescribir un principio validado cuando se autoriza explícitamente', async () => {
    usarMock(USUARIO, [
      TITULAR_ROW,
      { data: [{ id: 'existente-1', nombre_canonico: 'Magnesio', estado: 'validado' }], error: null },
      { data: null, error: null },
      { data: { id: 'importacion-1' }, error: null },
    ]);
    const res = await IMPORTAR(csvReq(`${ENCABEZADO}\nMagnesio,,,,,,,,,,,,,,,`, { confirmar: true, sobrescribirValidados: true }));
    const body = await res.json();
    expect(body.editadas).toBe(1);
  });
});

describe('GET /plantilla — descarga de plantilla CSV', () => {
  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await PLANTILLA();
    expect(res.status).toBe(401);
  });

  it('devuelve la plantilla con encabezados y BOM UTF-8', async () => {
    usarMock(USUARIO, [TITULAR_ROW]);
    const res = await PLANTILLA();
    expect(res.status).toBe(200);
    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(buffer.toString('utf-8')).toContain('nombre_canonico');
  });
});

describe('GET /exportar — exportación CSV', () => {
  it('devuelve 401 si no hay usuario autenticado', async () => {
    usarMock(null, []);
    const res = await EXPORTAR();
    expect(res.status).toBe(401);
  });

  it('devuelve 403 si el usuario no tiene rol autorizado', async () => {
    usarMock(USUARIO, [INVITADO_ROW]);
    const res = await EXPORTAR();
    expect(res.status).toBe(403);
  });

  it('exporta un CSV vacío (sólo encabezado) cuando no hay principios', async () => {
    usarMock(USUARIO, [TITULAR_ROW, { data: [], error: null }]);
    const res = await EXPORTAR();
    expect(res.status).toBe(200);
    const texto = await res.text();
    expect(texto.replace(/^﻿/, '').trim()).toBe(ENCABEZADO);
  });

  it('exporta principios existentes con sus datos relacionados', async () => {
    usarMock(USUARIO, [
      TITULAR_ROW,
      { data: [{ id: 'p1', nombre_canonico: 'Magnesio', nombre_comercial: null, descripcion: 'Mineral' }], error: null },
      { data: [{ principio_id: 'p1', sinonimo: 'Mg' }], error: null },
      { data: [{ principio_id: 'p1', tipo: 'usual', valor: 300, unidad: 'mg', frecuencia: 'diaria' }], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [{ principio_id: 'p1', contraindicacion: 'Insuficiencia renal' }], error: null },
      { data: [], error: null },
    ]);
    const res = await EXPORTAR();
    expect(res.status).toBe(200);
    const texto = await res.text();
    expect(texto).toContain('Magnesio');
    expect(texto).toContain('Mg');
    expect(texto).toContain('Insuficiencia renal');
  });
});
