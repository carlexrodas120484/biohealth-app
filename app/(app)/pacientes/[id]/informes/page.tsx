import { InformesClinicos } from '@/components/clinica/InformesClinicos';

export default async function InformesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="mx-auto max-w-6xl">
    <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 11</p>
    <h1 className="mb-1 font-serif text-3xl text-choco-deep">Informe clínico y PDF</h1>
    <p className="mb-5 text-[12.5px] text-choco-soft">Genera documentos profesionales con los datos ya aprobados del paciente. No incluye borradores ni sugerencias sin confirmar.</p>
    <InformesClinicos pacienteId={id} />
  </div>;
}
