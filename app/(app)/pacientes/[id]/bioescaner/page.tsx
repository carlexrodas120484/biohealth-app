import { BioescanerForm } from '@/components/clinica/BioescanerForm';

export default async function BioescanerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="mx-auto max-w-5xl">
    <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 3</p>
    <h1 className="mb-1 font-serif text-3xl text-choco-deep">Bioescáner</h1>
    <p className="mb-5 text-[12.5px] text-choco-soft">Informe original y registro médico de los hallazgos relevantes.</p>
    <BioescanerForm pacienteId={id} />
  </div>;
}
