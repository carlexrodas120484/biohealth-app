'use client';

import { useEffect, useState } from 'react';

type Sugerencia = { id: string; nombre: string; objetivo: string; precaucion: string; evidencia: 'B' | 'C' | 'D'; fuente: string };
type Item = { id: string; nombre: string; dosis: string; presentacion: string; cantidad: string; indicacion: string; observaciones: string; evidencia?: string; fuente?: string };
type RevisionClinica = { pesoKg: string; embarazoLactancia: string; funcionRenal: string; funcionHepatica: string; laboratorios: string; diagnosticoConfirmado: boolean };
type Respuesta = {
  fase: string; objetivos: string[]; sugerencias: Sugerencia[];
  medicamentosActuales: string; alergias: string; items: Item[];
  seguridadRevisada: boolean; firmada: boolean; firmadaEn: string | null;
  revisionClinica?: RevisionClinica;
};

const REVISION_VACIA: RevisionClinica = { pesoKg: '', embarazoLactancia: 'no-aplica', funcionRenal: '', funcionHepatica: '', laboratorios: '', diagnosticoConfirmado: false };

const campo = 'w-full rounded-md border border-linea bg-white px-3 py-2 text-sm focus:border-oro-claro focus:outline-none focus:ring-2 focus:ring-oro/10';

export function FormulacionTerapeuticaForm({ pacienteId }: { pacienteId: string }) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [seguridad, setSeguridad] = useState(false);
  const [revision, setRevision] = useState<RevisionClinica>(REVISION_VACIA);
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    fetch(`/api/pacientes/${pacienteId}/formulacion`).then(async r => {
      const b = await r.json(); if (!r.ok) throw new Error(b.error ?? 'No se pudo cargar la formulación.');
      setDatos(b); setItems(b.items ?? []); setSeguridad(Boolean(b.seguridadRevisada)); setRevision({ ...REVISION_VACIA, ...(b.revisionClinica ?? {}) });
    }).catch(e => setMensaje(e instanceof Error ? e.message : 'No se pudo cargar la formulación.'))
      .finally(() => setCargando(false));
  }, [pacienteId]);

  function agregar(s: Sugerencia) {
    if (items.some(i => i.id === s.id)) return;
    setItems(prev => [...prev, { id: s.id, nombre: s.nombre, dosis: '', presentacion: '', cantidad: '', indicacion: '', observaciones: s.precaucion, evidencia: s.evidencia, fuente: s.fuente }]);
    setSeguridad(false);
  }

  function actualizar(id: string, clave: keyof Pick<Item, 'dosis' | 'presentacion' | 'cantidad' | 'indicacion' | 'observaciones'>, valor: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [clave]: valor } : i));
    setSeguridad(false);
  }

  async function guardar(firmar: boolean) {
    setGuardando(true); setMensaje('');
    const res = await fetch(`/api/pacientes/${pacienteId}/formulacion`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, revisionClinica: revision, seguridadRevisada: seguridad, firmar, password }),
    });
    const b = await res.json();
    if (res.ok) {
      setDatos(prev => prev ? { ...prev, firmada: firmar, firmadaEn: b.firmadaEn ?? null } : prev);
      setPassword(''); setMensaje(firmar ? 'Fórmula firmada y guardada.' : 'Borrador de fórmula guardado.');
    } else setMensaje(b.error ?? 'No se pudo guardar la formulación.');
    setGuardando(false);
  }

  async function descargarDocumento(tipo: 'receta_botica' | 'informe_medico' | 'informe_paciente') {
    setGenerando(tipo); setMensaje('');
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/documentos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo }) });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error ?? 'No se pudo generar el documento.'); }
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a'); enlace.href = url; enlace.download = `${tipo}.pdf`; enlace.click();
      URL.revokeObjectURL(url);
    } catch (e) { setMensaje(e instanceof Error ? e.message : 'No se pudo generar el documento.'); }
    finally { setGenerando(null); }
  }

  if (cargando) return <p className="text-sm text-choco-soft">Cargando formulación…</p>;
  if (!datos) return <div className="rounded-card border border-linea bg-white p-5 text-sm text-choco-soft">{mensaje}</div>;
  const bloqueada = datos.firmada;

  return <div className="space-y-5">
    <section className="rounded-card border border-linea bg-white p-5">
      <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Revisión obligatoria</p>
      <p className="text-sm text-choco-mid"><b>Medicación actual:</b> {datos.medicamentosActuales}</p>
      <p className="mt-1 text-sm text-choco-mid"><b>Alergias:</b> {datos.alergias}</p>
    </section>

    <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
      <section className="rounded-card border border-linea bg-white p-5">
        <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Sugerencias por objetivo</p>
        <p className="mb-4 text-xs text-choco-soft">Son opciones para revisión médica; no constituyen prescripción automática.</p>
        <div className="space-y-3">{datos.sugerencias.map(s => <article key={s.id} className="rounded-lg border border-linea p-3">
          <p className="text-sm font-medium text-choco-deep">{s.nombre}</p>
          <p className="text-xs text-choco-soft">Objetivo: {s.objetivo}</p><p className="mt-1 text-[11px] text-choco-mid">Evidencia {s.evidencia} · {s.fuente}</p>
          <p className="mt-2 text-xs text-fase-reset">Precaución: {s.precaucion}</p>
          {!bloqueada && <button type="button" onClick={() => agregar(s)} disabled={items.some(i => i.id === s.id)}
            className="mt-3 rounded-md bg-choco-deep px-3 py-1.5 text-xs text-crema disabled:opacity-40">Agregar</button>}
        </article>)}</div>
      </section>

      <section className="rounded-card border border-linea bg-white p-5">
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Fórmula en construcción</p>
        {items.length === 0 && <p className="text-sm text-choco-soft">Agregue al menos un activo.</p>}
        <div className="space-y-4">{items.map(item => <article key={item.id} className="rounded-lg border border-linea p-3">
          <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{item.nombre}</p>
            {!bloqueada && <button type="button" onClick={() => { setItems(prev => prev.filter(i => i.id !== item.id)); setSeguridad(false); }} className="text-xs text-fase-reset">Quitar</button>}
          </div>
          <div className="mt-3 grid gap-2">
            {(item.evidencia || item.fuente) && <p className="text-[11px] text-choco-soft">Evidencia {item.evidencia ?? 'sin clasificar'} · {item.fuente ?? 'fuente no registrada'}</p>}
            <input disabled={bloqueada} className={campo} placeholder="Dosis definida por el médico" value={item.dosis} onChange={e => actualizar(item.id, 'dosis', e.target.value)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <input disabled={bloqueada} className={campo} placeholder="Presentación o vehículo" value={item.presentacion ?? ''} onChange={e => actualizar(item.id, 'presentacion', e.target.value)} />
              <input disabled={bloqueada} className={campo} placeholder="Cantidad total a preparar" value={item.cantidad ?? ''} onChange={e => actualizar(item.id, 'cantidad', e.target.value)} />
            </div>
            <input disabled={bloqueada} className={campo} placeholder="Indicación y horario" value={item.indicacion} onChange={e => actualizar(item.id, 'indicacion', e.target.value)} />
            <textarea disabled={bloqueada} rows={2} className={campo} placeholder="Observaciones y precauciones" value={item.observaciones} onChange={e => actualizar(item.id, 'observaciones', e.target.value)} />
          </div>
        </article>)}</div>
      </section>
    </div>

    {!bloqueada && <section className="rounded-card border border-linea bg-white p-5">
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Contexto mínimo para dosificación</p>
      <p className="mb-4 text-xs text-choco-soft">La app no calcula una dosis. Registre el contexto que el profesional usó para definirla.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs text-choco-soft">Peso actual (kg)<input type="number" min="1" step="0.1" className={`${campo} mt-1`} value={revision.pesoKg} onChange={e => { setRevision(v => ({ ...v, pesoKg: e.target.value })); setSeguridad(false); }} /></label>
        <label className="text-xs text-choco-soft">Embarazo/lactancia<select className={`${campo} mt-1`} value={revision.embarazoLactancia} onChange={e => { setRevision(v => ({ ...v, embarazoLactancia: e.target.value })); setSeguridad(false); }}><option value="no-aplica">No aplica</option><option value="no">No</option><option value="embarazo">Embarazo</option><option value="lactancia">Lactancia</option><option value="desconocido">No verificado</option></select></label>
        <label className="text-xs text-choco-soft">Función renal<input className={`${campo} mt-1`} placeholder="eGFR/creatinina y fecha" value={revision.funcionRenal} onChange={e => { setRevision(v => ({ ...v, funcionRenal: e.target.value })); setSeguridad(false); }} /></label>
        <label className="text-xs text-choco-soft">Función hepática<input className={`${campo} mt-1`} placeholder="Resultados y fecha" value={revision.funcionHepatica} onChange={e => { setRevision(v => ({ ...v, funcionHepatica: e.target.value })); setSeguridad(false); }} /></label>
        <label className="text-xs text-choco-soft sm:col-span-2">Laboratorios relevantes<input className={`${campo} mt-1`} placeholder="Analito, valor, unidad y fecha" value={revision.laboratorios} onChange={e => { setRevision(v => ({ ...v, laboratorios: e.target.value })); setSeguridad(false); }} /></label>
      </div>
      <label className="mt-4 flex items-start gap-2 text-sm text-choco-mid"><input type="checkbox" className="mt-1" checked={revision.diagnosticoConfirmado} onChange={e => { setRevision(v => ({ ...v, diagnosticoConfirmado: e.target.checked })); setSeguridad(false); }} />Confirmé la indicación clínica y documenté los datos que justifican cada dosis.</label>
      <div className="my-5 border-t border-linea" />
      <label className="flex items-start gap-2 text-sm text-choco-mid">
        <input type="checkbox" className="mt-1" checked={seguridad} onChange={e => setSeguridad(e.target.checked)} />
        Revisé medicación, alergias, contraindicaciones, interacciones y adecuación de las dosis.
      </label>
      <label className="mt-4 block max-w-sm text-xs text-choco-soft">Contraseña para firmar
        <input type="password" autoComplete="current-password" className={`${campo} mt-1`} value={password} onChange={e => setPassword(e.target.value)} />
      </label>
    </section>}

    {mensaje && <p className="text-sm text-choco-mid">{mensaje}</p>}
    {bloqueada ? <div className="space-y-3 rounded-md bg-fase-restore/10 p-4"><p className="text-sm text-fase-restore">Fórmula firmada {datos.firmadaEn ? `el ${new Date(datos.firmadaEn).toLocaleString('es-PY')}` : ''}. Ya no puede modificarse.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={Boolean(generando)} onClick={() => descargarDocumento('receta_botica')} className="rounded-md bg-choco-deep px-4 py-2 text-xs text-crema disabled:opacity-40">{generando === 'receta_botica' ? 'Generando…' : 'Receta para botica'}</button>
          <button type="button" disabled={Boolean(generando)} onClick={() => descargarDocumento('informe_medico')} className="rounded-md border border-linea-fuerte bg-white px-4 py-2 text-xs disabled:opacity-40">{generando === 'informe_medico' ? 'Generando…' : 'Informe médico'}</button>
          <button type="button" disabled={Boolean(generando)} onClick={() => descargarDocumento('informe_paciente')} className="rounded-md border border-linea-fuerte bg-white px-4 py-2 text-xs disabled:opacity-40">{generando === 'informe_paciente' ? 'Generando…' : 'Informe para paciente'}</button>
        </div></div>
      : <div className="flex flex-wrap gap-2">
        <button type="button" disabled={guardando || items.length === 0} onClick={() => guardar(false)} className="rounded-md border border-linea-fuerte px-5 py-2.5 text-sm disabled:opacity-40">Guardar borrador</button>
        <button type="button" disabled={guardando || items.length === 0 || !seguridad || !revision.diagnosticoConfirmado || !password} onClick={() => guardar(true)} className="rounded-md bg-choco-deep px-5 py-2.5 text-sm text-crema disabled:opacity-40">Firmar fórmula</button>
      </div>}
  </div>;
}
