import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const ItemSchema = z.object({
  id: z.string().min(1).max(100),
  nombre: z.string().trim().min(2).max(150),
  dosis: z.string().trim().min(1).max(200),
  presentacion: z.string().trim().max(200).default(''),
  cantidad: z.string().trim().max(120).default(''),
  indicacion: z.string().trim().min(1).max(300),
  observaciones: z.string().trim().max(500),
  evidencia: z.string().max(10).optional(),
  fuente: z.string().max(200).optional(),
});
const RevisionClinicaSchema = z.object({
  pesoKg: z.string().max(20), embarazoLactancia: z.enum(['no-aplica', 'no', 'embarazo', 'lactancia', 'desconocido']),
  funcionRenal: z.string().max(300), funcionHepatica: z.string().max(300), laboratorios: z.string().max(1000), diagnosticoConfirmado: z.boolean(),
});
const DatosSchema = z.object({
  items: z.array(ItemSchema).min(1).max(20),
  revisionClinica: RevisionClinicaSchema,
  seguridadRevisada: z.boolean(),
  firmar: z.boolean(),
  password: z.string().max(200),
});

type Sugerencia = { id: string; nombre: string; objetivo: string; precaucion: string; evidencia: 'B' | 'C' | 'D'; fuente: string };
const SUGERENCIAS: Record<string, Sugerencia[]> = {
  'Reparar mucosa intestinal': [
    { id: 'l-glutamina', nombre: 'L-glutamina', objetivo: 'Reparar mucosa intestinal', precaucion: 'Individualizar en enfermedad hepática, renal o contexto oncológico.', evidencia: 'C', fuente: 'Material docente aportado' },
    { id: 'zinc-carnosina', nombre: 'Zinc-L-carnosina', objetivo: 'Reparar mucosa intestinal', precaucion: 'Considerar aporte total de zinc y uso prolongado.', evidencia: 'C', fuente: 'Material docente aportado' },
  ],
  'Disminuir inflamación': [
    { id: 'omega-3', nombre: 'Omega-3 (EPA + DHA)', objetivo: 'Disminuir inflamación', precaucion: 'Revisar anticoagulantes, antiagregantes y riesgo hemorrágico.', evidencia: 'B', fuente: 'Manual profesional; validar indicación' },
    { id: 'curcumina', nombre: 'Curcumina', objetivo: 'Disminuir inflamación', precaucion: 'Revisar anticoagulación, patología biliar e interacciones.', evidencia: 'C', fuente: 'Material docente aportado' },
  ],
  'Mejorar microbiota': [
    { id: 'probiotico', nombre: 'Probiótico con cepa identificada', objetivo: 'Mejorar microbiota', precaucion: 'Seleccionar cepa según indicación; cautela en inmunosupresión grave.', evidencia: 'C', fuente: 'Material docente aportado' },
    { id: 's-boulardii', nombre: 'Saccharomyces boulardii', objetivo: 'Mejorar microbiota', precaucion: 'Evitar en pacientes críticos, inmunosupresión grave o con catéter venoso central.', evidencia: 'C', fuente: 'Material docente aportado' },
  ],
  'Optimizar digestión enzimática': [
    { id: 'enzimas-digestivas', nombre: 'Complejo de enzimas digestivas', objetivo: 'Optimizar digestión enzimática', precaucion: 'Definir composición según clínica; no sustituye evaluación pancreática o biliar.', evidencia: 'D', fuente: 'Resumen de fórmula aportado' },
  ],
  'Restaurar pH gástrico': [
    { id: 'betaina-hcl', nombre: 'Betaína HCl', objetivo: 'Restaurar pH gástrico', precaucion: 'No usar sin evaluar gastritis, úlcera, reflujo y medicación gastroprotectora.', evidencia: 'D', fuente: 'Formulario aportado' },
  ],
};

async function contexto(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  const { data: usuario } = await supabase.from('usuarios').select('tenant_id').eq('auth_id', user.id).maybeSingle();
  const tenantId = (usuario as { tenant_id?: string } | null)?.tenant_id;
  if (!tenantId) return { error: NextResponse.json({ error: 'Usuario sin consultorio vinculado.' }, { status: 403 }) };
  const { data: paciente } = await supabase.from('pacientes')
    .select('id,medicamentos_actuales,alergias').eq('id', id).eq('tenant_id', tenantId).is('deleted_at', null).maybeSingle();
  if (!paciente) return { error: NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 }) };
  return { supabase, tenantId, user, paciente: paciente as { medicamentos_actuales?: string | null; alergias?: string | null } };
}

async function objetivosConfirmados(ctx: Exclude<Awaited<ReturnType<typeof contexto>>, { error: NextResponse }>, id: string) {
  const { data, error } = await ctx.supabase.from('objetivos_terapeuticos')
    .select('fase,objetivos,confirmado').eq('paciente_id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as { fase?: string; objetivos?: string[]; confirmado?: boolean } | null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;
  try {
    const [objetivos, formula] = await Promise.all([
      objetivosConfirmados(ctx, id),
      ctx.supabase.from('formulaciones_terapeuticas').select('*').eq('paciente_id', id).maybeSingle(),
    ]);
    if (formula.error) throw new Error(formula.error.message);
    if (!objetivos?.confirmado || !objetivos.fase) {
      return NextResponse.json({ error: 'Confirme primero los objetivos terapéuticos.' }, { status: 409 });
    }
    const sugerencias = (objetivos.objetivos ?? []).flatMap(o => SUGERENCIAS[o] ?? []);
    const guardada = formula.data as { fase?: string; objetivos?: string[]; items?: unknown[]; revision_clinica?: unknown; seguridad_revisada?: boolean; firmada?: boolean; firmada_en?: string | null } | null;
    const vigente = guardada?.fase === objetivos.fase && JSON.stringify(guardada?.objetivos ?? []) === JSON.stringify(objetivos.objetivos ?? []);
    return NextResponse.json({
      fase: objetivos.fase,
      objetivos: objetivos.objetivos ?? [],
      sugerencias,
      medicamentosActuales: ctx.paciente.medicamentos_actuales ?? 'No registrados',
      alergias: ctx.paciente.alergias ?? 'No registradas',
      items: vigente ? guardada?.items ?? [] : [],
      revisionClinica: vigente ? guardada?.revision_clinica ?? null : null,
      seguridadRevisada: vigente ? Boolean(guardada?.seguridad_revisada) : false,
      firmada: vigente ? Boolean(guardada?.firmada) : false,
      firmadaEn: vigente ? guardada?.firmada_en ?? null : null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo cargar la formulación.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;
  const parsed = DatosSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Complete nombre, dosis e indicación de cada activo.' }, { status: 422 });
  try {
    const objetivos = await objetivosConfirmados(ctx, id);
    if (!objetivos?.confirmado || !objetivos.fase) {
      return NextResponse.json({ error: 'Confirme primero los objetivos terapéuticos.' }, { status: 409 });
    }
    if (parsed.data.firmar && !parsed.data.seguridadRevisada) {
      return NextResponse.json({ error: 'Confirme la revisión de medicación, alergias, contraindicaciones e interacciones.' }, { status: 422 });
    }
    if (parsed.data.firmar && !parsed.data.revisionClinica.diagnosticoConfirmado) {
      return NextResponse.json({ error: 'Confirme la indicación clínica y el contexto usado para definir las dosis.' }, { status: 422 });
    }
    if (parsed.data.firmar) {
      if (!ctx.user.email || !parsed.data.password) return NextResponse.json({ error: 'Ingrese su contraseña para firmar.' }, { status: 422 });
      const { error: authError } = await ctx.supabase.auth.signInWithPassword({ email: ctx.user.email, password: parsed.data.password });
      if (authError) return NextResponse.json({ error: 'Contraseña incorrecta.' }, { status: 401 });
    }
    const { error } = await (ctx.supabase.from('formulaciones_terapeuticas') as any).upsert({
      tenant_id: ctx.tenantId,
      paciente_id: id,
      fase: objetivos.fase,
      objetivos: objetivos.objetivos ?? [],
      items: parsed.data.items,
      revision_clinica: parsed.data.revisionClinica,
      seguridad_revisada: parsed.data.seguridadRevisada,
      firmada: parsed.data.firmar,
      firmada_por: parsed.data.firmar ? ctx.user.id : null,
      firmada_en: parsed.data.firmar ? new Date().toISOString() : null,
    }, { onConflict: 'tenant_id,paciente_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, firmadaEn: parsed.data.firmar ? new Date().toISOString() : null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo guardar la formulación.' }, { status: 500 });
  }
}
