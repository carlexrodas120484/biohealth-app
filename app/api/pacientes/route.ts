import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PacienteSchema, mapearPacienteADB } from '@/lib/validation/paciente';
import { resolverTenantId } from '@/lib/tenant';

/**
 * Quita caracteres que rompen la sintaxis de `.or()` de PostgREST
 * (separador de condiciones, agrupación, comodín de ILIKE) para que un
 * término de búsqueda arbitrario nunca altere el filtro que se envía.
 */
function sanitizarTermino(q: string): string {
  return q.replace(/[,%()]/g, ' ').trim();
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const tenant = await resolverTenantId(supabase, user.id);
  if ('error' in tenant) return tenant.error;

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  let consulta = supabase
    .from('pacientes')
    .select('id, nombre, apellido, documento, telefono, fecha_nacimiento')
    .eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (q) {
    const termino = sanitizarTermino(q);
    if (termino) {
      consulta = consulta.or(
        `nombre.ilike.%${termino}%,apellido.ilike.%${termino}%,documento.ilike.%${termino}%`
      );
    }
  }

  const { data, error } = await consulta;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pacientes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 422 });
  }

  const parsed = PacienteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Datos inválidos',
        detalles: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const tenant = await resolverTenantId(supabase, user.id);
  if ('error' in tenant) return tenant.error;

  const { data, error } = await (supabase.from('pacientes') as any)
    .insert({ tenant_id: tenant.tenantId, ...mapearPacienteADB(parsed.data) })
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: 'Ya existe un paciente con ese documento.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ paciente: data }, { status: 201 });
}
