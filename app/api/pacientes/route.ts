import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PacienteSchema } from '@/lib/validation/paciente';

/**
 * GET /api/pacientes?q=texto
 * Lista pacientes del tenant del usuario autenticado. RLS filtra el
 * tenant automáticamente (ver migración 0004) — esta ruta no necesita
 * (ni debe) construir ese filtro a mano.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim();

  let query = supabase
    .from('pacientes')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (q) {
    // busca por nombre, apellido o documento — ilike cubre búsquedas
    // parciales sin necesitar el índice de texto completo para listas chicas
    query = query.or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,documento.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pacientes: data });
}

/**
 * POST /api/pacientes — registra un paciente nuevo.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const parsed = PacienteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  // Cliente de sesión del usuario (mismo `supabase` de arriba, ya
  // autenticado por cookie). La política `usuarios_self` (ver migración
  // 0004) permite a cada usuario leer únicamente su propia fila —
  // alcanza para resolver el tenant sin necesitar service role.
  const { data: usuario, error: errorUsuario } = await supabase
    .from('usuarios')
    .select('tenant_id')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (errorUsuario) {
    // esto es lo que antes se perdía: un error real de Postgres/RLS quedaba
    // enmascarado como "no vinculado a un tenant". Ahora queda en los logs
    // del servidor (Vercel → Deployments → Functions → Logs) para diagnosticar.
    console.error('[api/pacientes POST] error consultando usuarios:', errorUsuario);
    return NextResponse.json({ error: `No se pudo verificar tu usuario: ${errorUsuario.message}` }, { status: 500 });
  }

  if (!usuario) {
    console.error("403 pacientes:", {
      usuario,
      errorUsuario,
      tenantId: (usuario as any)?.tenant_id,
      userId: user.id
    });
    return NextResponse.json({ error: 'Tu usuario no está vinculado a un consultorio (tenant). Contactá al administrador.' }, { status: 403 });
  }

  if (!(usuario as any).tenant_id) {
    console.error("403 pacientes:", {
      usuario,
      errorUsuario,
      tenantId: (usuario as any)?.tenant_id,
      userId: user.id
    });
    return NextResponse.json({ error: 'Tu usuario existe pero no tiene tenant_id asignado. Revisá la fila en la tabla usuarios.' }, { status: 403 });
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
      // requerido por el esquema legacy; el trigger lo recalcula si mandamos fecha_nacimiento
      edad: 0,
    })
    .select()
    .single();

  if (error) {
    // el índice único de documento por tenant devuelve este código si ya existe
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'Ya existe un paciente con ese documento.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ paciente: data }, { status: 201 });
}
