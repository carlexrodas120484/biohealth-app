import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ConfirmarEliminar } from '@/components/pacientes/ConfirmarEliminar';

function calcularEdad(fechaNacimiento: string | null): string {
  if (!fechaNacimiento) return '—';
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return `${edad} años`;
}

function Dato({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] text-choco-soft">{label}</p>
      <p className="mt-0.5 text-[13.5px] text-choco-deep">{valor?.trim() ? valor : '—'}</p>
    </div>
  );
}

export default async function FichaPacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from('pacientes').select('*').eq('id', id).is('deleted_at', null).single();

  if (!p) notFound();
  const pac = p as any;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/pacientes" className="mb-3 inline-block text-[12.5px] text-choco-soft hover:text-oro">← Volver a pacientes</Link>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl text-choco-deep">{pac.nombre} {pac.apellido}</h1>
          <p className="mt-1 text-[12.5px] text-choco-soft">{calcularEdad(pac.fecha_nacimiento)} · {pac.sexo}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/pacientes/${id}/historia`} className="rounded-md bg-choco-deep px-3.5 py-2 text-[13px] text-crema hover:bg-choco">
            Historia clínica
          </Link>
          <Link href={`/pacientes/${id}/plan-terapeutico`} className="rounded-md border border-linea-fuerte px-3.5 py-2 text-[13px] text-choco-deep hover:bg-crema">
            Plan terapéutico
          </Link>
          <Link href={`/pacientes/${id}/informes`} className="rounded-md border border-linea-fuerte px-3.5 py-2 text-[13px] text-choco-deep hover:bg-crema">
            Informes y PDF
          </Link>
          <Link href={`/pacientes/editar/${id}`} className="rounded-md border border-linea-fuerte px-3.5 py-2 text-[13px] text-choco-deep hover:bg-crema">
            Editar
          </Link>
          <ConfirmarEliminar pacienteId={id} nombreCompleto={`${pac.nombre} ${pac.apellido}`} />
        </div>
      </div>

      <div className="space-y-5">
        <section className="rounded-card border border-linea bg-white p-5">
          <p className="mb-4 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Datos personales</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Dato label="Documento" valor={pac.documento} />
            <Dato label="Fecha de nacimiento" valor={pac.fecha_nacimiento} />
            <Dato label="Ocupación" valor={pac.ocupacion} />
          </div>
        </section>

        <section className="rounded-card border border-linea bg-white p-5">
          <p className="mb-4 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Contacto</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Dato label="Teléfono" valor={pac.telefono} />
            <Dato label="Correo" valor={pac.correo} />
            <Dato label="Dirección" valor={pac.direccion} />
            <Dato label="Ciudad" valor={pac.ciudad} />
          </div>
        </section>

        <section className="rounded-card border border-linea bg-white p-5">
          <p className="mb-4 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Consulta y antecedentes</p>
          <div className="space-y-4">
            <Dato label="Motivo de consulta" valor={pac.motivo_consulta} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Dato label="Antecedentes personales" valor={pac.antecedentes_personales} />
              <Dato label="Antecedentes familiares" valor={pac.antecedentes_familiares} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Dato label="Medicamentos actuales" valor={pac.medicamentos_actuales} />
              <Dato label="Alergias" valor={pac.alergias} />
            </div>
            <Dato label="Observaciones" valor={pac.observaciones} />
          </div>
        </section>
      </div>
    </div>
  );
}
