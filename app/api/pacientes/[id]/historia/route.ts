import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calcularPuntajes } from '@/lib/clinica/cuestionario';
import { HistoriaClinicaSchema, RespuestasScreeningSchema } from '@/lib/validation/historia';
import { resolverTenantId } from '@/lib/tenant';
import { esUuidValido } from '@/lib/validation/id';

function pacienteNoEncontrado() {
  return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
}

async function contexto(pacienteId: string) {
  if (!esUuidValido(pacienteId)) return { error: pacienteNoEncontrado() };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };

  const tenant = await resolverTenantId(supabase, user.id);
  if ('error' in tenant) return { error: tenant.error };

  // Confirma que el paciente exista, esté activo (deleted_at is null) y
  // pertenezca al tenant, antes de tocar su historia clínica.
  const { data: paciente, error: errorPaciente } = await supabase
    .from('pacientes')
    .select('id')
    .eq('id', pacienteId)
    .eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (errorPaciente) {
    return { error: NextResponse.json({ error: errorPaciente.message }, { status: 500 }) };
  }
  if (!paciente) return { error: pacienteNoEncontrado() };

  return { supabase, tenantId: tenant.tenantId };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;

  const { data, error } = await ctx.supabase
    .from('historias_clinicas')
    .select('*')
    .eq('paciente_id', id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    historia: (data as { historia?: unknown } | null)?.historia ?? {},
    respuestas: (data as { respuestas?: unknown } | null)?.respuestas ?? {},
    puntajes: (data as { puntajes?: unknown } | null)?.puntajes ?? {},
    completado: (data as { completado?: boolean } | null)?.completado ?? false,
    updatedAt: (data as { updated_at?: string } | null)?.updated_at ?? null,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 422 });
  }

  const cuerpo = (body ?? {}) as { historia?: unknown; respuestas?: unknown; completado?: unknown };
  const historia = HistoriaClinicaSchema.safeParse(cuerpo.historia ?? {});
  const respuestas = RespuestasScreeningSchema.safeParse(cuerpo.respuestas ?? {});

  if (!historia.success || !respuestas.success) {
    return NextResponse.json(
      {
        error: 'Datos clínicos inválidos.',
        detalles: {
          historia: historia.success ? undefined : historia.error.flatten().fieldErrors,
          respuestas: respuestas.success ? undefined : respuestas.error.flatten().fieldErrors,
        },
      },
      { status: 422 }
    );
  }

  const puntajes = calcularPuntajes(respuestas.data);

  // upsert por (tenant_id, paciente_id): crea la historia si todavía no
  // existe, la actualiza si ya existe — nunca duplica, hay una unique
  // constraint sobre ese par de columnas.
  const { data, error } = await (ctx.supabase.from('historias_clinicas') as any)
    .upsert(
      {
        tenant_id: ctx.tenantId,
        paciente_id: id,
        historia: historia.data,
        respuestas: respuestas.data,
        puntajes,
        completado: Boolean(cuerpo.completado),
      },
      { onConflict: 'tenant_id,paciente_id' }
    )
    .select('updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, puntajes, updatedAt: (data as { updated_at: string }).updated_at });
}
