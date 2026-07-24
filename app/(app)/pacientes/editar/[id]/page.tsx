'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PacienteForm } from '@/components/pacientes/PacienteForm';
import type { PacienteFormValues } from '@/lib/validation/paciente';

export default function EditarPacientePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [valores, setValores] = useState<Partial<PacienteFormValues> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/pacientes/${id}`)
      .then(res => res.json())
      .then(body => {
        if (!body.paciente) { setError('Paciente no encontrado.'); return; }
        const p = body.paciente;
        setValores({
          nombre: p.nombre ?? '', apellido: p.apellido ?? '', documento: p.documento ?? '',
          fechaNacimiento: p.fecha_nacimiento ?? '', sexo: p.sexo,
          telefono: p.telefono ?? '', correo: p.correo ?? '', direccion: p.direccion ?? '',
          ciudad: p.ciudad ?? '', ocupacion: p.ocupacion ?? '',
          motivoConsulta: p.motivo_consulta ?? '', antecedentesPersonales: p.antecedentes_personales ?? '',
          antecedentesFamiliares: p.antecedentes_familiares ?? '', medicamentosActuales: p.medicamentos_actuales ?? '',
          alergias: p.alergias ?? '', observaciones: p.observaciones ?? '',
        });
      })
      .catch(() => setError('No se pudo cargar el paciente.'));
  }, [id]);

  async function guardar(v: PacienteFormValues) {
    const res = await fetch(`/api/pacientes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(v),
    });
    const body = await res.json();
    if (!res.ok) return { error: body.error || 'No se pudo guardar los cambios.' };

    setTimeout(() => {
      router.push(`/pacientes/ficha/${id}`);
      router.refresh();
    }, 800);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/pacientes/ficha/${id}`} className="mb-3 inline-block text-[12.5px] text-choco-soft hover:text-oro">← Volver a la ficha</Link>
      <h1 className="mb-5 font-serif text-3xl text-choco-deep">Editar paciente</h1>

      {error && <p className="text-[13px] text-fase-reset">{error}</p>}
      {!error && !valores && <p className="text-[13px] text-choco-soft">Cargando…</p>}
      {valores && <PacienteForm valoresIniciales={valores} onSubmit={guardar} textoBoton="Guardar cambios" />}
    </div>
  );
}
