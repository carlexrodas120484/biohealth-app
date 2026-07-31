import { HistoriaClinicaForm } from '@/components/clinica/HistoriaClinicaForm';

export default async function HistoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="mx-auto max-w-4xl">
    <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 1</p>
    <h1 className="mb-1 font-serif text-3xl text-choco-deep">Historia clínica</h1>
    <p className="mb-5 text-[12.5px] text-choco-soft">Anamnesis, hábitos, signos vitales, seguridad y evaluación médica.</p>
    <HistoriaClinicaForm pacienteId={id} />
  </div>;
}
