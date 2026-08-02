'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Paso5IPT } from '@/components/flujo/Paso5IPT';
import { sugerirPuntuacionPorNivel, type AlteracionInput, type NivelJerarquico } from '@/lib/algoritmo/ipt';
import { siguientePaso } from '@/lib/flujo/pasos';

type Alteracion = Pick<AlteracionInput, 'id' | 'nombre' | 'dominio' | 'nivel'>;
type Evaluacion = Pick<AlteracionInput, 'perpetuadorActivo' | 'cronicidadMeses' | 'IC' | 'IS' | 'RV' | 'EV' | 'CB'> & { alteracionId: string };
type Criterio = 'IC' | 'IS' | 'RV' | 'EV' | 'CB';

const CRITERIOS: { clave: Criterio; nombre: string; ayuda: string }[] = [
  { clave: 'IC', nombre: 'Impacto clínico', ayuda: 'Gravedad e impacto actual en el paciente.' },
  { clave: 'IS', nombre: 'Influencia sistémica', ayuda: 'Cantidad e importancia de sistemas afectados.' },
  { clave: 'RV', nombre: 'Reversibilidad', ayuda: 'Probabilidad de mejoría con intervención.' },
  { clave: 'EV', nombre: 'Evidencia científica', ayuda: 'Solidez del respaldo para intervenir.' },
  { clave: 'CB', nombre: 'Costo-beneficio', ayuda: 'Beneficio esperado frente a carga, riesgo y costo.' },
];
const select = 'w-full rounded-md border border-linea bg-white px-2 py-2 text-sm focus:border-oro-claro focus:outline-none focus:ring-2 focus:ring-oro/10';

/** Sin evaluación previa: parte de un valor sugerido por nivel jerárquico, no de cero — el médico lo ajusta antes de confirmar. */
function nuevaEvaluacion(id: string, nivel: NivelJerarquico = 'secundaria'): Evaluacion {
  const sugerido = sugerirPuntuacionPorNivel(nivel);
  return { alteracionId: id, perpetuadorActivo: false, cronicidadMeses: 0, IC: sugerido, IS: sugerido, RV: sugerido, EV: sugerido, CB: sugerido };
}

export function IPTForm({ pacienteId }: { pacienteId: string }) {
  const router = useRouter();
  const [alteraciones, setAlteraciones] = useState<Alteracion[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [diagnosticoConfirmado, setDiagnosticoConfirmado] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    fetch(`/api/pacientes/${pacienteId}/ipt`).then(async r => {
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'No se pudo cargar el IPT.');
      const alts = (body.alteraciones ?? []) as Alteracion[];
      const guardadas = (body.evaluaciones ?? []) as Evaluacion[];
      const porId = new Map(guardadas.map(e => [e.alteracionId, e]));
      setAlteraciones(alts);
      setEvaluaciones(alts.map(a => porId.get(a.id) ?? nuevaEvaluacion(a.id, a.nivel)));
      setDiagnosticoConfirmado(Boolean(body.diagnosticoConfirmado));
      setConfirmado(Boolean(body.confirmado));
    }).catch(e => setMensaje(e instanceof Error ? e.message : 'No se pudo cargar el IPT.'))
      .finally(() => setCargando(false));
  }, [pacienteId]);

  const entradas = useMemo<AlteracionInput[]>(() => alteraciones.map(a => {
    const e = evaluaciones.find(x => x.alteracionId === a.id) ?? nuevaEvaluacion(a.id, a.nivel);
    return { ...a, ...e };
  }), [alteraciones, evaluaciones]);

  function cambiar(id: string, campo: keyof Evaluacion, valor: number | boolean) {
    setEvaluaciones(prev => prev.map(e => e.alteracionId === id ? { ...e, [campo]: valor } : e));
  }

  async function guardar(confirmar: boolean) {
    setGuardando(true); setMensaje('');
    const res = await fetch(`/api/pacientes/${pacienteId}/ipt`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evaluaciones, confirmado: confirmar }),
    });
    const body = await res.json();
    if (res.ok) {
      setConfirmado(confirmar);
      setMensaje(confirmar ? 'IPT confirmado y guardado.' : 'Borrador IPT guardado.');
      if (confirmar) {
        const siguiente = siguientePaso('ipt');
        if (siguiente) router.push(`/pacientes/${pacienteId}/${siguiente}`);
      }
    } else setMensaje(body.error ?? 'No se pudo guardar el IPT.');
    setGuardando(false);
  }

  if (cargando) return <p className="text-sm text-choco-soft">Cargando índice terapéutico…</p>;
  if (alteraciones.length === 0) return <div className="rounded-card border border-linea bg-white p-5 text-sm text-choco-soft">
    Primero agregue y guarde al menos una alteración en el paso 4: Diagnóstico funcional.
  </div>;

  return <div className="space-y-5">
    {!diagnosticoConfirmado && <p className="rounded-md border border-oro-claro bg-oro-wash p-3 text-xs text-choco-mid">
      El diagnóstico funcional está como borrador. Puede calcular el IPT, pero conviene confirmar primero el paso 4.
    </p>}

    <section className="space-y-4">
      {alteraciones.map(a => {
        const e = evaluaciones.find(x => x.alteracionId === a.id) ?? nuevaEvaluacion(a.id, a.nivel);
        return <article key={a.id} className="rounded-card border border-linea bg-white p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="font-serif text-xl text-choco-deep">{a.nombre}</h3><p className="text-xs text-choco-soft">{a.dominio} · Jerarquía {a.nivel}</p></div>
            <label className="flex items-center gap-2 text-xs text-choco-mid"><input type="checkbox" checked={e.perpetuadorActivo}
              onChange={x => cambiar(a.id, 'perpetuadorActivo', x.target.checked)} /> Perpetuador activo (+8)</label>
          </div>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {CRITERIOS.map(c => <label key={c.clave} className="text-xs text-choco-soft" title={c.ayuda}>{c.nombre}
              <select className={`${select} mt-1`} value={e[c.clave]} onChange={x => cambiar(a.id, c.clave, Number(x.target.value))}>
                {[0,1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
              </select></label>)}
            <label className="text-xs text-choco-soft">Cronicidad (meses)
              <input type="number" min={0} max={1200} className={`${select} mt-1`} value={e.cronicidadMeses ?? 0}
                onChange={x => cambiar(a.id, 'cronicidadMeses', Math.max(0, Number(x.target.value) || 0))} />
            </label>
          </div>
          <p className="mt-3 text-[10.5px] text-choco-soft">Escala: 0 = ausente/sin respaldo · 5 = máximo. Pase el cursor sobre cada criterio para ver su definición.</p>
        </article>;
      })}
    </section>

    <Paso5IPT alteraciones={entradas} />
    {mensaje && <p className="text-sm text-choco-mid">{mensaje}</p>}
    <div className="flex flex-wrap gap-2">
      <button onClick={() => guardar(false)} disabled={guardando} className="rounded-md border border-linea-fuerte px-5 py-2.5 text-sm disabled:opacity-40">Guardar borrador</button>
      <button onClick={() => guardar(true)} disabled={guardando} className="rounded-md bg-choco-deep px-5 py-2.5 text-sm text-crema disabled:opacity-40">Confirmar IPT</button>
    </div>
    {confirmado && <p className="text-xs text-choco-soft">Estado actual: IPT confirmado.</p>}
  </div>;
}
