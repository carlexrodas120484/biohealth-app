'use client';

import { useEffect, useState } from 'react';

type Nivel = 'primaria' | 'secundaria' | 'terciaria';
type Alteracion = { id: string; nombre: string; nivel: Nivel; dominio: string; justificacion: string };
type Item = { id: string; nombre: string };
type Puntaje = { puntos: number; maximo: number; porcentaje: number };
type Hallazgo = { id: string; parametro: string; valor: string; referencia: string; severidad: 'ok' | 'med' | 'alto' };

const DOMINIOS = ['Digestivo', 'Metabólico', 'Inflamatorio', 'Mitocondrial', 'Neuroendocrino', 'Hormonal', 'Inmunológico', 'Detoxificación', 'Cardiovascular', 'Nutricional', 'Otro'];
const input = 'w-full rounded-md border border-linea px-3 py-2 text-sm focus:border-oro-claro focus:outline-none focus:ring-2 focus:ring-oro/10';

export function DiagnosticoFuncionalForm({ pacienteId }: { pacienteId: string }) {
  const [alteraciones, setAlteraciones] = useState<Alteracion[]>([]);
  const [perpetuadores, setPerpetuadores] = useState<Item[]>([]);
  const [deficits, setDeficits] = useState<Item[]>([]);
  const [impresion, setImpresion] = useState('');
  const [estudios, setEstudios] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [puntajes, setPuntajes] = useState<Record<string, Puntaje>>({});
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    fetch(`/api/pacientes/${pacienteId}/diagnostico`).then(r => r.json()).then(body => {
      setAlteraciones(body.alteraciones ?? []); setPerpetuadores(body.perpetuadores ?? []);
      setDeficits(body.deficits ?? []); setImpresion(body.impresion ?? ''); setEstudios(body.estudios ?? '');
      setConfirmado(body.confirmado ?? false); setPuntajes(body.evidencia?.puntajes ?? {});
      setHallazgos(body.evidencia?.hallazgos ?? []);
    }).finally(() => setCargando(false));
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

  async function guardar(confirmar = confirmado) {
    setGuardando(true); setMensaje('');
    const res = await fetch(`/api/pacientes/${pacienteId}/diagnostico`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alteraciones: alteraciones.filter(a => a.nombre.trim()), perpetuadores: perpetuadores.filter(x => x.nombre.trim()),
        deficits: deficits.filter(x => x.nombre.trim()), impresion, estudios, confirmado: confirmar,
      }),
    });
    const body = await res.json();
    if (res.ok) { setConfirmado(confirmar); setMensaje(confirmar ? 'Diagnóstico confirmado y guardado.' : 'Borrador diagnóstico guardado.'); }
    else setMensaje(body.error ?? 'No se pudo guardar.');
    setGuardando(false);
  }

  if (cargando) return <p className="text-sm text-choco-soft">Cargando diagnóstico funcional…</p>;
  const sistemas = Object.entries(puntajes).sort((a,b) => b[1].porcentaje - a[1].porcentaje);
  const relevantes = hallazgos.filter(h => h.severidad !== 'ok');

  return <div className="space-y-5">
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
    {mensaje && <p className="text-sm text-choco-mid">{mensaje}</p>}
    <div className="flex gap-2"><button onClick={() => guardar(false)} disabled={guardando} className="rounded-md border border-linea-fuerte px-5 py-2.5 text-sm">Guardar borrador</button>
      <button onClick={() => guardar(true)} disabled={guardando || alteraciones.length === 0} className="rounded-md bg-choco-deep px-5 py-2.5 text-sm text-crema disabled:opacity-40">Confirmar diagnóstico</button></div>
  </div>;
}
