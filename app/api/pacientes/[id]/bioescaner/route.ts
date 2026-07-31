import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const HallazgoSchema = z.object({
  id: z.string().min(1),
  parametro: z.string().trim().min(1).max(160),
  valor: z.string().trim().max(120),
  referencia: z.string().trim().max(120),
  severidad: z.enum(['ok', 'med', 'alto']),
});

const DatosSchema = z.object({
  fecha: z.string().max(10).nullable().optional(),
  equipo: z.string().trim().max(120),
  observaciones: z.string().trim().max(4000),
  hallazgos: z.array(HallazgoSchema).max(200),
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
  const { data, error } = await ctx.supabase.from('bioescaneres').select('*').eq('paciente_id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let archivoUrl: string | null = null;
  if ((data as any)?.archivo_path) {
    const firmado = await ctx.supabase.storage.from('bioescaneres').createSignedUrl((data as any).archivo_path, 3600);
    archivoUrl = firmado.data?.signedUrl ?? null;
  }
  return NextResponse.json({
    fecha: (data as any)?.fecha ?? '', equipo: (data as any)?.equipo ?? '',
    observaciones: (data as any)?.observaciones ?? '', hallazgos: (data as any)?.hallazgos ?? [],
    archivoPath: (data as any)?.archivo_path ?? null, archivoUrl,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;
  const parsed = DatosSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Datos del bioescáner inválidos.' }, { status: 422 });

  const { error } = await (ctx.supabase.from('bioescaneres') as any).upsert({
    tenant_id: ctx.tenantId, paciente_id: id, fecha: parsed.data.fecha || null,
    equipo: parsed.data.equipo, observaciones: parsed.data.observaciones,
    hallazgos: parsed.data.hallazgos,
  }, { onConflict: 'tenant_id,paciente_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;
  const form = await req.formData();
  const archivo = form.get('archivo');
  if (!(archivo instanceof File) || archivo.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Selecciona un archivo PDF.' }, { status: 422 });
  }
  if (archivo.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'El PDF supera 8 MB.' }, { status: 413 });

  const path = `${ctx.tenantId}/${id}/${Date.now()}-informe.pdf`;
  const subida = await ctx.supabase.storage.from('bioescaneres').upload(path, archivo, { contentType: 'application/pdf' });
  if (subida.error) return NextResponse.json({ error: subida.error.message }, { status: 500 });

  const { data: previo } = await ctx.supabase.from('bioescaneres').select('archivo_path').eq('paciente_id', id).maybeSingle();
  const { error } = await (ctx.supabase.from('bioescaneres') as any).upsert({
    tenant_id: ctx.tenantId, paciente_id: id, archivo_path: path,
  }, { onConflict: 'tenant_id,paciente_id' });
  if (error) {
    await ctx.supabase.storage.from('bioescaneres').remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const anterior = (previo as any)?.archivo_path;
  if (anterior && anterior !== path) await ctx.supabase.storage.from('bioescaneres').remove([anterior]);
  const firmado = await ctx.supabase.storage.from('bioescaneres').createSignedUrl(path, 3600);
  return NextResponse.json({ ok: true, archivoPath: path, archivoUrl: firmado.data?.signedUrl ?? null });
}
