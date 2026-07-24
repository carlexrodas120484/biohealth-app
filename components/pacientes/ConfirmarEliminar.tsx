'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ConfirmarEliminarProps {
  pacienteId: string;
  nombreCompleto: string;
}

export function ConfirmarEliminar({ pacienteId, nombreCompleto }: ConfirmarEliminarProps) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setEliminando(true);
    setError(null);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'No se pudo eliminar el paciente.');
      }
      router.push('/pacientes');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setEliminando(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md border border-fase-reset/40 px-3 py-2 text-[13px] text-fase-reset hover:bg-fase-reset/5"
      >
        Eliminar
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-choco-deep/40 px-4">
          <div className="w-full max-w-sm rounded-card border border-linea bg-white p-6">
            <h2 className="mb-2 font-serif text-xl text-choco-deep">Eliminar paciente</h2>
            <p className="mb-1 text-[13.5px] text-choco-mid">
              ¿Confirmás eliminar a <b>{nombreCompleto}</b>?
            </p>
            <p className="mb-5 text-[12px] text-choco-soft">
              El paciente se ocultará de los listados. Los datos no se destruyen y pueden restaurarse si hace falta.
            </p>
            {error && <p className="mb-4 text-[12.5px] text-fase-reset">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setAbierto(false)} disabled={eliminando} className="rounded-md border border-linea-fuerte px-3.5 py-2 text-sm">
                Cancelar
              </button>
              <button
                onClick={confirmar}
                disabled={eliminando}
                className="rounded-md bg-fase-reset px-3.5 py-2 text-sm text-white disabled:opacity-50"
              >
                {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
