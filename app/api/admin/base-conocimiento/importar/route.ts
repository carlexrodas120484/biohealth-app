import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolverUsuarioAutorizado } from '@/lib/adminAuth';
import { parsearFilasCSV, validarFilasCSV, normalizarNombre, type ResultadoValidacionFila } from '@/lib/clinica/baseConocimiento';

const ROLES_AUTORIZADOS = ['medico_titular'] as const;
const TAMANO_MAXIMO_BYTES = 2 * 1024 * 1024;

async function contexto() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };

  const usuario = await resolverUsuarioAutorizado(supabase, user.id, ROLES_AUTORIZADOS);
  if ('error' in usuario) return { error: usuario.error };

  return { supabase, user, tenantId: usuario.tenantId };
}

function dividirLista(valor: string): string[] {
  return valor.split('|').map(v => v.trim()).filter(Boolean);
}

async function persistirFila(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  datos: Record<string, string>,
  principioExistenteId: string | null,
  estadoExistente: string | null,
  sobrescribirValidados: boolean
): Promise<{ ok: true; accion: 'creado' | 'editado' } | { ok: false; mensaje: string }> {
  const esEdicion = Boolean(principioExistenteId);
  if (esEdicion && estadoExistente === 'validado' && !sobrescribirValidados) {
    return { ok: false, mensaje: 'No se puede sobrescribir un principio ya validado sin autorización explícita.' };
  }

  const camposComunes: Record<string, unknown> = {
    nombre_canonico: datos.nombre_canonico,
    nombre_comercial: datos.nombre_comercial || null,
    descripcion: datos.descripcion || null,
    actualizado_por: userId,
  };

  let principioId: string;
  if (esEdicion) {
    principioId = principioExistenteId!;
    if (estadoExistente === 'validado' && sobrescribirValidados) {
      camposComunes.estado = 'en_revision';
      camposComunes.pendiente_validacion = true;
      camposComunes.validado_por = null;
      camposComunes.validado_en = null;
    }
    const { error } = await (supabase.from('principios_activos') as any).update(camposComunes).eq('id', principioId);
    if (error) return { ok: false, mensaje: error.message };
  } else {
    const { data: creado, error } = await (supabase.from('principios_activos') as any).insert({
      ...camposComunes, tenant_id: null, estado: 'borrador', pendiente_validacion: true, creado_por: userId,
    }).select('id').single();
    if (error) return { ok: false, mensaje: error.message };
    principioId = (creado as { id: string }).id;
  }

  const unidad = datos.dosis_unidad || 'mg';
  const dosisFilas: Array<{ tipo: string; valor: number }> = [];
  if (datos.dosis_minima_valor) dosisFilas.push({ tipo: 'minima', valor: Number(datos.dosis_minima_valor) });
  if (datos.dosis_usual_valor) dosisFilas.push({ tipo: 'usual', valor: Number(datos.dosis_usual_valor) });
  if (datos.dosis_maxima_valor) dosisFilas.push({ tipo: 'maxima', valor: Number(datos.dosis_maxima_valor) });

  if (dosisFilas.length > 0) {
    // Una dosis importada por CSV nunca trae una referencia bibliográfica
    // cargada en el mismo archivo, así que siempre queda marcada
    // explícitamente "sin evidencia cargada" — nunca se presenta como
    // validada sólo porque vino de una importación masiva.
    await (supabase.from('dosis_principios') as any).insert(
      dosisFilas.map(d => ({
        principio_id: principioId, tipo: d.tipo, valor: d.valor, unidad,
        frecuencia: datos.dosis_frecuencia || null, sin_evidencia: true, creado_por: userId,
      }))
    );
  }

  if (datos.forma_farmaceutica) {
    await (supabase.from('presentaciones_farmaceuticas') as any).insert({
      principio_id: principioId, forma: datos.forma_farmaceutica,
      capacidad_capsula_mg: datos.capacidad_capsula_mg ? Number(datos.capacidad_capsula_mg) : null,
      preferida: true,
    });
  }

  if (datos.sabor || datos.intensidad_sabor || datos.solubilidad) {
    await (supabase.from('propiedades_organolepticas') as any).insert({
      principio_id: principioId, sabor: datos.sabor || null,
      intensidad_sabor: datos.intensidad_sabor ? Number(datos.intensidad_sabor) : null,
      solubilidad: datos.solubilidad || null,
    });
  }

  const sinonimos = dividirLista(datos.sinonimos ?? '');
  if (sinonimos.length > 0) {
    await (supabase.from('sinonimos_principios') as any).insert(sinonimos.map(s => ({ principio_id: principioId, sinonimo: s })));
  }

  const contraindicaciones = dividirLista(datos.contraindicaciones ?? '');
  if (contraindicaciones.length > 0) {
    await (supabase.from('contraindicaciones_principios') as any).insert(
      contraindicaciones.map(c => ({ principio_id: principioId, contraindicacion: c, severidad: 'moderada' }))
    );
  }

  if (datos.evidencia_nivel) {
    await (supabase.from('evidencia_cientifica') as any).insert({
      principio_id: principioId, nivel_evidencia: datos.evidencia_nivel,
      resumen: 'Cargado por importación CSV; sin referencia bibliográfica vinculada todavía.',
    });
  }

  await (supabase.from('historial_principios_activos') as any).insert({
    principio_id: principioId, accion: esEdicion ? 'editado' : 'creado', realizado_por: userId,
  });

  return { ok: true, accion: esEdicion ? 'editado' : 'creado' };
}

export async function POST(req: NextRequest) {
  const ctx = await contexto();
  if ('error' in ctx) return ctx.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido; se espera multipart/form-data.' }, { status: 422 });
  }

  const archivo = form.get('archivo');
  if (!(archivo instanceof File)) return NextResponse.json({ error: 'Falta el archivo CSV.' }, { status: 422 });
  if (archivo.size === 0) return NextResponse.json({ error: 'El archivo está vacío.' }, { status: 422 });
  if (archivo.size > TAMANO_MAXIMO_BYTES) return NextResponse.json({ error: 'El archivo supera el tamaño máximo permitido (2 MB).' }, { status: 422 });

  const confirmar = form.get('confirmar') === 'true';
  const sobrescribirValidados = form.get('sobrescribirValidados') === 'true';

  let texto: string;
  try {
    texto = await archivo.text();
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo. Verifique que esté codificado en UTF-8.' }, { status: 422 });
  }

  const resultado = parsearFilasCSV(texto);
  if ('error' in resultado) return NextResponse.json({ error: resultado.error }, { status: 422 });

  const { data: existentes, error: errorExistentes } = await ctx.supabase
    .from('principios_activos')
    .select('id, nombre_canonico, estado')
    .or(`tenant_id.is.null,tenant_id.eq.${ctx.tenantId}`);
  if (errorExistentes) return NextResponse.json({ error: errorExistentes.message }, { status: 500 });

  const existentesArr = (existentes ?? []) as Array<{ id: string; nombre_canonico: string; estado: string }>;
  const nombresExistentes = new Set(existentesArr.map(e => normalizarNombre(e.nombre_canonico)));
  const porNombre = new Map(existentesArr.map(e => [normalizarNombre(e.nombre_canonico), e]));

  const filasValidadas: ResultadoValidacionFila[] = validarFilasCSV(resultado.filas, nombresExistentes);

  // Un duplicado contra un principio YA VALIDADO sin autorización explícita es un error de fila, no sólo un aviso.
  for (const fila of filasValidadas) {
    if (fila.duplicadoExistente && !sobrescribirValidados) {
      const existente = porNombre.get(normalizarNombre(fila.datos.nombre_canonico ?? ''));
      if (existente?.estado === 'validado') {
        fila.errores.push({ columna: 'nombre_canonico', valor: fila.datos.nombre_canonico, mensaje: 'Ya existe, validado: requiere autorización explícita para sobrescribir.' });
        fila.valida = false;
      }
    }
  }

  const filasValidas = filasValidadas.filter(f => f.valida);
  const filasInvalidas = filasValidadas.filter(f => !f.valida);

  if (!confirmar) {
    const { data: importacion } = await (ctx.supabase.from('importaciones_catalogo') as any).insert({
      tenant_id: ctx.tenantId, archivo_nombre: archivo.name, importado_por: ctx.user.id,
      filas_totales: filasValidadas.length, filas_validas: filasValidas.length, filas_rechazadas: filasInvalidas.length,
      estado: 'previsualizado',
    }).select('id').single();

    if (importacion && filasInvalidas.length > 0) {
      await (ctx.supabase.from('errores_importacion') as any).insert(
        filasInvalidas.flatMap(f => f.errores.map(e => ({
          importacion_id: (importacion as { id: string }).id, numero_fila: f.numeroFila,
          columna: e.columna, valor: e.valor, mensaje_error: e.mensaje,
        })))
      );
    }

    return NextResponse.json({
      previsualizacion: true,
      filasTotales: filasValidadas.length, filasValidas: filasValidas.length, filasRechazadas: filasInvalidas.length,
      filas: filasValidadas,
    });
  }

  // Importación parcial permitida: se insertan/actualizan las filas
  // válidas aunque haya filas rechazadas, siempre que el llamador ya
  // confirmó explícitamente (confirmar=true).
  let creadas = 0;
  let editadas = 0;
  const erroresPersistencia: Array<{ numeroFila: number; mensaje: string }> = [];

  for (const fila of filasValidas) {
    const existente = porNombre.get(normalizarNombre(fila.datos.nombre_canonico));
    const resultadoFila = await persistirFila(ctx.supabase, ctx.user.id, fila.datos, existente?.id ?? null, existente?.estado ?? null, sobrescribirValidados);
    if (resultadoFila.ok) {
      if (resultadoFila.accion === 'creado') creadas++; else editadas++;
    } else {
      erroresPersistencia.push({ numeroFila: fila.numeroFila, mensaje: resultadoFila.mensaje });
    }
  }

  const totalRechazadas = filasInvalidas.length + erroresPersistencia.length;
  const estadoFinal = totalRechazadas === 0 ? 'confirmado' : (creadas + editadas > 0 ? 'parcial' : 'cancelado');

  const { data: importacion } = await (ctx.supabase.from('importaciones_catalogo') as any).insert({
    tenant_id: ctx.tenantId, archivo_nombre: archivo.name, importado_por: ctx.user.id,
    filas_totales: filasValidadas.length, filas_validas: creadas + editadas, filas_rechazadas: totalRechazadas,
    estado: estadoFinal,
  }).select('id').single();

  if (importacion) {
    const todosLosErrores = [
      ...filasInvalidas.flatMap(f => f.errores.map(e => ({ numero_fila: f.numeroFila, columna: e.columna, valor: e.valor, mensaje_error: e.mensaje }))),
      ...erroresPersistencia.map(e => ({ numero_fila: e.numeroFila, columna: null, valor: null, mensaje_error: e.mensaje })),
    ];
    if (todosLosErrores.length > 0) {
      await (ctx.supabase.from('errores_importacion') as any).insert(
        todosLosErrores.map(e => ({ importacion_id: (importacion as { id: string }).id, ...e }))
      );
    }
  }

  return NextResponse.json({
    previsualizacion: false, creadas, editadas, filasRechazadas: totalRechazadas,
    importacionId: (importacion as { id: string } | null)?.id ?? null,
  });
}
