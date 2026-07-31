import { FaseTerapeuticaForm } from '@/components/clinica/FaseTerapeuticaForm';

export default async function FasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="mx-auto max-w-5xl">
    <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 6</p>
    <h1 className="mb-1 font-serif text-3xl text-choco-deep">Fase terapéutica</h1>
    <p className="mb-5 text-[12.5px] text-choco-soft">Selección por compuertas fisiológicas, con confirmación médica.</p>
    <FaseTerapeuticaForm pacienteId={id} />
  </div>;
}
