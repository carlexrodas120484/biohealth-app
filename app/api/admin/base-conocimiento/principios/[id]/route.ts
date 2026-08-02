import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolverUsuarioAutorizado } from '@/lib/adminAuth';
import { esUuidValido } from '@/lib/validation/id';
import { PrincipioActivoBaseSchema, TransicionEstadoSchema, type EstadoPrincipio } from '@/lib/validation/baseConocimiento';

const ROLES_AUTORIZADOS = ['medico_titular'] as const;

async function contexto() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };

  const usuario = await resolverUsuarioAutorizado(supabase, user.id, ROLES_AUTORIZADOS);
  if ('error' in usuario) return { error: usuario.error };

  return { supabase, user, tenantId: usuario.tenantId };
}

/** Transiciones de estado permitidas — nunca se salta a 'validado' desde 'borrador' sin pasar por revisión. */
const TRANSICIONES_VALIDAS: Record<EstadoPrincipio, EstadoPrincipio[]> = {
  borrador: ['en_revision', 'archivado'],
  en_revision: ['validado', 'borrador', 'archivado'],
  validado: ['archivado'],
  archivado: ['borrador'],
};
const ACCION_POR_ESTADO: Record<EstadoPrincipio, string> = {
  borrador: 'restaurado', en_revision: 'revisado', validado: 'validado', archivado: 'archivado',
};

async function cargarPrincipio(supabase: Awaited<ReturnType<typeof createClient>>, id: string, tenantId: string) {
  const { data, error } = await supabase
    .from('principios_activos')
    .select('*')
    .eq('id', id)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; estado: EstadoPrincipio; nombre_canonico: string } | null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esUuidValido(id)) return NextResponse.json({ error: 'Principio no encontrado.' }, { status: 404 });
  const ctx = await contexto();
  if ('error' in ctx) return ctx.error;

  const principio = await cargarPrincipio(ctx.supabase, id, ctx.tenantId).catch(e => {
    throw e;
  });
  if (!principio) return NextResponse.json({ error: 'Principio no encontrado.' }, { status: 404 });

  const [sinonimos, dosis, presentaciones, propiedades, indicaciones, contraindicaciones, interacciones, incompatibilidades, evidencia] = await Promise.all([
    ctx.supabase.from('sinonimos_principios').select('*').eq('principio_id', id),
    ctx.supabase.from('dosis_principios').select('*').eq('principio_id', id),
    ctx.supabase.from('presentaciones_farmaceuticas').select('*').eq('principio_id', id),
    ctx.supabase.from('propiedades_organolepticas').select('*').eq('principio_id', id).maybeSingle(),
    ctx.supabase.from('indicaciones_principios').select('*').eq('principio_id', id),
    ctx.supabase.from('contraindicaciones_principios').select('*').eq('principio_id', id),
    ctx.supabase.from('interacciones_principios').select('*').eq('principio_id', id),
    ctx.supabase.from('incompatibilidades_formulacion').select('*, principio_incompatible:principios_activos!incompatibilidades_formulacion_principio_incompatible_id_fkey(nombre_canonico)').eq('principio_id', id),
    ctx.supabase.from('evidencia_cientifica').select('*, referencia:referencias_bibliograficas(*)').eq('principio_id', id),
  ]);

  return NextResponse.json({
    principio,
    sinonimos: sinonimos.data ?? [],
    dosis: dosis.data ?? [],
    presentaciones: presentaciones.data ?? [],
    propiedades: propiedades.data ?? null,
    indicaciones: indicaciones.data ?? [],
    contraindicaciones: contraindicaciones.data ?? [],
    interacciones: interacciones.data ?? [],
    incompatibilidades: incompatibilidades.data ?? [],
    evidencia: evidencia.data ?? [],
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esUuidValido(id)) return NextResponse.json({ error: 'Principio no encontrado.' }, { status: 404 });
  const ctx = await contexto();
  if ('error' in ctx) return ctx.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 422 });
  }

  const principio = await cargarPrincipio(ctx.supabase, id, ctx.tenantId).catch(e => { throw e; });
  if (!principio) return NextResponse.json({ error: 'Principio no encontrado.' }, { status: 404 });

  const cuerpo = (body ?? {}) as { transicion?: unknown; campos?: unknown; forzarSobrescritura?: boolean };

  // ---- Transición de estado (revisar / validar / archivar / restaurar) ----
  if (cuerpo.transicion) {
    const parsed = TransicionEstadoSchema.safeParse(cuerpo.transicion);
    if (!parsed.success) return NextResponse.json({ error: 'Transición de estado inválida.' }, { status: 422 });

    const permitidas = TRANSICIONES_VALIDAS[principio.estado] ?? [];
    if (!permitidas.includes(parsed.data.estado)) {
      return NextResponse.json({ error: `No se puede pasar de "${principio.estado}" a "${parsed.data.estado}".` }, { status: 409 });
    }

    const actualizacion: Record<string, unknown> = { estado: parsed.data.estado, actualizado_por: ctx.user.id };
    if (parsed.data.estado === 'en_revision') { actualizacion.revisado_por = ctx.user.id; actualizacion.fecha_revision = new Date().toISOString().slice(0, 10); }
    if (parsed.data.estado === 'validado') { actualizacion.validado_por = ctx.user.id; actualizacion.validado_en = new Date().toISOString(); actualizacion.pendiente_validacion = false; }
    if (parsed.data.estado === 'borrador') { actualizacion.pendiente_validacion = true; actualizacion.validado_por = null; actualizacion.validado_en = null; }

    const { error } = await (ctx.supabase.from('principios_activos') as any).update(actualizacion).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await (ctx.supabase.from('historial_principios_activos') as any).insert({
      principio_id: id, accion: ACCION_POR_ESTADO[parsed.data.estado], campo_modificado: 'estado',
      valor_anterior: principio.estado, valor_nuevo: parsed.data.estado, realizado_por: ctx.user.id,
    });

    return NextResponse.json({ ok: true, estado: parsed.data.estado });
  }

  // ---- Edición de campos ----
  if (cuerpo.campos) {
    if (principio.estado === 'validado' && !cuerpo.forzarSobrescritura) {
      return NextResponse.json({ error: 'Este principio ya está validado. Confirme explícitamente para sobrescribirlo (vuelve a quedar en revisión).' }, { status: 409 });
    }

    const parsed = PrincipioActivoBaseSchema.partial().safeParse(cuerpo.campos);
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos.', detalles: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;

    const actualizacion: Record<string, unknown> = { actualizado_por: ctx.user.id, version: undefined };
    if (d.nombreCanonico !== undefined) actualizacion.nombre_canonico = d.nombreCanonico;
    if (d.nombreComercial !== undefined) actualizacion.nombre_comercial = d.nombreComercial;
    if (d.descripcion !== undefined) actualizacion.descripcion = d.descripcion;
    if (d.mecanismoAccion !== undefined) actualizacion.mecanismo_accion = d.mecanismoAccion;
    if (d.funcionesClinicas !== undefined) actualizacion.funciones_clinicas = d.funcionesClinicas;
    if (d.sistemasRelacionados !== undefined) actualizacion.sistemas_relacionados = d.sistemasRelacionados;
    if (d.limiteEdadMinAnios !== undefined) actualizacion.limite_edad_min_anios = d.limiteEdadMinAnios;
    if (d.limiteEdadMaxAnios !== undefined) actualizacion.limite_edad_max_anios = d.limiteEdadMaxAnios;
    if (d.limitePesoMinKg !== undefined) actualizacion.limite_peso_min_kg = d.limitePesoMinKg;
    if (d.limitePesoMaxKg !== undefined) actualizacion.limite_peso_max_kg = d.limitePesoMaxKg;
    if (d.limiteRenal !== undefined) actualizacion.limite_renal = d.limiteRenal;
    if (d.limiteHepatico !== undefined) actualizacion.limite_hepatico = d.limiteHepatico;
    if (d.contraindicadoEmbarazo !== undefined) actualizacion.contraindicado_embarazo = d.contraindicadoEmbarazo;
    if (d.contraindicadoLactancia !== undefined) actualizacion.contraindicado_lactancia = d.contraindicadoLactancia;
    if (d.contraindicadoOncologico !== undefined) actualizacion.contraindicado_oncologico = d.contraindicadoOncologico;
    if (d.precaucionAnticoagulacion !== undefined) actualizacion.precaucion_anticoagulacion = d.precaucionAnticoagulacion;
    if (d.precaucionAntihipertensivos !== undefined) actualizacion.precaucion_antihipertensivos = d.precaucionAntihipertensivos;
    if (d.precaucionHipoglucemiantes !== undefined) actualizacion.precaucion_hipoglucemiantes = d.precaucionHipoglucemiantes;
    delete actualizacion.version;

    // Editar un principio validado lo vuelve a poner en revisión: la
    // validación anterior ya no aplica a datos que cambiaron.
    if (principio.estado === 'validado' && cuerpo.forzarSobrescritura) {
      actualizacion.estado = 'en_revision';
      actualizacion.pendiente_validacion = true;
      actualizacion.validado_por = null;
      actualizacion.validado_en = null;
    }

    const { error } = await (ctx.supabase.from('principios_activos') as any).update(actualizacion).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await (ctx.supabase.from('historial_principios_activos') as any).insert({
      principio_id: id, accion: 'editado', realizado_por: ctx.user.id,
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Nada para actualizar: envíe "transicion" o "campos".' }, { status: 422 });
}
