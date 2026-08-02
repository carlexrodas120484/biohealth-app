'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Estado = 'borrador' | 'en_revision' | 'validado' | 'archivado';

const TRANSICIONES_VALIDAS: Record<Estado, Estado[]> = {
  borrador: ['en_revision', 'archivado'],
  en_revision: ['validado', 'borrador', 'archivado'],
  validado: ['archivado'],
  archivado: ['borrador'],
};
const ETIQUETA_TRANSICION: Record<Estado, string> = {
  borrador: 'Devolver a borrador', en_revision: 'Enviar a revisión', validado: 'Validar', archivado: 'Archivar',
};

export function PrincipioAcciones({ principioId, estado }: { principioId: string; estado: Estado }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<Estado | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [esError, setEsError] = useState(false);

  async function transicionar(nuevoEstado: Estado) {
    if (nuevoEstado === 'validado') {
      const confirmado = window.confirm(
        'Validar este principio activo permite que el motor de formulación lo use como sugerencia clínica revisable. ¿Confirma que revisó los datos cargados?'
      );
      if (!confirmado) return;
    }
    setEnviando(nuevoEstado); setMensaje(''); setEsError(false);
    try {
      const res = await fetch(`/api/admin/base-conocimiento/principios/${principioId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transicion: { estado: nuevoEstado } }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'No se pudo cambiar el estado.');
      router.refresh();
    } catch (err) {
      setEsError(true);
      setMensaje(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setEnviando(null);
    }
  }

  const opciones = TRANSICIONES_VALIDAS[estado] ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {opciones.map(o => (
          <button
            key={o} type="button" disabled={enviando !== null} onClick={() => transicionar(o)}
            className="rounded-md border border-linea bg-white px-3 py-1.5 text-[12.5px] font-medium text-choco-deep hover:bg-crema disabled:opacity-50"
          >
            {enviando === o ? 'Guardando...' : ETIQUETA_TRANSICION[o]}
          </button>
        ))}
      </div>
      {mensaje && <p className={`text-[12.5px] ${esError ? 'text-fase-reset' : 'text-fase-restore'}`}>{mensaje}</p>}
    </div>
  );
}
