'use client';

import { useEffect, useState } from 'react';

type Sugerencia = { id: string; nombre: string; objetivo: string; precaucion: string; evidencia: 'B' | 'C' | 'D'; fuente: string };
type Item = { id: string; nombre: string; dosis: string; presentacion: string; cantidad: string; indicacion: string; observaciones: string; evidencia?: string; fuente?: string };
type RevisionClinica = { pesoKg: string; embarazoLactancia: string; funcionRenal: string; funcionHepatica: string; laboratorios: string; diagnosticoConfirmado: boolean };

type Horario = 'ayunas' | 'desayuno' | 'almuerzo' | 'cena' | 'antes_de_dormir';
type Presentacion = 'capsula' | 'sobre' | 'liquido' | 'comercial';
type EstadoFormulacion = 'borrador' | 'sugerida' | 'revisada' | 'aprobada' | 'archivada';
type Ingrediente = {
  id: string; nombre: string; dosisPorTomaMg: number; vecesPorDia: number; horario: Horario;
  presentacionElegida?: Presentacion; bloquearPresentacion?: boolean;
};
type IngredienteCalculado = Ingrediente & {
  capsulasPorToma: number; presentacionSugerida: Presentacion; cambioAutomaticoBloqueado: boolean;
  motivosBloqueoPresentacion: string[]; dosisDiariaTotalMg: number; cantidadTotalMg: number; sabor: string;
};
type Preparacion = { horario: Horario; ingredientes: IngredienteCalculado[]; cargaTotalMg: number; requiereEnmascararSabor: boolean };
type Alerta = { codigo: string; descripcion: string; fuente: string };

type Respuesta = {
  fase: string; objetivos: string[]; sugerencias: Sugerencia[];
  medicamentosActuales: string; alergias: string; items: Item[];
  seguridadRevisada: boolean; firmada: boolean; firmadaEn: string | null;
  revisionClinica?: RevisionClinica;
  estado: EstadoFormulacion; ingredientes: Ingrediente[]; preparaciones: Preparacion[]; alertas: Alerta[];
  contextoPlan?: { fasesActivas: string[] }; advertencia: string;
};

const REVISION_VACIA: RevisionClinica = { pesoKg: '', embarazoLactancia: 'no-aplica', funcionRenal: '', funcionHepatica: '', laboratorios: '', diagnosticoConfirmado: false };
const HORARIOS: Horario[] = ['ayunas', 'desayuno', 'almuerzo', 'cena', 'antes_de_dormir'];
const ETIQUETA_HORARIO: Record<Horario, string> = { ayunas: 'Ayunas', desayuno: 'Desayuno', almuerzo: 'Almuerzo', cena: 'Cena', antes_de_dormir: 'Antes de dormir' };
const ETIQUETA_ESTADO: Record<EstadoFormulacion, string> = { borrador: 'Borrador', sugerida: 'Sugerida', revisada: 'Revisada', aprobada: 'Aprobada', archivada: 'Archivada' };

const campo = 'w-full rounded-md border border-linea bg-white px-3 py-2 text-sm focus:border-oro-claro focus:outline-none focus:ring-2 focus:ring-oro/10';

function ingredienteVacio(): Ingrediente {
  return { id: crypto.randomUUID(), nombre: '', dosisPorTomaMg: 0, vecesPorDia: 1, horario: 'desayuno' };
}

export function FormulacionTerapeuticaForm({ pacienteId }: { pacienteId: string }) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [seguridad, setSeguridad] = useState(false);
  const [revision, setRevision] = useState<RevisionClinica>(REVISION_VACIA);
  const [password, setPassword] = useState('');
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [preparaciones, setPreparaciones] = useState<Preparacion[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [estado, setEstado] = useState<EstadoFormulacion>('borrador');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [esError, setEsError] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/pacientes/${pacienteId}/formulacion`).then(async r => {
      const b = await r.json(); if (!r.ok) throw new Error(b.error ?? 'No se pudo cargar la formulación.');
      if (cancelado) return;
      setDatos(b); setItems(b.items ?? []); setSeguridad(Boolean(b.seguridadRevisada)); setRevision({ ...REVISION_VACIA, ...(b.revisionClinica ?? {}) });
      setIngredientes(b.ingredientes ?? []); setPreparaciones(b.preparaciones ?? []); setAlertas(b.alertas ?? []); setEstado(b.estado ?? 'borrador');
    }).catch(e => { if (!cancelado) { setEsError(true); setMensaje(e instanceof Error ? e.message : 'No se pudo cargar la formulación.'); } })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
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

  function agregarIngrediente() { setIngredientes(prev => [...prev, ingredienteVacio()]); }
  function cambiarIngrediente(id: string, cambio: Partial<Ingrediente>) {
    setIngredientes(prev => prev.map(i => i.id === id ? { ...i, ...cambio } : i));
  }
  function quitarIngrediente(id: string) { setIngredientes(prev => prev.filter(i => i.id !== id)); }

  async function guardar(firmar: boolean, nuevoEstado?: EstadoFormulacion) {
    setGuardando(true); setMensaje(''); setEsError(false);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/formulacion`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items, revisionClinica: revision, seguridadRevisada: seguridad, firmar, password,
          ingredientes, estado: nuevoEstado ?? (firmar ? 'aprobada' : estado),
        }),
      });
      const b = await res.json();
      if (!res.ok) { setEsError(true); setMensaje(b.error ?? 'No se pudo guardar la formulación.'); return; }
      setDatos(prev => prev ? { ...prev, firmada: firmar, firmadaEn: b.firmadaEn ?? null } : prev);
      setPreparaciones(b.preparaciones ?? []); setAlertas(b.alertas ?? []); setEstado(b.estado ?? estado);
      setPassword('');
      setMensaje(firmar ? 'Fórmula firmada y guardada.' : 'Formulación guardada.');
    } catch {
      setEsError(true);
      setMensaje('No se pudo guardar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  async function descargarDocumento(tipo: 'receta_botica' | 'informe_medico' | 'informe_paciente') {
    setGenerando(tipo); setMensaje('');
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/documentos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo }) });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error ?? 'No se pudo generar el documento.'); }
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a'); enlace.href = url; enlace.download = `${tipo}.pdf`; enlace.click();
      URL.revokeObjectURL(url);
    } catch (e) { setEsError(true); setMensaje(e instanceof Error ? e.message : 'No se pudo generar el documento.'); }
    finally { setGenerando(null); }
  }

  if (cargando) return <p className="text-sm text-choco-soft">Cargando formulación…</p>;
  if (!datos) return <div className="rounded-card border border-linea bg-white p-5 text-sm text-choco-soft">{mensaje}</div>;
  const bloqueada = datos.firmada;

  return <div className="space-y-5">
    <section className="rounded-card border border-linea bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[9.5px] font-semibold uppercase tracking-wider text-oro">Revisión obligatoria</p>
        <span className="rounded-full border border-linea px-2 py-0.5 text-[11px] text-choco-soft">{ETIQUETA_ESTADO[estado]}</span>
      </div>
      <p className="text-sm text-choco-mid"><b>Medicación actual:</b> {datos.medicamentosActuales}</p>
      <p className="mt-1 text-sm text-choco-mid"><b>Alergias:</b> {datos.alergias}</p>
      {datos.contextoPlan && datos.contextoPlan.fasesActivas.length > 0 && (
        <p className="mt-1 text-sm text-choco-mid"><b>Fases activas del plan terapéutico:</b> {datos.contextoPlan.fasesActivas.join(', ')}</p>
      )}
    </section>

    {alertas.length > 0 && (
      <section className="rounded-card border border-fase-reset/20 bg-white p-5">
        <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-wider text-fase-reset">Alertas para revisión médica</p>
        <ul className="space-y-1 text-[12.5px] text-choco-mid">
          {alertas.map(a => <li key={a.codigo}>· {a.descripcion}</li>)}
        </ul>
      </section>
    )}

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
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[9.5px] font-semibold uppercase tracking-wider text-oro">Motor de reglas: cápsulas, sobres y horarios</p>
        <button type="button" onClick={agregarIngrediente} className="rounded-md border border-linea-fuerte px-3 py-1.5 text-xs">+ Agregar principio</button>
      </div>
      <p className="mb-4 text-xs text-choco-soft">Organiza y calcula presentación a partir de la dosis que definís; no sugiere dosis.</p>
      <div className="space-y-3">
        {ingredientes.map(ing => <div key={ing.id} className="grid gap-2 rounded-lg border border-linea p-3 sm:grid-cols-6">
          <input className={`${campo} sm:col-span-2`} placeholder="Nombre del principio" value={ing.nombre} onChange={e => cambiarIngrediente(ing.id, { nombre: e.target.value })} />
          <input type="number" min={0} className={campo} placeholder="Dosis/toma (mg)" value={ing.dosisPorTomaMg || ''} onChange={e => cambiarIngrediente(ing.id, { dosisPorTomaMg: Number(e.target.value) })} />
          <input type="number" min={1} className={campo} placeholder="Veces/día" value={ing.vecesPorDia} onChange={e => cambiarIngrediente(ing.id, { vecesPorDia: Number(e.target.value) })} />
          <select className={campo} value={ing.horario} onChange={e => cambiarIngrediente(ing.id, { horario: e.target.value as Horario })}>
            {HORARIOS.map(h => <option key={h} value={h}>{ETIQUETA_HORARIO[h]}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[11px] text-choco-soft">
              <input type="checkbox" checked={Boolean(ing.bloquearPresentacion)} onChange={e => cambiarIngrediente(ing.id, { bloquearPresentacion: e.target.checked })} />
              Bloquear presentación
            </label>
            <button type="button" onClick={() => quitarIngrediente(ing.id)} className="text-xs text-fase-reset">×</button>
          </div>
        </div>)}
        {ingredientes.length === 0 && <p className="text-sm text-choco-soft">Sin principios cargados en el motor todavía.</p>}
      </div>
      {ingredientes.length > 0 && (
        <button type="button" disabled={guardando} onClick={() => guardar(false)} className="mt-3 rounded-md border border-linea-fuerte px-3 py-1.5 text-xs">
          Calcular y guardar
        </button>
      )}

      {preparaciones.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-[9.5px] font-semibold uppercase tracking-wider text-oro">Preparaciones calculadas</p>
          {preparaciones.map((prep, i) => (
            <div key={i} className="rounded-lg border border-linea p-3">
              <p className="mb-2 text-sm font-medium text-choco-deep">{ETIQUETA_HORARIO[prep.horario]} · carga total {prep.cargaTotalMg}mg{prep.requiereEnmascararSabor ? ' · sabor amargo: considerar saborizante' : ''}</p>
              <ul className="space-y-1 text-[12.5px] text-choco-mid">
                {prep.ingredientes.map(ic => (
                  <li key={ic.id}>
                    {ic.nombre}: {ic.capsulasPorToma} cápsula(s)/toma · sugerido {ic.presentacionSugerida} · {ic.dosisDiariaTotalMg}mg/día · {ic.cantidadTotalMg}mg para 30 días
                    {ic.motivosBloqueoPresentacion.length > 0 && <span className="block text-[11px] text-fase-reset">{ic.motivosBloqueoPresentacion.join(' ')}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>}

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

    {mensaje && <p className={`text-sm ${esError ? 'text-fase-reset' : 'text-choco-mid'}`}>{mensaje}</p>}
    {bloqueada ? <div className="space-y-3 rounded-md bg-fase-restore/10 p-4"><p className="text-sm text-fase-restore">Fórmula firmada {datos.firmadaEn ? `el ${new Date(datos.firmadaEn).toLocaleString('es-PY')}` : ''}. Ya no puede modificarse.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={Boolean(generando)} onClick={() => descargarDocumento('receta_botica')} className="rounded-md bg-choco-deep px-4 py-2 text-xs text-crema disabled:opacity-40">{generando === 'receta_botica' ? 'Generando…' : 'Receta para botica'}</button>
          <button type="button" disabled={Boolean(generando)} onClick={() => descargarDocumento('informe_medico')} className="rounded-md border border-linea-fuerte bg-white px-4 py-2 text-xs disabled:opacity-40">{generando === 'informe_medico' ? 'Generando…' : 'Informe médico'}</button>
          <button type="button" disabled={Boolean(generando)} onClick={() => descargarDocumento('informe_paciente')} className="rounded-md border border-linea-fuerte bg-white px-4 py-2 text-xs disabled:opacity-40">{generando === 'informe_paciente' ? 'Generando…' : 'Informe para paciente'}</button>
          <button type="button" disabled={guardando} onClick={() => guardar(false, 'borrador')} className="rounded-md border border-fase-reset/40 px-4 py-2 text-xs text-fase-reset disabled:opacity-40">Devolver a borrador</button>
        </div></div>
      : <div className="flex flex-wrap gap-2">
        <button type="button" disabled={guardando || items.length === 0} onClick={() => guardar(false, 'borrador')} className="rounded-md border border-linea-fuerte px-5 py-2.5 text-sm disabled:opacity-40">Guardar borrador</button>
        <button type="button" disabled={guardando || items.length === 0} onClick={() => guardar(false, 'revisada')} className="rounded-md border border-linea-fuerte px-5 py-2.5 text-sm disabled:opacity-40">Marcar como revisada</button>
        <button type="button" disabled={guardando || items.length === 0 || !seguridad || !revision.diagnosticoConfirmado || !password} onClick={() => guardar(true, 'aprobada')} className="rounded-md bg-choco-deep px-5 py-2.5 text-sm text-crema disabled:opacity-40">Firmar fórmula</button>
      </div>}
    <p className="text-[11.5px] text-choco-soft">{datos.advertencia}</p>
  </div>;
}
