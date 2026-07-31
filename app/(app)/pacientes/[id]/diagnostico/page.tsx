import { DiagnosticoFuncionalForm } from '@/components/clinica/DiagnosticoFuncionalForm';

export default async function DiagnosticoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="mx-auto max-w-5xl">
    <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 4</p>
    <h1 className="mb-1 font-serif text-3xl text-choco-deep">Diagnóstico funcional</h1>
    <p className="mb-5 text-[12.5px] text-choco-soft">Integración médica del cuestionario, bioescáner y razonamiento clínico.</p>
    <DiagnosticoFuncionalForm pacienteId={id} />
  </div>;
}
