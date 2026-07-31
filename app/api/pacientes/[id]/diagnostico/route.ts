import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const AlteracionSchema = z.object({
  id: z.string().min(1), nombre: z.string().trim().min(1).max(180),
  nivel: z.enum(['primaria', 'secundaria', 'terciaria']),
  dominio: z.string().trim().min(1).max(100), justificacion: z.string().trim().max(1000),
});
const TextoSchema = z.object({ id: z.string().min(1), nombre: z.string().trim().min(1).max(180) });
const DatosSchema = z.object({
  alteraciones: z.array(AlteracionSchema).max(50), perpetuadores: z.array(TextoSchema).max(50),
  deficits: z.array(TextoSchema).max(50), impresion: z.string().trim().max(6000),
  estudios: z.string().trim().max(4000), confirmado: z.boolean(),
});

async function contexto(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  const { data: usuario } = await supabase.from('usuarios').select('tenant_id').eq('auth_id', user.id).maybeSingle();
  const tenantId = (usuario as any)?.tenant_id as string | undefined;
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
  const [diagnostico, historia, bioescaner] = await Promise.all([
    ctx.supabase.from('diagnosticos_funcionales').select('*').eq('paciente_id', id).maybeSingle(),
    ctx.supabase.from('historias_clinicas').select('puntajes').eq('paciente_id', id).maybeSingle(),
    ctx.supabase.from('bioescaneres').select('hallazgos').eq('paciente_id', id).maybeSingle(),
  ]);
  if (diagnostico.error) return NextResponse.json({ error: diagnostico.error.message }, { status: 500 });
  const d = diagnostico.data as any;
  return NextResponse.json({
    alteraciones: d?.alteraciones ?? [], perpetuadores: d?.perpetuadores ?? [], deficits: d?.deficits ?? [],
    impresion: d?.impresion ?? '', estudios: d?.estudios ?? '', confirmado: d?.confirmado ?? false,
    evidencia: { puntajes: (historia.data as any)?.puntajes ?? {}, hallazgos: (bioescaner.data as any)?.hallazgos ?? [] },
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;
  const parsed = DatosSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Datos diagnósticos inválidos.' }, { status: 422 });
  const { error } = await (ctx.supabase.from('diagnosticos_funcionales') as any).upsert({
    tenant_id: ctx.tenantId, paciente_id: id, ...parsed.data,
  }, { onConflict: 'tenant_id,paciente_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
