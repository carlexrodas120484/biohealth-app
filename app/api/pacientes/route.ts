import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PacienteSchema } from '@/lib/validation/paciente';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  let consulta = supabase
    .from('pacientes')
    .select('id, nombre, apellido, documento, telefono, fecha_nacimiento')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (q) {
    // Evita que caracteres de la sintaxis de PostgREST alteren el filtro.
    const termino = q.replace(/[,%()]/g, ' ').trim();
    if (termino) {
      consulta = consulta.or(
        `nombre.ilike.%${termino}%,apellido.ilike.%${termino}%,documento.ilike.%${termino}%`
      );
    }
  }

  const { data, error } = await consulta;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pacientes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = PacienteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Datos inválidos',
        detalles: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const { data: usuario, error: errorUsuario } = await supabase
    .from('usuarios')
    .select('tenant_id')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (errorUsuario) {
    return NextResponse.json(
      { error: `No se pudo verificar tu usuario: ${errorUsuario.message}` },
      { status: 500 }
    );
  }

  if (!usuario || !(usuario as any).tenant_id) {
    return NextResponse.json(
      { error: 'Tu usuario no está vinculado a un consultorio (tenant).' },
      { status: 403 }
    );
  }

  const v = parsed.data;
  const { data, error } = await (supabase.from('pacientes') as any)
    .insert({
      tenant_id: (usuario as any).tenant_id,
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
    .select()
    .single();

  if (error) {
    if ((error as any).code === '23505') {
      return NextResponse.json(
        { error: 'Ya existe un paciente con ese documento.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ paciente: data }, { status: 201 });
}
