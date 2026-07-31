import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { calcularRankingIPT, type AlteracionInput } from '@/lib/algoritmo/ipt';
import { createClient } from '@/lib/supabase/server';

const EvaluacionSchema = z.object({
  alteracionId: z.string().min(1),
  perpetuadorActivo: z.boolean(),
  cronicidadMeses: z.number().int().min(0).max(1200),
  IC: z.number().int().min(0).max(5),
  IS: z.number().int().min(0).max(5),
  RV: z.number().int().min(0).max(5),
  EV: z.number().int().min(0).max(5),
  CB: z.number().int().min(0).max(5),
});

const DatosSchema = z.object({
  evaluaciones: z.array(EvaluacionSchema).max(50),
  confirmado: z.boolean(),
});

type AlteracionDiagnostica = {
  id: string;
  nombre: string;
  dominio: string;
  nivel: 'primaria' | 'secundaria' | 'terciaria';
};

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;

  const [diagnostico, ipt] = await Promise.all([
    ctx.supabase.from('diagnosticos_funcionales').select('alteraciones,perpetuadores,confirmado').eq('paciente_id', id).maybeSingle(),
    ctx.supabase.from('ipt_evaluaciones').select('evaluaciones,resultado,confirmado').eq('paciente_id', id).maybeSingle(),
  ]);
  if (diagnostico.error) return NextResponse.json({ error: diagnostico.error.message }, { status: 500 });
  if (ipt.error) return NextResponse.json({ error: ipt.error.message }, { status: 500 });

  const d = diagnostico.data as { alteraciones?: AlteracionDiagnostica[]; perpetuadores?: unknown[]; confirmado?: boolean } | null;
  const i = ipt.data as { evaluaciones?: unknown[]; resultado?: unknown[]; confirmado?: boolean } | null;
  return NextResponse.json({
    alteraciones: d?.alteraciones ?? [],
    perpetuadores: d?.perpetuadores ?? [],
    diagnosticoConfirmado: d?.confirmado ?? false,
    evaluaciones: i?.evaluaciones ?? [],
    resultado: i?.resultado ?? [],
    confirmado: i?.confirmado ?? false,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;
  const parsed = DatosSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Evaluación IPT inválida. Use valores enteros entre 0 y 5.' }, { status: 422 });

  const { data: diagnostico, error: diagnosticoError } = await ctx.supabase
    .from('diagnosticos_funcionales').select('alteraciones').eq('paciente_id', id).maybeSingle();
  if (diagnosticoError) return NextResponse.json({ error: diagnosticoError.message }, { status: 500 });
  const alteraciones = ((diagnostico as { alteraciones?: AlteracionDiagnostica[] } | null)?.alteraciones ?? []);
  const porId = new Map(alteraciones.map(a => [a.id, a]));

  if (parsed.data.evaluaciones.length !== alteraciones.length || parsed.data.evaluaciones.some(e => !porId.has(e.alteracionId))) {
    return NextResponse.json({ error: 'El diagnóstico cambió. Recargue la página antes de guardar el IPT.' }, { status: 409 });
  }

  const entradas: AlteracionInput[] = parsed.data.evaluaciones.map(e => {
    const a = porId.get(e.alteracionId)!;
    return { id: a.id, nombre: a.nombre, dominio: a.dominio, nivel: a.nivel, ...e };
  });
  const resultado = calcularRankingIPT(entradas);
  const { error } = await (ctx.supabase.from('ipt_evaluaciones') as any).upsert({
    tenant_id: ctx.tenantId,
    paciente_id: id,
    evaluaciones: parsed.data.evaluaciones,
    resultado,
    confirmado: parsed.data.confirmado,
  }, { onConflict: 'tenant_id,paciente_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, resultado });
}
