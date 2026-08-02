import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolverTenantId } from '@/lib/tenant';
import { esUuidValido } from '@/lib/validation/id';
import { LaboratorioInputSchema } from '@/lib/validation/laboratorio';

async function contexto(pacienteId: string) {
  if (!esUuidValido(pacienteId)) return { error: NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 }) };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };

  const tenant = await resolverTenantId(supabase, user.id);
  if ('error' in tenant) return { error: tenant.error };

  const { data: paciente, error } = await supabase
    .from('pacientes')
    .select('id')
    .eq('id', pacienteId)
    .eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  if (!paciente) return { error: NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 }) };

  return { supabase, tenantId: tenant.tenantId, userId: user.id };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;

  const limite = Math.min(Number(req.nextUrl.searchParams.get('limite') ?? '30') || 30, 100);

  const { data, error } = await ctx.supabase
    .from('laboratorios_clinicos')
    .select('id, fecha, peso_kg, talla_cm, cintura_cm, presion_sistolica, presion_diastolica, glucemia_mg_dl, hba1c_pct, trigliceridos_mg_dl, hdl_mg_dl, ldl_mg_dl, vitamina_d_ng_ml, homa_ir, pcr_mg_l, ferritina_ng_ml, observaciones, created_at')
    .eq('paciente_id', id)
    .eq('tenant_id', ctx.tenantId)
    .order('fecha', { ascending: false })
    .limit(limite);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ registros: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 422 });
  }

  const parsed = LaboratorioInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos de laboratorio inválidos.', detalles: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const d = parsed.data;

  const { error } = await (ctx.supabase.from('laboratorios_clinicos') as any).insert({
    tenant_id: ctx.tenantId,
    paciente_id: id,
    fecha: d.fecha,
    peso_kg: d.pesoKg ?? null,
    talla_cm: d.tallaCm ?? null,
    cintura_cm: d.cinturaCm ?? null,
    presion_sistolica: d.presionSistolica ?? null,
    presion_diastolica: d.presionDiastolica ?? null,
    glucemia_mg_dl: d.glucemiaMgDl ?? null,
    hba1c_pct: d.hba1cPct ?? null,
    trigliceridos_mg_dl: d.trigliceridosMgDl ?? null,
    hdl_mg_dl: d.hdlMgDl ?? null,
    ldl_mg_dl: d.ldlMgDl ?? null,
    vitamina_d_ng_ml: d.vitaminaDNgMl ?? null,
    homa_ir: d.homaIr ?? null,
    pcr_mg_l: d.pcrMgL ?? null,
    ferritina_ng_ml: d.ferritinaNgMl ?? null,
    observaciones: d.observaciones ?? '',
    registrado_por: ctx.userId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 201 });
}
