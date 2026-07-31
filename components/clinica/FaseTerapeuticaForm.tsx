'use client';

import { useEffect, useMemo, useState } from 'react';
import { Paso6Fase } from '@/components/flujo/Paso6Fase';
import { DOMINIOS, FASES, type Fase } from '@/lib/algoritmo/fases';
import type { AlteracionInput } from '@/lib/algoritmo/ipt';

type Alteracion = Pick<AlteracionInput, 'id' | 'nombre' | 'dominio' | 'nivel'>;
type Evaluacion = Omit<AlteracionInput, 'id' | 'nombre' | 'dominio' | 'nivel'> & { alteracionId: string };
type Clasificacion = { alteracionId: string; dominioFase: string };

const OPCIONES = [
  [DOMINIOS.BARRERA, 'Barrera o microbiota'], [DOMINIOS.INFLAMATORIO, 'Inflamación o daño tisular'],
  [DOMINIOS.TOXICO_METABOLICO, 'Carga tóxica o metabólica'], [DOMINIOS.EJE_ESPECIFICO, 'Eje o sistema específico'],
  [DOMINIOS.DEFICIT_RESIDUAL, 'Déficit funcional residual'],
] as const;
const input = 'w-full rounded-md border border-linea bg-white px-3 py-2 text-sm focus:border-oro-claro focus:outline-none focus:ring-2 focus:ring-oro/10';

export function FaseTerapeuticaForm({ pacienteId }: { pacienteId: string }) {
  const [alteraciones, setAlteraciones] = useState<Alteracion[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [clasificaciones, setClasificaciones] = useState<Clasificacion[]>([]);
  const [banderaRoja, setBanderaRoja] = useState(false);
  const [iptConfirmado, setIptConfirmado] = useState(false);
  const [faseSugerida, setFaseSugerida] = useState<Fase>('balance');
  const [faseSeleccionada, setFaseSeleccionada] = useState<Fase>('balance');
  const [motivo, setMotivo] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    fetch(`/api/pacientes/${pacienteId}/fase`).then(async r => {
      const b = await r.json(); if (!r.ok) throw new Error(b.error ?? 'No se pudo cargar la fase.');
      setAlteraciones(b.alteraciones ?? []); setEvaluaciones(b.evaluaciones ?? []);
      setClasificaciones(b.clasificaciones ?? []); setBanderaRoja(Boolean(b.banderaRoja));
      setIptConfirmado(Boolean(b.iptConfirmado)); setFaseSugerida(b.faseSugerida ?? 'balance');
      setFaseSeleccionada(b.faseSeleccionada ?? b.faseSugerida ?? 'balance');
      setMotivo(b.motivoAnulacion ?? ''); setConfirmado(Boolean(b.confirmado));
    }).catch(e => setMensaje(e instanceof Error ? e.message : 'No se pudo cargar la fase.'))
      .finally(() => setCargando(false));
  }, [pacienteId]);

  const entradas = useMemo<AlteracionInput[]>(() => {
    const ePorId = new Map(evaluaciones.map(e => [e.alteracionId, e]));
    const cPorId = new Map(clasificaciones.map(c => [c.alteracionId, c.dominioFase]));
    return alteraciones.flatMap(a => {
      const e = ePorId.get(a.id); if (!e) return [];
      return [{ ...a, ...e, dominio: cPorId.get(a.id) ?? DOMINIOS.DEFICIT_RESIDUAL }];
    });
  }, [alteraciones, evaluaciones, clasificaciones]);

  function cambiarClasificacion(alteracionId: string, dominioFase: string) {
    setClasificaciones(prev => prev.map(c => c.alteracionId === alteracionId ? { ...c, dominioFase } : c));
    setConfirmado(false);
  }

  async function guardar(confirmar: boolean) {
    setGuardando(true); setMensaje('');
    const res = await fetch(`/api/pacientes/${pacienteId}/fase`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clasificaciones, faseSeleccionada, motivoAnulacion: motivo, confirmado: confirmar }),
    });
    const b = await res.json();
    if (res.ok) {
      setFaseSugerida(b.resultado.fase); setConfirmado(confirmar);
      setMensaje(confirmar ? 'Fase terapéutica confirmada y guardada.' : 'Borrador de fase guardado.');
    } else setMensaje(b.error ?? 'No se pudo guardar la fase.');
    setGuardando(false);
  }

  if (cargando) return <p className="text-sm text-choco-soft">Calculando fase terapéutica…</p>;
  if (!iptConfirmado) return <div className="rounded-card border border-linea bg-white p-5 text-sm text-choco-soft">Primero confirme el IPT en el paso 5.</div>;

  return <div className="space-y-5">
    {banderaRoja && <div className="rounded-md border border-fase-reset/30 bg-fase-reset/10 p-4 text-sm text-fase-reset">
      Existe una bandera roja en la historia clínica. El sistema no permite confirmar una fase hasta derivar o estabilizar al paciente.
    </div>}

    <section className="rounded-card border border-linea bg-white p-5">
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Clasificación para las compuertas</p>
      <p className="mb-4 text-xs text-choco-soft">Revise la categoría sugerida para cada alteración antes de confirmar.</p>
      <div className="space-y-3">{alteraciones.map(a => <div key={a.id} className="grid items-center gap-3 border-b border-linea pb-3 md:grid-cols-[1fr_280px]">
        <div><p className="text-sm text-choco-deep">{a.nombre}</p><p className="text-xs text-choco-soft">Dominio diagnóstico: {a.dominio}</p></div>
        <select className={input} value={clasificaciones.find(c => c.alteracionId === a.id)?.dominioFase ?? DOMINIOS.DEFICIT_RESIDUAL}
          onChange={e => cambiarClasificacion(a.id, e.target.value)}>{OPCIONES.map(([v,n]) => <option key={v} value={v}>{n}</option>)}</select>
      </div>)}</div>
    </section>

    <Paso6Fase alteraciones={entradas} banderaRoja={banderaRoja} faseSeleccionada={faseSeleccionada}
      onSeleccionarFase={(fase) => { setFaseSeleccionada(fase); setConfirmado(false); }} />

    {faseSeleccionada !== faseSugerida && <label className="block rounded-card border border-linea bg-white p-5 text-xs text-choco-soft">
      Motivo clínico para elegir {FASES[faseSeleccionada].nombre} en lugar de {FASES[faseSugerida].nombre}
      <textarea rows={3} className={`${input} mt-2`} value={motivo} onChange={e => setMotivo(e.target.value)} />
    </label>}

    {mensaje && <p className="text-sm text-choco-mid">{mensaje}</p>}
    <div className="flex flex-wrap gap-2">
      <button onClick={() => guardar(false)} disabled={guardando} className="rounded-md border border-linea-fuerte px-5 py-2.5 text-sm disabled:opacity-40">Guardar borrador</button>
      <button onClick={() => guardar(true)} disabled={guardando || banderaRoja} className="rounded-md bg-choco-deep px-5 py-2.5 text-sm text-crema disabled:opacity-40">Confirmar fase</button>
    </div>
    {confirmado && <p className="text-xs text-choco-soft">Estado actual: fase {FASES[faseSeleccionada].nombre} confirmada.</p>}
  </div>;
}
