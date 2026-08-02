import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FASES, type Fase } from '@/lib/algoritmo/fases';
import { createClient } from '@/lib/supabase/server';

const DatosSchema = z.object({
  objetivos: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
  semanasPrevistas: z.number().int().min(0).max(104),
  confirmado: z.boolean(),
});

async function contexto(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  const { data: usuario } = await supabase.from('usuarios').select('tenant_id').eq('auth_id', user.id).maybeSingle();
  const tenantId = (usuario as { tenant_id?: string } | null)?.tenant_id;
  if (!tenantId) return { error: NextResponse.json({ error: 'Usuario sin consultorio vinculado.' }, { status: 403 }) };
  const { data: paciente } = await supabase.from('pacientes').select('id').eq('id', id)
    .eq('tenant_id', tenantId).is('deleted_at', null).maybeSingle();
  if (!paciente) return { error: NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 }) };
  return { supabase, tenantId };
}

async function faseConfirmada(ctx: Exclude<Awaited<ReturnType<typeof contexto>>, { error: NextResponse }>, id: string) {
  const { data, error } = await ctx.supabase.from('fases_terapeuticas')
    .select('fase_seleccionada,confirmado').eq('paciente_id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as { fase_seleccionada?: Fase; confirmado?: boolean } | null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;
  try {
    const [fase, guardados] = await Promise.all([
      faseConfirmada(ctx, id),
      ctx.supabase.from('objetivos_terapeuticos').select('*').eq('paciente_id', id).maybeSingle(),
    ]);
    if (guardados.error) throw new Error(guardados.error.message);
    if (!fase?.confirmado || !fase.fase_seleccionada) {
      return NextResponse.json({ error: 'Confirme primero la fase terapéutica.' }, { status: 409 });
    }
    const info = FASES[fase.fase_seleccionada];
    const guardado = guardados.data as { fase?: Fase; objetivos?: string[]; semanas_previstas?: number; confirmado?: boolean } | null;
    const vigente = guardado?.fase === fase.fase_seleccionada;
    return NextResponse.json({
      fase: fase.fase_seleccionada,
      objetivosDisponibles: info.objetivos,
      semanasMinimas: info.semanasMinimas,
      // Sin objetivos guardados todavía: parte con todos los objetivos de la
      // fase confirmada pre-seleccionados (sugerencia editable), en vez de un
      // formulario vacío que obligue a tildar uno por uno.
      objetivos: vigente ? guardado?.objetivos ?? info.objetivos : info.objetivos,
      semanasPrevistas: vigente ? guardado?.semanas_previstas ?? info.semanasMinimas : info.semanasMinimas,
      confirmado: vigente ? Boolean(guardado?.confirmado) : false,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudieron cargar los objetivos.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;
  const parsed = DatosSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Seleccione al menos un objetivo válido.' }, { status: 422 });
  try {
    const fase = await faseConfirmada(ctx, id);
    if (!fase?.confirmado || !fase.fase_seleccionada) {
      return NextResponse.json({ error: 'Confirme primero la fase terapéutica.' }, { status: 409 });
    }
    const info = FASES[fase.fase_seleccionada];
    const permitidos = new Set(info.objetivos);
    const objetivos = [...new Set(parsed.data.objetivos)];
    if (objetivos.some(o => !permitidos.has(o))) {
      return NextResponse.json({ error: 'Uno de los objetivos no corresponde a la fase confirmada.' }, { status: 409 });
    }
    if (parsed.data.semanasPrevistas < info.semanasMinimas) {
      return NextResponse.json({ error: `La fase ${info.nombre} requiere al menos ${info.semanasMinimas} semanas.` }, { status: 422 });
    }
    const { error } = await (ctx.supabase.from('objetivos_terapeuticos') as any).upsert({
      tenant_id: ctx.tenantId,
      paciente_id: id,
      fase: fase.fase_seleccionada,
      objetivos,
      semanas_previstas: parsed.data.semanasPrevistas,
      confirmado: parsed.data.confirmado,
    }, { onConflict: 'tenant_id,paciente_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudieron guardar los objetivos.' }, { status: 500 });
  }
}
