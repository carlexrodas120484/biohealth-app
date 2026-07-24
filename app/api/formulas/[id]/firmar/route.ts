import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const BodySchema = z.object({ confirmacionPassword: z.string().min(1) });

/**
 * Firmar una fórmula es un gesto distinto de estar logueado. Por eso
 * este endpoint exige reautenticar con la contraseña antes de marcar
 * `firmada = true` — el equivalente digital de la firma manuscrita.
 * Una vez firmada, `formula_items` queda protegido por una política
 * RLS de solo lectura (ver supabase/migrations).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Falta confirmar la contraseña' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.confirmacionPassword,
  });
  if (authError) return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });

  const { data: formula, error } = await (supabase
    .from('formulas') as any)
    .update({ firmada: true, firmada_por: user.id, firmada_en: new Date().toISOString() })
    .eq('id', id)
    .eq('firmada', false) // no permite refirmar — si ya está firmada, esto no matchea ninguna fila
    .select()
    .single();

  if (error || !formula) {
    return NextResponse.json({ error: 'No se pudo firmar (¿ya estaba firmada?)' }, { status: 409 });
  }

  return NextResponse.json({ formula });
}
