'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Paso7Objetivos } from '@/components/flujo/Paso7Objetivos';
import { FASES, type Fase } from '@/lib/algoritmo/fases';
import { siguientePaso } from '@/lib/flujo/pasos';

type Respuesta = {
  fase: Fase;
  objetivosDisponibles: string[];
  semanasMinimas: number;
  objetivos: string[];
  semanasPrevistas: number;
  confirmado: boolean;
};

export function ObjetivosTerapeuticosForm({ pacienteId }: { pacienteId: string }) {
  const router = useRouter();
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [semanas, setSemanas] = useState(0);
  const [confirmado, setConfirmado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    fetch(`/api/pacientes/${pacienteId}/objetivos`).then(async r => {
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? 'No se pudieron cargar los objetivos.');
      const respuesta = b as Respuesta;
      setDatos(respuesta);
      setSemanas(respuesta.semanasPrevistas);
      setConfirmado(respuesta.confirmado);
      const elegidos = new Set(respuesta.objetivos);
      setSeleccionados(new Set(respuesta.objetivosDisponibles.flatMap((o, i) => elegidos.has(o) ? [i] : [])));
    }).catch(e => setMensaje(e instanceof Error ? e.message : 'No se pudieron cargar los objetivos.'))
      .finally(() => setCargando(false));
  }, [pacienteId]);

  const objetivos = useMemo(() => datos
    ? datos.objetivosDisponibles.filter((_o, i) => seleccionados.has(i))
    : [], [datos, seleccionados]);

  function alternar(index: number) {
    setSeleccionados(prev => {
      const siguiente = new Set(prev);
      if (siguiente.has(index)) siguiente.delete(index); else siguiente.add(index);
      return siguiente;
    });
    setConfirmado(false);
  }

  async function guardar(confirmar: boolean) {
    if (!datos) return;
    setGuardando(true); setMensaje('');
    const res = await fetch(`/api/pacientes/${pacienteId}/objetivos`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objetivos, semanasPrevistas: semanas, confirmado: confirmar }),
    });
    const b = await res.json();
    if (res.ok) {
      setConfirmado(confirmar);
      setMensaje(confirmar ? 'Objetivos terapéuticos confirmados y guardados.' : 'Borrador de objetivos guardado.');
      if (confirmar) {
        const siguiente = siguientePaso('objetivos');
        if (siguiente) router.push(`/pacientes/${pacienteId}/${siguiente}`);
      }
    } else setMensaje(b.error ?? 'No se pudieron guardar los objetivos.');
    setGuardando(false);
  }

  if (cargando) return <p className="text-sm text-choco-soft">Cargando objetivos terapéuticos…</p>;
  if (!datos) return <div className="rounded-card border border-linea bg-white p-5 text-sm text-choco-soft">{mensaje || 'Confirme primero la fase terapéutica.'}</div>;

  return <div className="space-y-5">
    <Paso7Objetivos fase={datos.fase} seleccionados={seleccionados} onToggle={alternar} />

    <label className="block max-w-sm rounded-card border border-linea bg-white p-5 text-xs text-choco-soft">
      Duración prevista en semanas (mínimo {datos.semanasMinimas})
      <input type="number" min={datos.semanasMinimas} max={104} value={semanas}
        onChange={e => { setSemanas(Number(e.target.value)); setConfirmado(false); }}
        className="mt-2 w-full rounded-md border border-linea bg-white px-3 py-2 text-sm text-choco-deep focus:border-oro-claro focus:outline-none focus:ring-2 focus:ring-oro/10" />
    </label>

    {mensaje && <p className="text-sm text-choco-mid">{mensaje}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => guardar(false)} disabled={guardando || objetivos.length === 0}
        className="rounded-md border border-linea-fuerte px-5 py-2.5 text-sm disabled:opacity-40">Guardar borrador</button>
      <button type="button" onClick={() => guardar(true)} disabled={guardando || objetivos.length === 0}
        className="rounded-md bg-choco-deep px-5 py-2.5 text-sm text-crema disabled:opacity-40">Confirmar objetivos</button>
    </div>
    {confirmado && <p className="text-xs text-choco-soft">Estado actual: {objetivos.length} objetivo{objetivos.length === 1 ? '' : 's'} de la fase {FASES[datos.fase].nombre} confirmado{objetivos.length === 1 ? '' : 's'}.</p>}
  </div>;
}
