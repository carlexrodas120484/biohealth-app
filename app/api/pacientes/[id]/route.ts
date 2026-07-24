import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PacienteSchema } from '@/lib/validation/paciente';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data, error } = await supabase.from('pacientes').select('*').eq('id', id).is('deleted_at', null).single();
  if (error || !data) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });

  return NextResponse.json({ paciente: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const parsed = PacienteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const v = parsed.data;
  const { data, error } = await (supabase.from('pacientes') as any)
    .update({
      nombre: v.nombre,
      apellido: v.apellido,
      documento: v.documento || null,
      fecha_nacimiento: v.fechaNacimiento || null,
      sexo: v.sexo,
      telefono: v.telefono || null,
      correo: v.correo || null,
      direccion: v.direccion || null,
      ciudad: v.ciudad || null,
      ocupacion: v.ocupacion || null,
      motivo_consulta: v.motivoConsulta || null,
      antecedentes_personales: v.antecedentesPersonales || null,
      antecedentes_familiares: v.antecedentesFamiliares || null,
      medicamentos_actuales: v.medicamentosActuales || null,
      alergias: v.alergias || null,
      observaciones: v.observaciones || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'Ya existe un paciente con ese documento.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ paciente: data });
}

/**
 * DELETE — borrado lógico (deleted_at), no destructivo. Un registro
 * clínico o pre-clínico no se destruye nunca en este sistema; se oculta
 * de los listados. Consistente con el resto del esquema.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { error } = await (supabase.from('pacientes') as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
