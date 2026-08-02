'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { siguientePaso } from '@/lib/flujo/pasos';

type Severidad = 'ok' | 'med' | 'alto';
type Hallazgo = { id: string; parametro: string; valor: string; referencia: string; severidad: Severidad };

const input = 'w-full rounded-md border border-linea px-3 py-2 text-sm focus:border-oro-claro focus:outline-none focus:ring-2 focus:ring-oro/10';
const ETIQUETA: Record<Severidad, string> = { ok: 'Normal', med: 'Medio', alto: 'Alto' };

export function BioescanerForm({ pacienteId }: { pacienteId: string }) {
  const router = useRouter();
  const [fecha, setFecha] = useState('');
  const [equipo, setEquipo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  const [archivoUrl, setArchivoUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    fetch(`/api/pacientes/${pacienteId}/bioescaner`).then(r => r.json()).then(body => {
      setFecha(body.fecha ?? ''); setEquipo(body.equipo ?? '');
      setObservaciones(body.observaciones ?? ''); setHallazgos(body.hallazgos ?? []);
      setArchivoUrl(body.archivoUrl ?? null);
    }).finally(() => setCargando(false));
  }, [pacienteId]);

  const agregar = () => setHallazgos(prev => [...prev, {
    id: crypto.randomUUID(), parametro: '', valor: '', referencia: '', severidad: 'med',
  }]);
  const cambiar = (id: string, campo: keyof Hallazgo, valor: string) =>
    setHallazgos(prev => prev.map(h => h.id === id ? { ...h, [campo]: valor } : h));

  async function guardar() {
    setGuardando(true); setMensaje('');
    const res = await fetch(`/api/pacientes/${pacienteId}/bioescaner`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, equipo, observaciones, hallazgos: hallazgos.filter(h => h.parametro.trim()) }),
    });
    const body = await res.json();
    setMensaje(res.ok ? 'Bioescáner guardado correctamente.' : body.error ?? 'No se pudo guardar.');
    setGuardando(false);
    if (res.ok) {
      const siguiente = siguientePaso('bioescaner');
      if (siguiente) router.push(`/pacientes/${pacienteId}/${siguiente}`);
    }
  }

  async function subir(archivo?: File) {
    if (!archivo) return;
    setGuardando(true); setMensaje('Subiendo informe…');
    const form = new FormData(); form.append('archivo', archivo);
    const res = await fetch(`/api/pacientes/${pacienteId}/bioescaner`, { method: 'POST', body: form });
    const body = await res.json();
    if (res.ok) { setArchivoUrl(body.archivoUrl); setMensaje('Informe PDF cargado correctamente.'); }
    else setMensaje(body.error ?? 'No se pudo cargar el informe.');
    setGuardando(false);
  }

  if (cargando) return <p className="text-sm text-choco-soft">Cargando bioescáner…</p>;

  return <div className="space-y-5">
    <section className="grid gap-4 rounded-card border border-linea bg-white p-5 sm:grid-cols-2">
      <label className="text-xs text-choco-soft">Fecha del estudio<input type="date" className={`${input} mt-1.5`} value={fecha} onChange={e => setFecha(e.target.value)} /></label>
      <label className="text-xs text-choco-soft">Equipo o procedencia<input className={`${input} mt-1.5`} value={equipo} onChange={e => setEquipo(e.target.value)} placeholder="Ej.: BioScan Pro" /></label>
      <label className="sm:col-span-2 text-xs text-choco-soft">Observaciones<textarea rows={3} className={`${input} mt-1.5`} value={observaciones} onChange={e => setObservaciones(e.target.value)} /></label>
    </section>

    <section className="rounded-card border border-linea bg-white p-5">
      <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Informe original</p>
      <label className="block cursor-pointer rounded-lg border border-dashed border-linea-fuerte p-6 text-center text-sm text-choco-soft">
        <input type="file" accept="application/pdf" className="hidden" onChange={e => subir(e.target.files?.[0])} />
        Seleccionar informe PDF · máximo 8 MB
      </label>
      {archivoUrl && <a href={archivoUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-oro underline">Abrir informe privado</a>}
    </section>

    <section className="rounded-card border border-linea bg-white p-5">
      <div className="mb-4 flex items-center justify-between"><p className="text-[9.5px] font-semibold uppercase tracking-wider text-oro">Hallazgos relevantes</p>
        <button onClick={agregar} className="rounded-md border border-linea-fuerte px-3 py-1.5 text-xs text-choco-deep">+ Agregar</button></div>
      <div className="space-y-3">
        {hallazgos.length === 0 && <p className="text-sm text-choco-soft">Todavía no se cargaron hallazgos.</p>}
        {hallazgos.map(h => <div key={h.id} className="grid gap-2 rounded-lg border border-linea p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <input className={input} placeholder="Parámetro" value={h.parametro} onChange={e => cambiar(h.id, 'parametro', e.target.value)} />
          <input className={input} placeholder="Valor" value={h.valor} onChange={e => cambiar(h.id, 'valor', e.target.value)} />
          <input className={input} placeholder="Referencia" value={h.referencia} onChange={e => cambiar(h.id, 'referencia', e.target.value)} />
          <div className="flex gap-1">
            {(['ok','med','alto'] as Severidad[]).map(s => <button key={s} title={ETIQUETA[s]} onClick={() => cambiar(h.id, 'severidad', s)}
              className={`rounded px-2 text-[11px] ${h.severidad === s ? 'bg-oro-wash text-choco-deep ring-1 ring-oro-claro' : 'border border-linea text-choco-soft'}`}>{ETIQUETA[s]}</button>)}
            <button onClick={() => setHallazgos(prev => prev.filter(x => x.id !== h.id))} className="px-2 text-sm text-fase-reset">×</button>
          </div>
        </div>)}
      </div>
    </section>

    <p className="text-[11.5px] text-choco-soft">El bioescáner es una herramienta complementaria. Sus hallazgos no constituyen por sí solos un diagnóstico médico.</p>
    {mensaje && <p className="text-sm text-choco-mid">{mensaje}</p>}
    <button onClick={guardar} disabled={guardando} className="rounded-md bg-choco-deep px-6 py-2.5 text-sm text-crema disabled:opacity-50">{guardando ? 'Procesando…' : 'Guardar bioescáner'}</button>
  </div>;
}
