import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolverTenantId } from '@/lib/tenant';
import { esUuidValido } from '@/lib/validation/id';

type ContextoSeguridad = {
  medicamentos_actuales?: string | null;
  alergias?: string | null;
  embarazo?: boolean | null;
  lactancia?: boolean | null;
  deterioro_renal?: boolean | null;
  deterioro_hepatico?: boolean | null;
};

type ResolucionAlerta = {
  principio_id: string;
  estado_resolucion: 'pendiente' | 'resuelta';
  resolucion_tipo: 'aceptada_justificada' | 'descartada' | null;
  justificacion_resolucion: string | null;
  resuelto_por: string | null;
  resolved_at: string | null;
};

type AlertaSeguridad = {
  principio_id: string;
  nombre: string;
  nivel: 'permitido' | 'requiere_revision' | 'bloqueado';
  motivo: string;
  datos_disparadores: Record<string, unknown>;
  resolucion?: ResolucionAlerta | null;
};

const ResolverSchema = z.object({
  principioId: z.string().uuid(),
  tipo: z.enum(['aceptada_justificada', 'descartada']),
  justificacion: z.string().trim().min(5, 'La justificación clínica es obligatoria.').max(2000),
});

async function cargarContextoPaciente(id: string) {
  if (!esUuidValido(id)) return { error: NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 }) };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };

  const tenant = await resolverTenantId(supabase, user.id);
  if ('error' in tenant) return { error: tenant.error };

  const { data: paciente } = await supabase
    .from('pacientes').select('id')
    .eq('id', id).eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null).maybeSingle();

  if (!paciente) return { error: NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 }) };

  const { data: consulta, error: errorConsulta } = await supabase
    .from('consultas')
    .select('id, contexto_seguridad')
    .eq('paciente_id', id)
    .eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errorConsulta) return { error: NextResponse.json({ error: errorConsulta.message }, { status: 500 }) };

  return {
    supabase, user, tenantId: tenant.tenantId,
    consulta: consulta as { id: string; contexto_seguridad: ContextoSeguridad | null } | null,
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await cargarContextoPaciente(id);
  if ('error' in ctx) return ctx.error;

  if (!ctx.consulta) {
    return NextResponse.json({
      consultaId: null, contexto: null, alertas: [],
      advertencia: 'No hay una consulta activa con contexto de seguridad estructurado.',
    });
  }

  const { data: alertas, error: errorAlertas } = await (ctx.supabase as any)
    .rpc('alertas_seguridad_contextual', { p_consulta_id: ctx.consulta.id });

  if (errorAlertas) return NextResponse.json({ error: errorAlertas.message }, { status: 500 });

  const alertasBase = (alertas ?? []) as AlertaSeguridad[];
  const principioIds = alertasBase.map(a => a.principio_id);
  let resoluciones: ResolucionAlerta[] = [];

  if (principioIds.length > 0) {
    const { data, error } = await (ctx.supabase as any)
      .from('evaluaciones_seguridad_formulacion')
      .select('principio_id, estado_resolucion, resolucion_tipo, justificacion_resolucion, resuelto_por, resolved_at, created_at')
      .eq('consulta_id', ctx.consulta.id)
      .eq('tenant_id', ctx.tenantId)
      .in('principio_id', principioIds)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const vistos = new Set<string>();
    resoluciones = (data ?? []).filter((fila: ResolucionAlerta) => {
      if (vistos.has(fila.principio_id)) return false;
      vistos.add(fila.principio_id);
      return true;
    });
  }

  const resolucionPorPrincipio = new Map(resoluciones.map(r => [r.principio_id, r]));
  const alertasConResolucion = alertasBase.map(a => ({
    ...a,
    resolucion: resolucionPorPrincipio.get(a.principio_id) ?? null,
  }));

  return NextResponse.json({
    consultaId: ctx.consulta.id,
    contexto: ctx.consulta.contexto_seguridad ?? null,
    alertas: alertasConResolucion,
    advertencia:
      'Apoyo a la decisión clínica: las alertas no sustituyen la revisión médica ni garantizan ausencia de interacciones no catalogadas.',
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await cargarContextoPaciente(id);
  if ('error' in ctx) return ctx.error;
  if (!ctx.consulta) return NextResponse.json({ error: 'No hay consulta activa para resolver la alerta.' }, { status: 409 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 422 }); }

  const parsed = ResolverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos de resolución inválidos.' },
      { status: 422 },
    );
  }

  const { data, error } = await (ctx.supabase as any).rpc('resolver_alerta_seguridad_formulacion', {
    p_consulta_id: ctx.consulta.id,
    p_principio_id: parsed.data.principioId,
    p_resolucion_tipo: parsed.data.tipo,
    p_justificacion: parsed.data.justificacion,
    p_usuario_id: ctx.user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, resolucion: data });
}