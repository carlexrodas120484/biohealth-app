import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ListaPacientes } from '@/components/pacientes/ListaPacientes';

export default async function PacientesPage() {
  const supabase = await createClient();
  const { data: pacientes } = await supabase
    .from('pacientes')
    .select('id, nombre, apellido, documento, telefono, fecha_nacimiento')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-serif text-3xl text-choco-deep">Pacientes</h1>
        <Link
          href="/pacientes/nuevo"
          className="rounded-md bg-choco-deep px-4 py-2 text-sm text-crema hover:bg-choco"
        >
          + Nuevo paciente
        </Link>
      </div>
      <ListaPacientes pacientesIniciales={(pacientes as any) ?? []} />
    </div>
  );
}
