'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { siguientePaso } from '@/lib/flujo/pasos';

type Nivel = 'primaria' | 'secundaria' | 'terciaria';
type Alteracion = { id: string; nombre: string; nivel: Nivel; dominio: string; justificacion: string };
type Item = { id: string; nombre: string };
type Puntaje = { puntos: number; maximo: number; porcentaje: number };
type Hallazgo = { id: string; parametro: string; valor: string; referencia: string; severidad: 'ok' | 'med' | 'alto' };

type EstadoPatron = 'sugerido' | 'confirmado' | 'descartado';
type Prioridad = 'baja' | 'media' | 'alta' | 'urgente';
type Evidencia = { fuente: 'cuestionario' | 'historia' | 'bioescaner'; descripcion: string; aporte: number };
type PatronFuncional = {
  codigo: string; nombre: string; descripcion: string; puntaje: number; nivel: string;
  prioridad: Prioridad; evidencias: Evidencia[]; fechaCalculo: string; version: number;
  estado: EstadoPatron; observacionesMedico: string;
};
type DecisionLocal = { estado: EstadoPatron; prioridad: Prioridad; observacionesMedico: string };
type ContextoPaciente = {
  antecedentesPersonales: string | null; antecedentesFamiliares: string | null;
  medicamentosActuales: string | null; alergias: string | null;
};

const DOMINIOS = ['Digestivo', 'Metabólico', 'Inflamatorio', 'Mitocondrial', 'Neuroendocrino', 'Hormonal', 'Inmunológico', 'Detoxificación', 'Cardiovascular', 'Nutricional', 'Otro'];
const input = 'w-full rounded-md border border-linea px-3 py-2 text-sm focus:border-oro-claro focus:outline-none focus:ring-2 focus:ring-oro/10';
const ETIQUETA_NIVEL: Record<string, string> = {
  sin_alteracion: 'Sin evidencia relevante', leve: 'Evidencia leve', moderada: 'Evidencia moderada',
  alta: 'Evidencia alta', muy_alta: 'Evidencia muy alta',
};
const ETIQUETA_ESTADO: Record<EstadoPatron, string> = { sugerido: 'Sugerido', confirmado: 'Confirmado', descartado: 'Descartado' };

function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PY', { dateStyle: 'medium', timeStyle: 'short' });
}

export function DiagnosticoFuncionalForm({ pacienteId }: { pacienteId: string }) {
  const router = useRouter();
  const [alteraciones, setAlteraciones] = useState<Alteracion[]>([]);
  const [perpetuadores, setPerpetuadores] = useState<Item[]>([]);
  const [deficits, setDeficits] = useState<Item[]>([]);
  const [impresion, setImpresion] = useState('');
  const [estudios, setEstudios] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [puntajes, setPuntajes] = useState<Record<string, Puntaje>>({});
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  const [patrones, setPatrones] = useState<PatronFuncional[]>([]);
  const [decisiones, setDecisiones] = useState<Record<string, DecisionLocal>>({});
  const [contextoPaciente, setContextoPaciente] = useState<ContextoPaciente | null>(null);
  const [actualizadoEn, setActualizadoEn] = useState<string | null>(null);
  const [advertencia, setAdvertencia] = useState('Resultado de cribado funcional. No sustituye diagnóstico médico.');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [esError, setEsError] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/pacientes/${pacienteId}/diagnostico`)
      .then(r => r.json())
      .then(body => {
        if (cancelado) return;
        setAlteraciones(body.alteraciones ?? []); setPerpetuadores(body.perpetuadores ?? []);
        setDeficits(body.deficits ?? []); setImpresion(body.impresion ?? ''); setEstudios(body.estudios ?? '');
        setConfirmado(body.confirmado ?? false); setPuntajes(body.evidencia?.puntajes ?? {});
        setHallazgos(body.evidencia?.hallazgos ?? []);
        const patronesRecibidos: PatronFuncional[] = body.patrones ?? [];
        setPatrones(patronesRecibidos);
        setDecisiones(Object.fromEntries(patronesRecibidos.map(p => [p.codigo, {
          estado: p.estado, prioridad: p.prioridad, observacionesMedico: p.observacionesMedico,
        }])));
        setContextoPaciente(body.contextoPaciente ?? null);
        setActualizadoEn(body.updatedAt ?? null);
        if (body.advertencia) setAdvertencia(body.advertencia);
      })
      .catch(() => { if (!cancelado) { setMensaje('No se pudo cargar el diagnóstico funcional.'); setEsError(true); } })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [pacienteId]);

  const agregarAlteracion = (nombre = '', dominio = DOMINIOS[0]) => setAlteraciones(prev => [...prev, {
    id: crypto.randomUUID(), nombre, nivel: 'secundaria', dominio, justificacion: '',
  }]);
  const cambiarAlteracion = (id: string, campo: keyof Alteracion, valor: string) =>
    setAlteraciones(prev => prev.map(a => a.id === id ? { ...a, [campo]: valor } : a));
  const agregarItem = (setter: React.Dispatch<React.SetStateAction<Item[]>>) =>
    setter(prev => [...prev, { id: crypto.randomUUID(), nombre: '' }]);

  function importarHallazgo(h: Hallazgo) {
    if (alteraciones.some(a => a.nombre.toLowerCase() === h.parametro.toLowerCase())) return;
    agregarAlteracion(h.parametro, 'Otro');
  }

  const DECISION_VACIA: DecisionLocal = { estado: 'sugerido', prioridad: 'baja', observacionesMedico: '' };

  function cambiarDecision(codigo: string, cambio: Partial<DecisionLocal>) {
    setDecisiones(prev => ({
      ...prev,
      [codigo]: { ...DECISION_VACIA, ...prev[codigo], ...cambio },
    }));
  }

  async function guardar(confirmar = confirmado) {
    setGuardando(true); setMensaje(''); setEsError(false);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/diagnostico`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alteraciones: alteraciones.filter(a => a.nombre.trim()), perpetuadores: perpetuadores.filter(x => x.nombre.trim()),
          deficits: deficits.filter(x => x.nombre.trim()), impresion, estudios, confirmado: confirmar,
          decisionesPatrones: Object.entries(decisiones).map(([codigo, d]) => ({ codigo, ...d })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setEsError(true); setMensaje(body.error || 'No se pudo guardar.'); return; }
      setConfirmado(confirmar);
      if (body.patrones) setPatrones(body.patrones);
      setMensaje(confirmar ? 'Diagnóstico confirmado y guardado.' : 'Borrador diagnóstico guardado.');
      if (confirmar) {
        const siguiente = siguientePaso('diagnostico');
        if (siguiente) router.push(`/pacientes/${pacienteId}/${siguiente}`);
      }
    } catch {
      setEsError(true);
      setMensaje('No se pudo guardar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <p className="text-sm text-choco-soft">Cargando diagnóstico funcional…</p>;
  const sistemas = Object.entries(puntajes).sort((a,b) => b[1].porcentaje - a[1].porcentaje);
  const relevantes = hallazgos.filter(h => h.severidad !== 'ok');
  const patronesOrdenados = [...patrones].sort((a, b) => b.puntaje - a.puntaje);

  return <div className="space-y-5">
    <section className="rounded-card border border-linea bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[9.5px] font-semibold uppercase tracking-wider text-oro">Patrones funcionales sugeridos</p>
        <p className="text-[11px] text-choco-soft">Última actualización: {formatearFecha(actualizadoEn)}</p>
      </div>
      {patronesOrdenados.length === 0 && (
        <p className="text-sm text-choco-soft">Todavía no hay suficiente evidencia (cuestionario, historia o bioescáner) para sugerir patrones.</p>
      )}
      <div className="space-y-3">
        {patronesOrdenados.map(p => {
          const decision = decisiones[p.codigo] ?? { estado: p.estado, prioridad: p.prioridad, observacionesMedico: p.observacionesMedico };
          return (
            <div key={p.codigo} className="rounded-lg border border-linea p-4">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-choco-deep">{p.nombre}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-marfil px-2 py-0.5 text-choco-mid">{p.puntaje}% · {ETIQUETA_NIVEL[p.nivel] ?? p.nivel}</span>
                  <span className="rounded-full border border-linea px-2 py-0.5 text-choco-soft">{ETIQUETA_ESTADO[decision.estado]}</span>
                </div>
              </div>
              <p className="mb-2 text-xs text-choco-soft">{p.descripcion}</p>
              <ul className="mb-3 space-y-1 text-[11.5px] text-choco-mid">
                {p.evidencias.map((e, i) => <li key={i}>· {e.descripcion}</li>)}
              </ul>
              <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr] sm:items-start">
                <select className={`${input} sm:w-auto`} value={decision.prioridad} onChange={e => cambiarDecision(p.codigo, { prioridad: e.target.value as Prioridad })}>
                  <option value="baja">Prioridad baja</option><option value="media">Prioridad media</option>
                  <option value="alta">Prioridad alta</option><option value="urgente">Prioridad urgente</option>
                </select>
                <div className="flex gap-1.5">
                  <button onClick={() => cambiarDecision(p.codigo, { estado: 'confirmado' })} className={`rounded-md border px-2.5 py-1.5 text-xs ${decision.estado === 'confirmado' ? 'border-fase-restore bg-fase-restore/10 text-fase-restore' : 'border-linea-fuerte text-choco-deep'}`}>Confirmar</button>
                  <button onClick={() => cambiarDecision(p.codigo, { estado: 'descartado' })} className={`rounded-md border px-2.5 py-1.5 text-xs ${decision.estado === 'descartado' ? 'border-fase-reset bg-fase-reset/10 text-fase-reset' : 'border-linea-fuerte text-choco-deep'}`}>Descartar</button>
                </div>
                <textarea rows={1} className={input} placeholder="Observaciones del médico…" value={decision.observacionesMedico} onChange={e => cambiarDecision(p.codigo, { observacionesMedico: e.target.value })} />
              </div>
            </div>
          );
        })}
      </div>
      {contextoPaciente && (contextoPaciente.medicamentosActuales || contextoPaciente.alergias || contextoPaciente.antecedentesPersonales || contextoPaciente.antecedentesFamiliares) && (
        <div className="mt-4 rounded-lg border border-linea bg-crema p-3 text-[11.5px] text-choco-mid">
          <p className="mb-1 font-semibold text-choco-soft">A considerar antes de confirmar</p>
          {contextoPaciente.medicamentosActuales && <p>Medicación actual: {contextoPaciente.medicamentosActuales}</p>}
          {contextoPaciente.alergias && <p>Alergias: {contextoPaciente.alergias}</p>}
          {contextoPaciente.antecedentesPersonales && <p>Antecedentes personales: {contextoPaciente.antecedentesPersonales}</p>}
          {contextoPaciente.antecedentesFamiliares && <p>Antecedentes familiares: {contextoPaciente.antecedentesFamiliares}</p>}
        </div>
      )}
      <p className="mt-3 text-[11px] text-choco-soft">{advertencia}</p>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-card border border-linea bg-white p-5">
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Evidencia · cuestionario</p>
        <div className="space-y-2">{sistemas.length === 0 && <p className="text-sm text-choco-soft">Sin resultados disponibles.</p>}
          {sistemas.slice(0, 9).map(([s,p]) => <div key={s} className="grid grid-cols-[1fr_2fr_40px] items-center gap-2 text-xs">
            <span>{s}</span><div className="h-2 rounded-full bg-marfil"><div className="h-2 rounded-full bg-oro" style={{ width: `${p.porcentaje}%` }} /></div><span>{p.porcentaje}%</span>
          </div>)}</div>
      </div>
      <div className="rounded-card border border-linea bg-white p-5">
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Evidencia · bioescáner</p>
        <div className="space-y-2">{relevantes.length === 0 && <p className="text-sm text-choco-soft">Sin hallazgos alterados.</p>}
          {relevantes.map(h => <div key={h.id} className="flex items-center justify-between gap-3 border-b border-linea pb-2 text-sm">
            <span>{h.parametro} {h.valor && <small className="text-choco-soft">({h.valor})</small>}</span>
            <button onClick={() => importarHallazgo(h)} className="rounded border border-linea-fuerte px-2 py-1 text-xs">Importar</button>
          </div>)}</div>
      </div>
    </section>

    <section className="rounded-card border border-linea bg-white p-5">
      <div className="mb-4 flex justify-between"><p className="text-[9.5px] font-semibold uppercase tracking-wider text-oro">Cascada de alteraciones</p>
        <button onClick={() => agregarAlteracion()} className="rounded-md border border-linea-fuerte px-3 py-1.5 text-xs">+ Agregar</button></div>
      <div className="space-y-3">{alteraciones.length === 0 && <p className="text-sm text-choco-soft">El médico todavía no definió alteraciones.</p>}
        {alteraciones.map(a => <div key={a.id} className="grid gap-2 rounded-lg border border-linea p-3 md:grid-cols-[2fr_1fr_1fr_auto]">
          <div><input className={input} placeholder="Alteración funcional" value={a.nombre} onChange={e => cambiarAlteracion(a.id, 'nombre', e.target.value)} />
            <input className={`${input} mt-2`} placeholder="Justificación clínica" value={a.justificacion} onChange={e => cambiarAlteracion(a.id, 'justificacion', e.target.value)} /></div>
          <select className={input} value={a.nivel} onChange={e => cambiarAlteracion(a.id, 'nivel', e.target.value)}><option value="primaria">Primaria</option><option value="secundaria">Secundaria</option><option value="terciaria">Terciaria</option></select>
          <select className={input} value={a.dominio} onChange={e => cambiarAlteracion(a.id, 'dominio', e.target.value)}>{DOMINIOS.map(d => <option key={d}>{d}</option>)}</select>
          <button onClick={() => setAlteraciones(prev => prev.filter(x => x.id !== a.id))} className="px-2 text-fase-reset">×</button>
        </div>)}</div>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      {([[perpetuadores,setPerpetuadores,'Factores perpetuadores'], [deficits,setDeficits,'Déficits probables']] as const).map(([items,setter,titulo]) => <div key={titulo} className="rounded-card border border-linea bg-white p-5">
        <div className="mb-3 flex justify-between"><p className="text-[9.5px] font-semibold uppercase tracking-wider text-oro">{titulo}</p><button onClick={() => agregarItem(setter)} className="text-xs">+ Agregar</button></div>
        <div className="space-y-2">{items.map(item => <div key={item.id} className="flex gap-2"><input className={input} value={item.nombre} onChange={e => setter(prev => prev.map(x => x.id === item.id ? { ...x, nombre: e.target.value } : x))} /><button onClick={() => setter(prev => prev.filter(x => x.id !== item.id))}>×</button></div>)}</div>
      </div>)}
    </section>

    <section className="rounded-card border border-linea bg-white p-5 space-y-4">
      <label className="block text-xs text-choco-soft">Impresión diagnóstica<textarea rows={5} className={`${input} mt-1.5`} value={impresion} onChange={e => setImpresion(e.target.value)} /></label>
      <label className="block text-xs text-choco-soft">Estudios complementarios sugeridos<textarea rows={3} className={`${input} mt-1.5`} value={estudios} onChange={e => setEstudios(e.target.value)} /></label>
    </section>

    <p className="text-[11.5px] text-choco-soft">La evidencia se presenta como apoyo. El sistema no establece diagnósticos ni reemplaza el criterio médico.</p>
    {mensaje && <p className={`text-sm ${esError ? 'text-fase-reset' : 'text-choco-mid'}`}>{mensaje}</p>}
    <div className="flex gap-2"><button onClick={() => guardar(false)} disabled={guardando} className="rounded-md border border-linea-fuerte px-5 py-2.5 text-sm">Guardar borrador</button>
      <button onClick={() => guardar(true)} disabled={guardando || alteraciones.length === 0} className="rounded-md bg-choco-deep px-5 py-2.5 text-sm text-crema disabled:opacity-40">Confirmar diagnóstico</button></div>
  </div>;
}
