import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import type { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Resuelve tenant_id + rol del usuario autenticado y exige que su rol
 * esté en `rolesPermitidos`. Usado por el panel de Base de Conocimiento
 * (y cualquier otra sección administrativa futura) para que un usuario
 * sin rol autorizado nunca vea ni pueda escribir esos datos, más allá
 * de lo que ya filtra RLS.
 */
export async function resolverUsuarioAutorizado(
  supabase: SupabaseServerClient,
  authId: string,
  rolesPermitidos: readonly string[]
): Promise<{ tenantId: string; rol: string } | { error: NextResponse }> {
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('tenant_id, rol')
    .eq('auth_id', authId)
    .maybeSingle();

  if (error) {
    return { error: NextResponse.json({ error: `No se pudo verificar tu usuario: ${error.message}` }, { status: 500 }) };
  }

  const fila = usuario as { tenant_id: string | null; rol: string | null } | null;
  if (!fila?.tenant_id) {
    return { error: NextResponse.json({ error: 'Tu usuario no está vinculado a un consultorio (tenant).' }, { status: 403 }) };
  }
  if (!fila.rol || !rolesPermitidos.includes(fila.rol)) {
    return { error: NextResponse.json({ error: 'Tu rol no tiene autorización para administrar la base de conocimiento.' }, { status: 403 }) };
  }

  return { tenantId: fila.tenant_id, rol: fila.rol };
}

/**
 * Igual que `resolverUsuarioAutorizado`, pero para páginas (Server
 * Components): si el usuario no tiene sesión o su rol no está
 * autorizado, redirige en vez de devolver una respuesta JSON. Así la
 * sección "Base de conocimiento" nunca se renderiza para un usuario sin
 * rol autorizado, más allá de que la API ya la protege igual.
 */
export async function requerirRolAdminEnPagina(
  supabase: SupabaseServerClient,
  rolesPermitidos: readonly string[]
): Promise<{ tenantId: string; rol: string; userId: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const usuario = await resolverUsuarioAutorizado(supabase, user.id, rolesPermitidos);
  if ('error' in usuario) redirect('/dashboard');

  return { ...usuario, userId: user.id };
}
