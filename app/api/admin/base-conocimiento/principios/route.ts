import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolverUsuarioAutorizado } from '@/lib/adminAuth';
import { PrincipioActivoInputSchema, EstadoPrincipioSchema } from '@/lib/validation/baseConocimiento';
import { normalizarNombre } from '@/lib/clinica/baseConocimiento';

const ROLES_AUTORIZADOS = ['medico_titular'] as const;

async function contexto(authOnly = false) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };
  if (authOnly) return { supabase, user, tenantId: null as unknown as string, rol: null as unknown as string };

  const usuario = await resolverUsuarioAutorizado(supabase, user.id, ROLES_AUTORIZADOS);
  if ('error' in usuario) return { error: usuario.error };

  return { supabase, user, tenantId: usuario.tenantId, rol: usuario.rol };
}

export async function GET(req: NextRequest) {
  const ctx = await contexto();
  if ('error' in ctx) return ctx.error;

  const params = req.nextUrl.searchParams;
  const q = params.get('q')?.trim() ?? '';
  const estadoParam = params.get('estado');
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);
  const porPagina = Math.min(100, Math.max(1, Number(params.get('porPagina')) || 20));

  let query = ctx.supabase
    .from('principios_activos')
    .select('id, nombre_canonico, nombre_comercial, estado, version, pendiente_validacion, validado_en, updated_at', { count: 'exact' })
    .or(`tenant_id.is.null,tenant_id.eq.${ctx.tenantId}`)
    .order('nombre_canonico', { ascending: true })
    .range((pagina - 1) * porPagina, pagina * porPagina - 1);

  if (q) query = query.ilike('nombre_canonico', `%${q}%`);

  const estadoParsed = estadoParam ? EstadoPrincipioSchema.safeParse(estadoParam) : null;
  if (estadoParsed?.success) query = query.eq('estado', estadoParsed.data);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ principios: data ?? [], total: count ?? 0, pagina, porPagina });
}

export async function POST(req: NextRequest) {
  const ctx = await contexto();
  if ('error' in ctx) return ctx.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 422 });
  }

  const parsed = PrincipioActivoInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos del principio activo inválidos.', detalles: parsed.error.flatten() }, { status: 422 });
  }
  const d = parsed.data;

  // RLS de sinonimos_principios ya filtra por el tenant del principio
  // dueño (o catálogo compartido), así que no hace falta repetir ese
  // join acá: basta con leer la tabla tal cual la deja ver RLS.
  const [{ data: existentes, error: errorExistentes }, { data: sinonimosExistentes, error: errorSinonimos }] = await Promise.all([
    ctx.supabase.from('principios_activos').select('nombre_canonico').or(`tenant_id.is.null,tenant_id.eq.${ctx.tenantId}`),
    ctx.supabase.from('sinonimos_principios').select('sinonimo, principio_id'),
  ]);
  if (errorExistentes) return NextResponse.json({ error: errorExistentes.message }, { status: 500 });
  if (errorSinonimos) return NextResponse.json({ error: errorSinonimos.message }, { status: 500 });

  const nombresExistentes = new Set(((existentes ?? []) as Array<{ nombre_canonico: string }>).map(e => normalizarNombre(e.nombre_canonico)));
  const sinonimosExistentesSet = new Set(((sinonimosExistentes ?? []) as Array<{ sinonimo: string }>).map(s => normalizarNombre(s.sinonimo)));

  const normalizado = normalizarNombre(d.nombreCanonico);
  if (nombresExistentes.has(normalizado) || sinonimosExistentesSet.has(normalizado)) {
    return NextResponse.json({ error: `Ya existe un principio activo con el nombre "${d.nombreCanonico}".` }, { status: 409 });
  }

  const sinonimosNormalizados = d.sinonimos.map(normalizarNombre);
  const sinonimoDuplicadoEnLote = sinonimosNormalizados.some((s, i) => sinonimosNormalizados.indexOf(s) !== i);
  const sinonimoChocaConExistente = sinonimosNormalizados.some(s => nombresExistentes.has(s) || sinonimosExistentesSet.has(s) || s === normalizado);
  if (sinonimoDuplicadoEnLote || sinonimoChocaConExistente) {
    return NextResponse.json({ error: 'Uno de los sinónimos está duplicado o ya pertenece a otro principio activo.' }, { status: 409 });
  }

  const { data: creado, error: errorCrear } = await (ctx.supabase.from('principios_activos') as any).insert({
    tenant_id: null,
    nombre_canonico: d.nombreCanonico,
    nombre_comercial: d.nombreComercial ?? null,
    descripcion: d.descripcion ?? null,
    mecanismo_accion: d.mecanismoAccion ?? null,
    funciones_clinicas: d.funcionesClinicas,
    sistemas_relacionados: d.sistemasRelacionados,
    limite_edad_min_anios: d.limiteEdadMinAnios ?? null,
    limite_edad_max_anios: d.limiteEdadMaxAnios ?? null,
    limite_peso_min_kg: d.limitePesoMinKg ?? null,
    limite_peso_max_kg: d.limitePesoMaxKg ?? null,
    limite_renal: d.limiteRenal ?? null,
    limite_hepatico: d.limiteHepatico ?? null,
    contraindicado_embarazo: d.contraindicadoEmbarazo ?? null,
    contraindicado_lactancia: d.contraindicadoLactancia ?? null,
    contraindicado_oncologico: d.contraindicadoOncologico ?? null,
    precaucion_anticoagulacion: d.precaucionAnticoagulacion,
    precaucion_antihipertensivos: d.precaucionAntihipertensivos,
    precaucion_hipoglucemiantes: d.precaucionHipoglucemiantes,
    estado: 'borrador',
    pendiente_validacion: true,
    creado_por: ctx.user.id,
  }).select('id').single();

  if (errorCrear) return NextResponse.json({ error: errorCrear.message }, { status: 500 });
  const principioId = (creado as { id: string }).id;

  const inserciones: Promise<unknown>[] = [];

  if (d.sinonimos.length > 0) {
    inserciones.push((ctx.supabase.from('sinonimos_principios') as any).insert(
      d.sinonimos.map(s => ({ principio_id: principioId, sinonimo: s }))
    ));
  }
  if (d.dosis.length > 0) {
    inserciones.push((ctx.supabase.from('dosis_principios') as any).insert(
      d.dosis.map(dosis => ({
        principio_id: principioId, tipo: dosis.tipo, valor: dosis.valor, unidad: dosis.unidad,
        frecuencia: dosis.frecuencia ?? null, duracion_habitual: dosis.duracionHabitual ?? null,
        referencia_id: dosis.referenciaId ?? null, sin_evidencia: dosis.sinEvidencia, notas: dosis.notas ?? null,
        creado_por: ctx.user.id,
      }))
    ));
  }
  if (d.presentaciones.length > 0) {
    inserciones.push((ctx.supabase.from('presentaciones_farmaceuticas') as any).insert(
      d.presentaciones.map(p => ({
        principio_id: principioId, forma: p.forma, capacidad_capsula_mg: p.capacidadCapsulaMg ?? null,
        preferida: p.preferida, presentacion_comercial_obligatoria: p.presentacionComercialObligatoria, notas: p.notas ?? null,
      }))
    ));
  }
  if (d.propiedadesOrganolepticas) {
    const pr = d.propiedadesOrganolepticas;
    inserciones.push((ctx.supabase.from('propiedades_organolepticas') as any).insert({
      principio_id: principioId, sabor: pr.sabor ?? null, intensidad_sabor: pr.intensidadSabor ?? null,
      olor: pr.olor ?? null, solubilidad: pr.solubilidad ?? null, estabilidad: pr.estabilidad ?? null, notas: pr.notas ?? null,
    }));
  }
  if (d.indicaciones.length > 0) {
    inserciones.push((ctx.supabase.from('indicaciones_principios') as any).insert(
      d.indicaciones.map(i => ({ principio_id: principioId, indicacion: i.indicacion, sistema_relacionado: i.sistemaRelacionado ?? null }))
    ));
  }
  if (d.contraindicaciones.length > 0) {
    inserciones.push((ctx.supabase.from('contraindicaciones_principios') as any).insert(
      d.contraindicaciones.map(c => ({ principio_id: principioId, contraindicacion: c.contraindicacion, severidad: c.severidad }))
    ));
  }
  if (d.interacciones.length > 0) {
    inserciones.push((ctx.supabase.from('interacciones_principios') as any).insert(
      d.interacciones.map(i => ({
        principio_id: principioId, principio_relacionado_id: i.principioRelacionadoId ?? null,
        sustancia_externa: i.sustanciaExterna ?? null, tipo: i.tipo ?? null, descripcion: i.descripcion, severidad: i.severidad,
      }))
    ));
  }
  if (d.incompatibilidades.length > 0) {
    inserciones.push((ctx.supabase.from('incompatibilidades_formulacion') as any).insert(
      d.incompatibilidades.map(i => ({ principio_id: principioId, principio_incompatible_id: i.principioIncompatibleId, motivo: i.motivo ?? null }))
    ));
  }
  if (d.evidencia.length > 0) {
    inserciones.push((ctx.supabase.from('evidencia_cientifica') as any).insert(
      d.evidencia.map(e => ({ principio_id: principioId, nivel_evidencia: e.nivelEvidencia, resumen: e.resumen ?? null, referencia_id: e.referenciaId ?? null }))
    ));
  }
  inserciones.push((ctx.supabase.from('historial_principios_activos') as any).insert({
    principio_id: principioId, accion: 'creado', valor_nuevo: 'borrador', realizado_por: ctx.user.id,
  }));

  await Promise.all(inserciones);

  return NextResponse.json({ ok: true, id: principioId }, { status: 201 });
}
