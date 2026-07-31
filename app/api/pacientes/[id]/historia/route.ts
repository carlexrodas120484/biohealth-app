import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { calcularPuntajes } from '@/lib/clinica/cuestionario';

const HistoriaSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]));
const RespuestasSchema = z.record(z.number().int().min(0).max(4));

async function contexto(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };

  const { data: usuario, error } = await supabase
    .from('usuarios').select('tenant_id').eq('auth_id', user.id).maybeSingle();
  const tenantId = (usuario as any)?.tenant_id as string | undefined;
  if (error || !tenantId) {
    return { error: NextResponse.json({ error: 'Usuario sin consultorio vinculado.' }, { status: 403 }) };
  }

  const { data: paciente } = await supabase
    .from('pacientes').select('id').eq('id', id).eq('tenant_id', tenantId).is('deleted_at', null).maybeSingle();
  if (!paciente) return { error: NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 }) };
  return { supabase, tenantId };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;

  const { data, error } = await ctx.supabase
    .from('historias_clinicas').select('*').eq('paciente_id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    historia: (data as any)?.historia ?? {},
    respuestas: (data as any)?.respuestas ?? {},
    puntajes: (data as any)?.puntajes ?? {},
    completado: (data as any)?.completado ?? false,
    updatedAt: (data as any)?.updated_at ?? null,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;

  const body = await req.json();
  const historia = HistoriaSchema.safeParse(body.historia ?? {});
  const respuestas = RespuestasSchema.safeParse(body.respuestas ?? {});
  if (!historia.success || !respuestas.success) {
    return NextResponse.json({ error: 'Datos clínicos inválidos.' }, { status: 422 });
  }

  const puntajes = calcularPuntajes(respuestas.data);
  const { data, error } = await (ctx.supabase.from('historias_clinicas') as any)
    .upsert({
      tenant_id: ctx.tenantId,
      paciente_id: id,
      historia: historia.data,
      respuestas: respuestas.data,
      puntajes,
      completado: Boolean(body.completado),
    }, { onConflict: 'tenant_id,paciente_id' })
    .select('updated_at').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, puntajes, updatedAt: data.updated_at });
}

