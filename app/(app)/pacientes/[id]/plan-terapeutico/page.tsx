import { PlanTerapeuticoForm } from '@/components/clinica/PlanTerapeuticoForm';

export default async function PlanTerapeuticoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="mx-auto max-w-4xl">
    <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">IPT</p>
    <h1 className="mb-1 font-serif text-3xl text-choco-deep">Plan terapéutico</h1>
    <p className="mb-5 text-[12.5px] text-choco-soft">Interpretación Personalizada del Tratamiento: secuencia de fases sugerida a partir de los patrones funcionales confirmados, editable por el médico.</p>
    <PlanTerapeuticoForm pacienteId={id} />
  </div>;
}
