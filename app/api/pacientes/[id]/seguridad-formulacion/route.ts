import { NextResponse } from 'next/server';
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
  contexto_actualizado_en?: string | null;
};

type AlertaSeguridad = {
  principio_id: string;
  nombre: string;
  nivel: 'permitido' | 'requiere_revision' | 'bloqueado';
  motivo: string;
  datos_disparadores: Record<string, unknown>;
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esUuidValido(id)) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const tenant = await resolverTenantId(supabase, user.id);
  if ('error' in tenant) return tenant.error;

  const { data: paciente } = await supabase
    .from('pacientes')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });

  const { data: consulta, error: errorConsulta } = await supabase
    .from('consultas')
    .select('id, contexto_seguridad')
    .eq('paciente_id', id)
    .eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errorConsulta) return NextResponse.json({ error: errorConsulta.message }, { status: 500 });

  if (!consulta) {
    return NextResponse.json({
      consultaId: null,
      contexto: null,
      alertas: [],
      advertencia: 'No hay una consulta activa con contexto de seguridad estructurado.',
    });
  }

  const consultaActual = consulta as { id: string; contexto_seguridad: ContextoSeguridad | null };

  const { data: alertas, error: errorAlertas } = await (supabase as any)
    .rpc('alertas_seguridad_contextual', { p_consulta_id: consultaActual.id });

  if (errorAlertas) return NextResponse.json({ error: errorAlertas.message }, { status: 500 });

  return NextResponse.json({
    consultaId: consultaActual.id,
    contexto: consultaActual.contexto_seguridad ?? null,
    alertas: (alertas ?? []) as AlertaSeguridad[],
    advertencia:
      'Apoyo a la decisiÃ³n clÃ­nica: las alertas no sustituyen la revisiÃ³n mÃ©dica ni garantizan ausencia de interacciones no catalogadas.',
  });
}

