import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolverUsuarioAutorizado } from '@/lib/adminAuth';
import { esUuidValido } from '@/lib/validation/id';

const ROLES_AUTORIZADOS = ['medico_titular'] as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esUuidValido(id)) return NextResponse.json({ error: 'Principio no encontrado.' }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  const usuario = await resolverUsuarioAutorizado(supabase, user.id, ROLES_AUTORIZADOS);
  if ('error' in usuario) return usuario.error;

  const { data: principio, error: errorPrincipio } = await supabase
    .from('principios_activos')
    .select('id')
    .eq('id', id)
    .or(`tenant_id.is.null,tenant_id.eq.${usuario.tenantId}`)
    .maybeSingle();
  if (errorPrincipio) return NextResponse.json({ error: errorPrincipio.message }, { status: 500 });
  if (!principio) return NextResponse.json({ error: 'Principio no encontrado.' }, { status: 404 });

  const { data, error } = await supabase
    .from('historial_principios_activos')
    .select('*')
    .eq('principio_id', id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ historial: data ?? [] });
}
