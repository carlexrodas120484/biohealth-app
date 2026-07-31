import { ObjetivosTerapeuticosForm } from '@/components/clinica/ObjetivosTerapeuticosForm';

export default async function ObjetivosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="mx-auto max-w-5xl">
    <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 7</p>
    <h1 className="mb-1 font-serif text-3xl text-choco-deep">Objetivos terapéuticos</h1>
    <p className="mb-5 text-[12.5px] text-choco-soft">Objetivos limitados a la fase confirmada, con duración clínica definida.</p>
    <ObjetivosTerapeuticosForm pacienteId={id} />
  </div>;
}
