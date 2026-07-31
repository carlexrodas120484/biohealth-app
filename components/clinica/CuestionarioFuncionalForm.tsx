'use client';

import { useEffect, useMemo, useState } from 'react';
import { ESCALA_SCREENING, PREGUNTAS_SCREENING, calcularPuntajes } from '@/lib/clinica/cuestionario';

export function CuestionarioFuncionalForm({ pacienteId }: { pacienteId: string }) {
  const sistemas = Array.from(new Set(PREGUNTAS_SCREENING.map(p => p.sistema)));
  const [activo, setActivo] = useState(sistemas[0]);
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [historia, setHistoria] = useState<Record<string, unknown>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    fetch(`/api/pacientes/${pacienteId}/historia`).then(r => r.json()).then(body => {
      setRespuestas(body.respuestas ?? {}); setHistoria(body.historia ?? {});
    }).finally(() => setCargando(false));
  }, [pacienteId]);

  const puntajes = useMemo(() => calcularPuntajes(respuestas), [respuestas]);
  const preguntas = PREGUNTAS_SCREENING.filter(p => p.sistema === activo);
  const contestadas = Object.keys(respuestas).length;

  async function guardar(completado = false) {
    setGuardando(true); setMensaje('');
    const res = await fetch(`/api/pacientes/${pacienteId}/historia`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ historia, respuestas, completado }),
    });
    const body = await res.json();
    setMensaje(res.ok ? (completado ? 'Screening finalizado y guardado.' : 'Avance guardado.') : body.error ?? 'No se pudo guardar.');
    setGuardando(false);
  }

  if (cargando) return <p className="text-sm text-choco-soft">Cargando cuestionario…</p>;

  return <div className="space-y-5">
    <section className="rounded-card border border-linea bg-white p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div><p className="text-[9.5px] font-semibold uppercase tracking-wider text-oro">Screening general</p>
          <p className="mt-1 text-xs text-choco-soft">0 nunca · 1 leve · 2 moderado · 3 frecuente · 4 intenso</p></div>
        <p className="font-mono text-xs text-choco-soft">{contestadas}/{PREGUNTAS_SCREENING.length}</p>
      </div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {sistemas.map(s => <button key={s} onClick={() => setActivo(s)} className={`rounded-full px-3 py-1.5 text-xs ${s === activo ? 'bg-oro text-white' : 'border border-linea text-choco-soft'}`}>{s}</button>)}
      </div>
      <div className="space-y-4">
        {preguntas.map(p => <div key={p.id} className="border-b border-linea pb-4 last:border-none">
          <p className="mb-2 text-sm text-choco-deep">{p.texto}</p>
          <div className="grid grid-cols-5 gap-1.5">
            {ESCALA_SCREENING.map((label, valor) => <button key={label} title={label} onClick={() => setRespuestas(prev => ({ ...prev, [p.id]: valor }))}
              className={`rounded-md border py-2 text-xs ${respuestas[p.id] === valor ? 'border-oro-claro bg-oro-wash text-choco-deep' : 'border-linea text-choco-soft'}`}>{valor}</button>)}
          </div>
        </div>)}
      </div>
    </section>

    <section className="rounded-card border border-linea bg-white p-5">
      <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Resumen por sistemas</p>
      <div className="space-y-2">
        {sistemas.map(s => <div key={s} className="grid grid-cols-[1fr_3fr_42px] items-center gap-3 text-xs">
          <span className="text-choco-mid">{s}</span><div className="h-2 rounded-full bg-marfil"><div className="h-2 rounded-full bg-oro" style={{ width: `${puntajes[s]?.porcentaje ?? 0}%` }} /></div>
          <span className="text-right font-mono text-choco-soft">{puntajes[s]?.porcentaje ?? 0}%</span>
        </div>)}
      </div>
    </section>

    <p className="text-[11.5px] text-choco-soft">Instrumento de screening clínico. No sustituye la anamnesis, el examen físico ni el diagnóstico médico.</p>
    {mensaje && <p className="text-sm text-choco-mid">{mensaje}</p>}
    <div className="flex flex-wrap gap-2">
      <button onClick={() => guardar(false)} disabled={guardando} className="rounded-md border border-linea-fuerte px-5 py-2.5 text-sm text-choco-deep">Guardar avance</button>
      <button onClick={() => guardar(true)} disabled={guardando || contestadas < PREGUNTAS_SCREENING.length} className="rounded-md bg-choco-deep px-5 py-2.5 text-sm text-crema disabled:opacity-40">Finalizar screening</button>
    </div>
  </div>;
}

