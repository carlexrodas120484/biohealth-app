import { NutricionClinicaForm } from '@/components/clinica/NutricionClinicaForm';

export default async function NutricionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NutricionClinicaForm pacienteId={id} />;
}
