'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PacienteForm } from '@/components/pacientes/PacienteForm';
import type { PacienteFormValues } from '@/lib/validation/paciente';

export default function NuevoPacientePage() {
  const router = useRouter();

  async function crear(valores: PacienteFormValues) {
    const res = await fetch('/api/pacientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(valores),
    });
    const body = await res.json();
    if (!res.ok) return { error: body.error || 'No se pudo registrar el paciente.' };

    setTimeout(() => {
      router.push(`/pacientes/ficha/${body.paciente.id}`);
      router.refresh();
    }, 800);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/pacientes" className="mb-3 inline-block text-[12.5px] text-choco-soft hover:text-oro">← Volver a pacientes</Link>
      <h1 className="mb-5 font-serif text-3xl text-choco-deep">Nuevo paciente</h1>
      <PacienteForm onSubmit={crear} textoBoton="Registrar paciente" />
    </div>
  );
}
