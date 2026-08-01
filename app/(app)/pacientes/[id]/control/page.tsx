import { ControlClinicoForm } from '@/components/clinica/ControlClinicoForm';

export default async function ControlPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ControlClinicoForm pacienteId={id} />;
}
