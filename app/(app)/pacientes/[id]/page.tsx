import { redirect } from 'next/navigation';

export default async function PacienteIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/pacientes/${id}/historia`);
}
