import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolverUsuarioAutorizado } from '@/lib/adminAuth';
import { generarPlantillaCSV } from '@/lib/clinica/baseConocimiento';

const ROLES_AUTORIZADOS = ['medico_titular'] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  const usuario = await resolverUsuarioAutorizado(supabase, user.id, ROLES_AUTORIZADOS);
  if ('error' in usuario) return usuario.error;

  const csv = generarPlantillaCSV();
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="plantilla_principios_activos.csv"',
    },
  });
}
