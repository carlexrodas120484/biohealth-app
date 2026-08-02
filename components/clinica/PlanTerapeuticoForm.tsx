'use client';

import { useEffect, useState } from 'react';

type EstadoFase = 'sugerida' | 'activa' | 'completada' | 'pausada' | 'descartada';
type Prioridad = 'baja' | 'media' | 'alta' | 'urgente';
type FaseTerapeutica = {
  codigo: string; nombre: string; objetivo: string; prioridad: Prioridad;
  duracionEstimadaSemanas: number; criteriosInicio: string[]; criteriosAvance: string[];
  criteriosPausa: string[]; riesgos: string[]; evidencias: string[]; observacionesMedico: string;
  estado: EstadoFase; orden: number; fechaCalculo: string; version: number;
};
type BanderaSeguridad = { codigo: string; descripcion: string; fuente: string };
type DecisionLocal = { estado: EstadoFase; prioridad: Prioridad; orden: number; duracionEstimadaSemanas: number; objetivo: string; observacionesMedico: string };

const ETIQUETA_ESTADO: Record<EstadoFase, string> = {
  sugerida: 'Sugerida', activa: 'Activa', completada: 'Completada', pausada: 'Pausada', descartada: 'Descartada',
};
const input = 'w-full rounded-md border border-linea px-3 py-2 text-sm focus:border-oro-claro focus:outline-none focus:ring-2 focus:ring-oro/10';

function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PY', { dateStyle: 'medium', timeStyle: 'short' });
}

function aDecision(f: FaseTerapeutica): DecisionLocal {
  return {
    estado: f.estado, prioridad: f.prioridad, orden: f.orden,
    duracionEstimadaSemanas: f.duracionEstimadaSemanas, objetivo: f.objetivo, observacionesMedico: f.observacionesMedico,
  };
}

export function PlanTerapeuticoForm({ pacienteId }: { pacienteId: string }) {
  const [fases, setFases] = useState<FaseTerapeutica[]>([]);
  const [decisiones, setDecisiones] = useState<Record<string, DecisionLocal>>({});
  const [banderas, setBanderas] = useState<BanderaSeguridad[]>([]);
  const [advertencia, setAdvertencia] = useState('');
  const [actualizadoEn, setActualizadoEn] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [esError, setEsError] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/pacientes/${pacienteId}/plan-terapeutico`)
      .then(r => r.json())
      .then(body => {
        if (cancelado) return;
        const recibidas: FaseTerapeutica[] = body.fases ?? [];
        setFases(recibidas);
        setDecisiones(Object.fromEntries(recibidas.map(f => [f.codigo, aDecision(f)])));
        setBanderas(body.banderasSeguridad ?? []);
        setAdvertencia(body.advertencia ?? '');
        setActualizadoEn(body.updatedAt ?? null);
      })
      .catch(() => { if (!cancelado) { setMensaje('No se pudo cargar el plan terapéutico.'); setEsError(true); } })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [pacienteId]);

  function cambiarDecision(codigo: string, cambio: Partial<DecisionLocal>) {
    setDecisiones(prev => {
      const actual = prev[codigo] ?? aDecision(fases.find(f => f.codigo === codigo)!);
      return { ...prev, [codigo]: { ...actual, ...cambio } };
    });
  }

  function mover(codigo: string, direccion: -1 | 1) {
    const ordenadas = [...fases].sort((a, b) => (decisiones[a.codigo]?.orden ?? a.orden) - (decisiones[b.codigo]?.orden ?? b.orden));
    const i = ordenadas.findIndex(f => f.codigo === codigo);
    const j = i + direccion;
    if (i < 0 || j < 0 || j >= ordenadas.length) return;
    const ordenActual = decisiones[ordenadas[i].codigo]?.orden ?? ordenadas[i].orden;
    const ordenVecino = decisiones[ordenadas[j].codigo]?.orden ?? ordenadas[j].orden;
    cambiarDecision(ordenadas[i].codigo, { orden: ordenVecino });
    cambiarDecision(ordenadas[j].codigo, { orden: ordenActual });
  }

  async function guardar() {
    setGuardando(true); setMensaje(''); setEsError(false);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/plan-terapeutico`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionesFases: Object.entries(decisiones).map(([codigo, d]) => ({ codigo, ...d })) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setEsError(true); setMensaje(body.error || 'No se pudo guardar.'); return; }
      const guardadas: FaseTerapeutica[] = body.fases ?? [];
      setFases(guardadas);
      setDecisiones(Object.fromEntries(guardadas.map((f: FaseTerapeutica) => [f.codigo, aDecision(f)])));
      setMensaje('Plan terapéutico guardado.');
    } catch {
      setEsError(true);
      setMensaje('No se pudo guardar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <p className="text-sm text-choco-soft">Cargando plan terapéutico…</p>;

  const ordenadas = [...fases].sort((a, b) => (decisiones[a.codigo]?.orden ?? a.orden) - (decisiones[b.codigo]?.orden ?? b.orden));

  return <div className="space-y-5">
    {banderas.length > 0 && (
      <section className="rounded-card border border-fase-reset/20 bg-white p-5">
        <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-wider text-fase-reset">A considerar antes de formular</p>
        <ul className="space-y-1 text-[12.5px] text-choco-mid">
          {banderas.map(b => <li key={b.codigo}>· {b.descripcion}</li>)}
        </ul>
      </section>
    )}

    <section className="rounded-card border border-linea bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[9.5px] font-semibold uppercase tracking-wider text-oro">Fases sugeridas del plan</p>
        <p className="text-[11px] text-choco-soft">Última actualización: {formatearFecha(actualizadoEn)}</p>
      </div>
      {ordenadas.length === 0 && (
        <p className="text-sm text-choco-soft">Todavía no hay patrones funcionales confirmados ni banderas de alarma que sustenten una fase.</p>
      )}
      <div className="space-y-3">
        {ordenadas.map((f, i) => {
          const d = decisiones[f.codigo] ?? aDecision(f);
          return (
            <div key={f.codigo} className="rounded-lg border border-linea p-4">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button onClick={() => mover(f.codigo, -1)} disabled={i === 0} className="text-[10px] text-choco-soft disabled:opacity-30">▲</button>
                    <button onClick={() => mover(f.codigo, 1)} disabled={i === ordenadas.length - 1} className="text-[10px] text-choco-soft disabled:opacity-30">▼</button>
                  </div>
                  <p className="text-sm text-choco-deep">{i + 1}. {f.nombre}</p>
                </div>
                <span className="rounded-full border border-linea px-2 py-0.5 text-xs text-choco-soft">{ETIQUETA_ESTADO[d.estado]}</span>
              </div>

              <label className="mb-2 block text-xs text-choco-soft">Objetivo
                <textarea rows={2} className={`${input} mt-1`} value={d.objetivo} onChange={e => cambiarDecision(f.codigo, { objetivo: e.target.value })} />
              </label>

              {f.evidencias.length > 0 && (
                <ul className="mb-2 space-y-1 text-[11.5px] text-choco-mid">
                  {f.evidencias.map((e, k) => <li key={k}>· {e}</li>)}
                </ul>
              )}

              <details className="mb-3 text-[11.5px] text-choco-mid">
                <summary className="cursor-pointer text-choco-soft">Criterios y riesgos</summary>
                <div className="mt-2 space-y-2">
                  <p><b>Inicio:</b> {f.criteriosInicio.join(' · ')}</p>
                  <p><b>Avance:</b> {f.criteriosAvance.join(' · ')}</p>
                  <p><b>Pausa:</b> {f.criteriosPausa.join(' · ')}</p>
                  <p><b>Riesgos:</b> {f.riesgos.join(' · ')}</p>
                </div>
              </details>

              <div className="grid gap-2 sm:grid-cols-4">
                <select className={input} value={d.prioridad} onChange={e => cambiarDecision(f.codigo, { prioridad: e.target.value as Prioridad })}>
                  <option value="baja">Prioridad baja</option><option value="media">Prioridad media</option>
                  <option value="alta">Prioridad alta</option><option value="urgente">Prioridad urgente</option>
                </select>
                <input type="number" min={1} max={52} className={input} value={d.duracionEstimadaSemanas}
                  onChange={e => cambiarDecision(f.codigo, { duracionEstimadaSemanas: Number(e.target.value) })} placeholder="Semanas" />
                <select className={input} value={d.estado} onChange={e => cambiarDecision(f.codigo, { estado: e.target.value as EstadoFase })}>
                  <option value="sugerida">Sugerida</option><option value="activa">Aprobar y activar</option>
                  <option value="completada">Completada</option><option value="pausada">Pausada</option>
                  <option value="descartada">Rechazar / descartar</option>
                </select>
                <input className={input} placeholder="Observaciones del médico…" value={d.observacionesMedico}
                  onChange={e => cambiarDecision(f.codigo, { observacionesMedico: e.target.value })} />
              </div>
            </div>
          );
        })}
      </div>
    </section>

    <p className="text-[11.5px] text-choco-soft">{advertencia}</p>
    {mensaje && <p className={`text-sm ${esError ? 'text-fase-reset' : 'text-choco-mid'}`}>{mensaje}</p>}
    <button onClick={guardar} disabled={guardando} className="rounded-md bg-choco-deep px-6 py-2.5 text-sm text-crema disabled:opacity-50">
      {guardando ? 'Guardando…' : 'Guardar plan terapéutico'}
    </button>
  </div>;
}
