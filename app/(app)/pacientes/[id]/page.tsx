import { DashboardClinico } from '@/components/dashboard/DashboardClinico';

export default async function PacienteIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="mx-auto max-w-6xl">
    <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Dashboard clínico</p>
    <h1 className="mb-1 font-serif text-3xl text-choco-deep">Resumen del paciente</h1>
    <p className="mb-5 text-[12.5px] text-choco-soft">Vista general al abrir el paciente. Recorré los pasos abajo para editar cada módulo.</p>
    <DashboardClinico pacienteId={id} />
  </div>;
}
