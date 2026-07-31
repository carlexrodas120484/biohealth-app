import { IPTForm } from '@/components/clinica/IPTForm';

export default async function IPTPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="mx-auto max-w-5xl">
    <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 5</p>
    <h1 className="mb-1 font-serif text-3xl text-choco-deep">Índice de prioridad terapéutica</h1>
    <p className="mb-5 text-[12.5px] text-choco-soft">Priorización clínica de las alteraciones definidas en el diagnóstico funcional.</p>
    <IPTForm pacienteId={id} />
  </div>;
}
