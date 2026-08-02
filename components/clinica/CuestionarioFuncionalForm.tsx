'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { siguientePaso } from '@/lib/flujo/pasos';
import {
  ESCALA_SCREENING, PREGUNTAS_SCREENING, SISTEMAS_CUESTIONARIO,
  calcularPuntajes, ordenarPorSeveridad, obtenerTopSintomas,
  ETIQUETA_SEVERIDAD, ADVERTENCIA_CRIBADO, type SistemaOrdenado,
} from '@/lib/clinica/cuestionario';

const SISTEMAS_ORDENADOS = [...SISTEMAS_CUESTIONARIO].sort((a, b) => a.orden - b.orden);

function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PY', { dateStyle: 'medium', timeStyle: 'short' });
}

export function CuestionarioFuncionalForm({ pacienteId }: { pacienteId: string }) {
  const router = useRouter();
  const [activo, setActivo] = useState(SISTEMAS_ORDENADOS[0].nombre);
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [historia, setHistoria] = useState<Record<string, unknown>>({});
  const [actualizadoEn, setActualizadoEn] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [esError, setEsError] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/pacientes/${pacienteId}/historia`)
      .then(r => r.json())
      .then(body => {
        if (cancelado) return;
        setRespuestas(body.respuestas ?? {});
        setHistoria(body.historia ?? {});
        setActualizadoEn(body.updatedAt ?? null);
      })
      .catch(() => {
        if (!cancelado) { setMensaje('No se pudo cargar el cuestionario.'); setEsError(true); }
      })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [pacienteId]);

  const puntajes = useMemo(() => calcularPuntajes(respuestas), [respuestas]);
  const sistemasPorSeveridad = useMemo(() => ordenarPorSeveridad(puntajes), [puntajes]);
  const topSintomas = useMemo(() => obtenerTopSintomas(respuestas, 5), [respuestas]);
  const preguntas = PREGUNTAS_SCREENING
    .filter(p => p.sistema === activo && p.activo)
    .sort((a, b) => a.orden - b.orden);
  const contestadas = Object.keys(respuestas).length;
  const totalPreguntas = PREGUNTAS_SCREENING.filter(p => p.activo).length;

  async function guardar(completado = false) {
    setGuardando(true); setMensaje(''); setEsError(false);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/historia`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historia, respuestas, completado }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEsError(true);
        setMensaje(body.error || 'No se pudo guardar.');
        return;
      }
      setActualizadoEn(body.updatedAt ?? null);
      setMensaje(completado ? 'Screening finalizado y guardado.' : 'Avance guardado.');
      if (completado) {
        const siguiente = siguientePaso('cuestionario');
        if (siguiente) router.push(`/pacientes/${pacienteId}/${siguiente}`);
      }
    } catch {
      setEsError(true);
      setMensaje('No se pudo guardar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <p className="text-sm text-choco-soft">Cargando cuestionario…</p>;

  return <div className="space-y-5">
    <section className="rounded-card border border-linea bg-white p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div><p className="text-[9.5px] font-semibold uppercase tracking-wider text-oro">Screening general</p>
          <p className="mt-1 text-xs text-choco-soft">0 nunca · 1 leve · 2 moderado · 3 frecuente · 4 intenso</p></div>
        <p className="font-mono text-xs text-choco-soft">{contestadas}/{totalPreguntas}</p>
      </div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {SISTEMAS_ORDENADOS.map(s => <button key={s.id} onClick={() => setActivo(s.nombre)} className={`rounded-full px-3 py-1.5 text-xs ${s.nombre === activo ? 'bg-oro text-white' : 'border border-linea text-choco-soft'}`}>{s.nombre}</button>)}
      </div>
      <div className="space-y-4">
        {preguntas.length === 0 && (
          <p className="text-sm text-choco-soft">Todavía no hay preguntas cargadas para este sistema.</p>
        )}
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
      <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Resumen por sistemas (mayor a menor)</p>
      {sistemasPorSeveridad.length === 0 && (
        <p className="text-xs text-choco-soft">Todavía no hay respuestas para calcular un resumen.</p>
      )}
      <div className="space-y-2">
        {sistemasPorSeveridad.map(({ sistema, ...r }: SistemaOrdenado) => (
          <div key={sistema} className="grid grid-cols-[1fr_3fr_auto_100px] items-center gap-3 text-xs">
            <span className="text-choco-mid">{sistema}</span>
            <div className="h-2 rounded-full bg-marfil"><div className="h-2 rounded-full bg-oro" style={{ width: `${r.porcentaje}%` }} /></div>
            <span className="text-right font-mono text-choco-soft">{r.porcentaje}%</span>
            <span className="text-right text-[11px] text-choco-soft">{ETIQUETA_SEVERIDAD[r.severidad]}</span>
          </div>
        ))}
      </div>
    </section>

    {topSintomas.length > 0 && (
      <section className="rounded-card border border-linea bg-white p-5">
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Síntomas con mayor puntuación</p>
        <ol className="space-y-1.5 text-xs text-choco-mid">
          {topSintomas.map((s, i) => (
            <li key={s.id} className="flex items-center justify-between gap-3">
              <span>{i + 1}. {s.texto} <span className="text-choco-soft">({s.sistema})</span></span>
              <span className="font-mono text-choco-soft">{s.valor}</span>
            </li>
          ))}
        </ol>
      </section>
    )}

    <p className="text-[11.5px] text-choco-soft">{ADVERTENCIA_CRIBADO}</p>
    <p className="text-[11px] text-choco-soft">Última actualización: {formatearFecha(actualizadoEn)}</p>
    {mensaje && <p className={`text-sm ${esError ? 'text-fase-reset' : 'text-choco-mid'}`}>{mensaje}</p>}
    <div className="flex flex-wrap gap-2">
      <button onClick={() => guardar(false)} disabled={guardando} className="rounded-md border border-linea-fuerte px-5 py-2.5 text-sm text-choco-deep">Guardar avance</button>
      <button onClick={() => guardar(true)} disabled={guardando || contestadas < totalPreguntas} className="rounded-md bg-choco-deep px-5 py-2.5 text-sm text-crema disabled:opacity-40">Finalizar screening</button>
    </div>
  </div>;
}
