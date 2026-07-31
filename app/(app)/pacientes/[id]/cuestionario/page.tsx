import { CuestionarioFuncionalForm } from '@/components/clinica/CuestionarioFuncionalForm';

export default async function CuestionarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="mx-auto max-w-4xl">
    <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 2</p>
    <h1 className="mb-1 font-serif text-3xl text-choco-deep">Cuestionario funcional y ortomolecular</h1>
    <p className="mb-5 text-[12.5px] text-choco-soft">Evaluación general inicial organizada por órganos y sistemas.</p>
    <CuestionarioFuncionalForm pacienteId={id} />
  </div>;
}

