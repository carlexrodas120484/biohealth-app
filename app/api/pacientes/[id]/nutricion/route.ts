import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Schema = z.object({ priorizar: z.string().trim().min(1).max(4000), evitar: z.string().trim().min(1).max(4000), comidasDia: z.number().int().min(1).max(10), confirmado: z.boolean() });
async function contexto(id: string) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  const { data: u } = await supabase.from('usuarios').select('tenant_id').eq('auth_id', user.id).maybeSingle(); const tenantId = (u as any)?.tenant_id;
  const { data: p } = await supabase.from('pacientes').select('id').eq('id', id).eq('tenant_id', tenantId).is('deleted_at', null).maybeSingle();
  if (!tenantId || !p) return { error: NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 }) };
  return { supabase, tenantId };
}
export async function GET(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const ctx = await contexto(id); if ('error' in ctx) return ctx.error;
  const [fase, plan, formula] = await Promise.all([
    ctx.supabase.from('fases_terapeuticas').select('fase_seleccionada,confirmado').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('planes_nutricionales_clinicos').select('*').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('formulaciones_terapeuticas').select('firmada').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
  ]);
  if (fase.error || plan.error || formula.error) return NextResponse.json({ error: fase.error?.message ?? plan.error?.message ?? formula.error?.message }, { status: 500 });
  const f = fase.data as any; if (!f?.confirmado) return NextResponse.json({ error: 'Confirme primero la fase terapéutica.' }, { status: 409 });
  const p = plan.data as any; return NextResponse.json({ fase: f.fase_seleccionada, priorizar: p?.fase === f.fase_seleccionada ? p.priorizar : '', evitar: p?.fase === f.fase_seleccionada ? p.evitar : '', comidasDia: p?.comidas_dia ?? 4, confirmado: p?.fase === f.fase_seleccionada && Boolean(p.confirmado), tieneFormula: Boolean((formula.data as any)?.firmada) });
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const ctx = await contexto(id); if ('error' in ctx) return ctx.error; const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Complete correctamente el plan nutricional.' }, { status: 422 });
  const { data: fase } = await ctx.supabase.from('fases_terapeuticas').select('fase_seleccionada,confirmado').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle();
  if (!(fase as any)?.confirmado) return NextResponse.json({ error: 'Confirme primero la fase terapéutica.' }, { status: 409 });
  const { error } = await (ctx.supabase.from('planes_nutricionales_clinicos') as any).upsert({ tenant_id: ctx.tenantId, paciente_id: id, fase: (fase as any).fase_seleccionada, priorizar: parsed.data.priorizar, evitar: parsed.data.evitar, comidas_dia: parsed.data.comidasDia, confirmado: parsed.data.confirmado }, { onConflict: 'tenant_id,paciente_id' });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
