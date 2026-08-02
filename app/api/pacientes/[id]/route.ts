import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PacienteSchema, mapearPacienteADB } from '@/lib/validation/paciente';
import { resolverTenantId } from '@/lib/tenant';
import { esUuidValido } from '@/lib/validation/id';

function pacienteNoEncontrado() {
  return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esUuidValido(id)) return pacienteNoEncontrado();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const tenant = await resolverTenantId(supabase, user.id);
  if ('error' in tenant) return tenant.error;

  const { data, error } = await supabase
    .from('pacientes')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return pacienteNoEncontrado();

  return NextResponse.json({ paciente: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esUuidValido(id)) return pacienteNoEncontrado();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 422 });
  }

  const parsed = PacienteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const tenant = await resolverTenantId(supabase, user.id);
  if ('error' in tenant) return tenant.error;

  // Filtro explícito por id + tenant_id + deleted_at is null: la política
  // RLS de UPDATE no excluye filas ya eliminadas (a propósito, para que el
  // borrado lógico funcione), así que sin este filtro se podría editar un
  // paciente inactivo o de otro tenant si algún día cambia la política.
  const { data, error } = await (supabase.from('pacientes') as any)
    .update(mapearPacienteADB(parsed.data))
    .eq('id', id)
    .eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Ya existe un paciente con ese documento.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 0 filas afectadas: no existe, es de otro tenant, o está eliminado.
  // Nunca se devuelve éxito sin haber modificado una fila real.
  if (!data) return pacienteNoEncontrado();

  return NextResponse.json({ paciente: data });
}

/**
 * DELETE — borrado lógico (deleted_at), no destructivo. Un registro
 * clínico o pre-clínico no se destruye nunca en este sistema; se oculta
 * de los listados.
 *
 * Se usa `count: 'exact'` en vez de `.select().maybeSingle()` para saber
 * si el UPDATE afectó una fila: la política SELECT de pacientes exige
 * `deleted_at is null`, así que pedir de vuelta la fila recién eliminada
 * siempre devolvería 0 filas aunque el borrado haya funcionado. El count
 * refleja las filas que matcheó el UPDATE, no lo que la política SELECT
 * deja leer después.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esUuidValido(id)) return pacienteNoEncontrado();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const tenant = await resolverTenantId(supabase, user.id);
  if ('error' in tenant) return tenant.error;

  const { error, count } = await (supabase.from('pacientes') as any)
    .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', id)
    .eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sin filas afectadas: no existe, es de otro tenant, o ya estaba
  // eliminado (DELETE repetido). En todos los casos, 404 — nunca ok:true
  // sin haber modificado una fila real.
  if (!count) return pacienteNoEncontrado();

  return NextResponse.json({ ok: true });
}
