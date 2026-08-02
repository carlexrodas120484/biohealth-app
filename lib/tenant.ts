import { NextResponse } from 'next/server';
import type { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Resuelve el tenant_id del usuario autenticado (usuarios.auth_id = auth.uid()).
 * Centralizado porque toda ruta de pacientes necesita este mismo chequeo antes
 * de tocar la tabla, y la política `usuarios_self` sólo deja ver la fila propia.
 */
export async function resolverTenantId(
  supabase: SupabaseServerClient,
  authId: string
): Promise<{ tenantId: string } | { error: NextResponse }> {
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('tenant_id')
    .eq('auth_id', authId)
    .maybeSingle();

  if (error) {
    return {
      error: NextResponse.json(
        { error: `No se pudo verificar tu usuario: ${error.message}` },
        { status: 500 }
      ),
    };
  }

  const tenantId = (usuario as { tenant_id: string | null } | null)?.tenant_id ?? null;

  if (!tenantId) {
    return {
      error: NextResponse.json(
        { error: 'Tu usuario no está vinculado a un consultorio (tenant).' },
        { status: 403 }
      ),
    };
  }

  return { tenantId };
}
