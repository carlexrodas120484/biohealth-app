'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const campo = 'w-full rounded-md border border-linea bg-white px-3 py-2 text-sm focus:border-oro-claro focus:outline-none focus:ring-2 focus:ring-oro/10';
const etiqueta = 'mb-1 block text-[11.5px] font-medium text-choco-mid';
const UNIDADES = ['mg', 'g', 'mcg', 'ui', 'ml'] as const;
const NIVELES_EVIDENCIA = ['A', 'B', 'C', 'D'] as const;

type DatosIniciales = {
  nombreCanonico?: string; nombreComercial?: string; descripcion?: string; mecanismoAccion?: string;
  funcionesClinicas?: string[]; sistemasRelacionados?: string[];
  limiteEdadMinAnios?: number | null; limiteEdadMaxAnios?: number | null;
  limitePesoMinKg?: number | null; limitePesoMaxKg?: number | null;
  limiteRenal?: string; limiteHepatico?: string;
  contraindicadoEmbarazo?: boolean | null; contraindicadoLactancia?: boolean | null; contraindicadoOncologico?: boolean | null;
  precaucionAnticoagulacion?: boolean; precaucionAntihipertensivos?: boolean; precaucionHipoglucemiantes?: boolean;
};

function listaDesdeTexto(texto: string): string[] {
  return texto.split(',').map(s => s.trim()).filter(Boolean);
}

export function PrincipioActivoForm({ modo, principioId, datosIniciales }: {
  modo: 'crear' | 'editar';
  principioId?: string;
  datosIniciales?: DatosIniciales;
}) {
  const router = useRouter();
  const d = datosIniciales ?? {};

  const [nombreCanonico, setNombreCanonico] = useState(d.nombreCanonico ?? '');
  const [nombreComercial, setNombreComercial] = useState(d.nombreComercial ?? '');
  const [descripcion, setDescripcion] = useState(d.descripcion ?? '');
  const [mecanismoAccion, setMecanismoAccion] = useState(d.mecanismoAccion ?? '');
  const [funcionesClinicas, setFuncionesClinicas] = useState((d.funcionesClinicas ?? []).join(', '));
  const [sistemasRelacionados, setSistemasRelacionados] = useState((d.sistemasRelacionados ?? []).join(', '));
  const [limiteEdadMinAnios, setLimiteEdadMinAnios] = useState(d.limiteEdadMinAnios?.toString() ?? '');
  const [limiteEdadMaxAnios, setLimiteEdadMaxAnios] = useState(d.limiteEdadMaxAnios?.toString() ?? '');
  const [limitePesoMinKg, setLimitePesoMinKg] = useState(d.limitePesoMinKg?.toString() ?? '');
  const [limitePesoMaxKg, setLimitePesoMaxKg] = useState(d.limitePesoMaxKg?.toString() ?? '');
  const [limiteRenal, setLimiteRenal] = useState(d.limiteRenal ?? '');
  const [limiteHepatico, setLimiteHepatico] = useState(d.limiteHepatico ?? '');
  const [contraindicadoEmbarazo, setContraindicadoEmbarazo] = useState(Boolean(d.contraindicadoEmbarazo));
  const [contraindicadoLactancia, setContraindicadoLactancia] = useState(Boolean(d.contraindicadoLactancia));
  const [contraindicadoOncologico, setContraindicadoOncologico] = useState(Boolean(d.contraindicadoOncologico));
  const [precaucionAnticoagulacion, setPrecaucionAnticoagulacion] = useState(Boolean(d.precaucionAnticoagulacion));
  const [precaucionAntihipertensivos, setPrecaucionAntihipertensivos] = useState(Boolean(d.precaucionAntihipertensivos));
  const [precaucionHipoglucemiantes, setPrecaucionHipoglucemiantes] = useState(Boolean(d.precaucionHipoglucemiantes));

  // Sólo aplica al crear: la edición de sub-tablas (dosis, sinónimos,
  // contraindicaciones, evidencia) todavía se hace por importación CSV o
  // en una futura iteración del panel — el PATCH actual sólo actualiza
  // los campos escalares del principio.
  const [sinonimos, setSinonimos] = useState('');
  const [dosisMinima, setDosisMinima] = useState('');
  const [dosisUsual, setDosisUsual] = useState('');
  const [dosisMaxima, setDosisMaxima] = useState('');
  const [dosisUnidad, setDosisUnidad] = useState<typeof UNIDADES[number]>('mg');
  const [dosisFrecuencia, setDosisFrecuencia] = useState('');
  const [contraindicaciones, setContraindicaciones] = useState('');
  const [evidenciaNivel, setEvidenciaNivel] = useState('');
  const [evidenciaResumen, setEvidenciaResumen] = useState('');

  const [forzarSobrescritura, setForzarSobrescritura] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [esError, setEsError] = useState(false);

  function numeroOUndefined(valor: string): number | undefined {
    if (!valor.trim()) return undefined;
    const n = Number(valor);
    return Number.isNaN(n) ? undefined : n;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setMensaje(''); setEsError(false);

    try {
      if (modo === 'crear') {
        const dosis = [] as Array<{ tipo: string; valor: number; unidad: string; frecuencia?: string; sinEvidencia: boolean }>;
        if (dosisMinima) dosis.push({ tipo: 'minima', valor: Number(dosisMinima), unidad: dosisUnidad, sinEvidencia: true });
        if (dosisUsual) dosis.push({ tipo: 'usual', valor: Number(dosisUsual), unidad: dosisUnidad, frecuencia: dosisFrecuencia || undefined, sinEvidencia: true });
        if (dosisMaxima) dosis.push({ tipo: 'maxima', valor: Number(dosisMaxima), unidad: dosisUnidad, sinEvidencia: true });

        const body = {
          nombreCanonico, nombreComercial: nombreComercial || undefined, descripcion: descripcion || undefined,
          mecanismoAccion: mecanismoAccion || undefined,
          funcionesClinicas: listaDesdeTexto(funcionesClinicas), sistemasRelacionados: listaDesdeTexto(sistemasRelacionados),
          limiteEdadMinAnios: numeroOUndefined(limiteEdadMinAnios), limiteEdadMaxAnios: numeroOUndefined(limiteEdadMaxAnios),
          limitePesoMinKg: numeroOUndefined(limitePesoMinKg), limitePesoMaxKg: numeroOUndefined(limitePesoMaxKg),
          limiteRenal: limiteRenal || undefined, limiteHepatico: limiteHepatico || undefined,
          contraindicadoEmbarazo, contraindicadoLactancia, contraindicadoOncologico,
          precaucionAnticoagulacion, precaucionAntihipertensivos, precaucionHipoglucemiantes,
          sinonimos: listaDesdeTexto(sinonimos),
          dosis,
          contraindicaciones: listaDesdeTexto(contraindicaciones).map(c => ({ contraindicacion: c, severidad: 'moderada' as const })),
          evidencia: evidenciaNivel ? [{ nivelEvidencia: evidenciaNivel, resumen: evidenciaResumen || undefined }] : [],
        };
        const res = await fetch('/api/admin/base-conocimiento/principios', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const respuesta = await res.json();
        if (!res.ok) throw new Error(respuesta.error ?? 'No se pudo crear el principio activo.');
        router.push(`/admin/base-conocimiento/${respuesta.id}`);
        router.refresh();
        return;
      }

      const campos = {
        nombreCanonico, nombreComercial: nombreComercial || undefined, descripcion: descripcion || undefined,
        mecanismoAccion: mecanismoAccion || undefined,
        funcionesClinicas: listaDesdeTexto(funcionesClinicas), sistemasRelacionados: listaDesdeTexto(sistemasRelacionados),
        limiteEdadMinAnios: numeroOUndefined(limiteEdadMinAnios), limiteEdadMaxAnios: numeroOUndefined(limiteEdadMaxAnios),
        limitePesoMinKg: numeroOUndefined(limitePesoMinKg), limitePesoMaxKg: numeroOUndefined(limitePesoMaxKg),
        limiteRenal: limiteRenal || undefined, limiteHepatico: limiteHepatico || undefined,
        contraindicadoEmbarazo, contraindicadoLactancia, contraindicadoOncologico,
        precaucionAnticoagulacion, precaucionAntihipertensivos, precaucionHipoglucemiantes,
      };
      const res = await fetch(`/api/admin/base-conocimiento/principios/${principioId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campos, forzarSobrescritura }),
      });
      const respuesta = await res.json();
      if (!res.ok) throw new Error(respuesta.error ?? 'No se pudo guardar el principio activo.');
      router.push(`/admin/base-conocimiento/${principioId}`);
      router.refresh();
    } catch (err) {
      setEsError(true);
      setMensaje(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      <section className="rounded-card border border-linea bg-white p-5">
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Identificación</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className={etiqueta}>Nombre canónico *</label>
            <input className={campo} value={nombreCanonico} onChange={e => setNombreCanonico(e.target.value)} required minLength={2} /></div>
          <div><label className={etiqueta}>Nombre comercial</label>
            <input className={campo} value={nombreComercial} onChange={e => setNombreComercial(e.target.value)} /></div>
        </div>
        <div className="mt-3"><label className={etiqueta}>Descripción</label>
          <textarea className={campo} rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} /></div>
        <div className="mt-3"><label className={etiqueta}>Mecanismo de acción</label>
          <textarea className={campo} rows={2} value={mecanismoAccion} onChange={e => setMecanismoAccion(e.target.value)} /></div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div><label className={etiqueta}>Funciones clínicas (separadas por coma)</label>
            <input className={campo} value={funcionesClinicas} onChange={e => setFuncionesClinicas(e.target.value)} /></div>
          <div><label className={etiqueta}>Sistemas relacionados (separados por coma)</label>
            <input className={campo} value={sistemasRelacionados} onChange={e => setSistemasRelacionados(e.target.value)} /></div>
        </div>
        {modo === 'crear' && (
          <div className="mt-3"><label className={etiqueta}>Sinónimos (separados por coma)</label>
            <input className={campo} value={sinonimos} onChange={e => setSinonimos(e.target.value)} /></div>
        )}
      </section>

      <section className="rounded-card border border-linea bg-white p-5">
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Límites clínicos</p>
        <div className="grid gap-3 md:grid-cols-4">
          <div><label className={etiqueta}>Edad mín. (años)</label><input type="number" className={campo} value={limiteEdadMinAnios} onChange={e => setLimiteEdadMinAnios(e.target.value)} /></div>
          <div><label className={etiqueta}>Edad máx. (años)</label><input type="number" className={campo} value={limiteEdadMaxAnios} onChange={e => setLimiteEdadMaxAnios(e.target.value)} /></div>
          <div><label className={etiqueta}>Peso mín. (kg)</label><input type="number" className={campo} value={limitePesoMinKg} onChange={e => setLimitePesoMinKg(e.target.value)} /></div>
          <div><label className={etiqueta}>Peso máx. (kg)</label><input type="number" className={campo} value={limitePesoMaxKg} onChange={e => setLimitePesoMaxKg(e.target.value)} /></div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div><label className={etiqueta}>Límite renal</label><input className={campo} value={limiteRenal} onChange={e => setLimiteRenal(e.target.value)} /></div>
          <div><label className={etiqueta}>Límite hepático</label><input className={campo} value={limiteHepatico} onChange={e => setLimiteHepatico(e.target.value)} /></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-[13px] text-choco-deep">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={contraindicadoEmbarazo} onChange={e => setContraindicadoEmbarazo(e.target.checked)} /> Contraindicado en embarazo</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={contraindicadoLactancia} onChange={e => setContraindicadoLactancia(e.target.checked)} /> Contraindicado en lactancia</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={contraindicadoOncologico} onChange={e => setContraindicadoOncologico(e.target.checked)} /> Contraindicado oncológico</label>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-choco-deep">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={precaucionAnticoagulacion} onChange={e => setPrecaucionAnticoagulacion(e.target.checked)} /> Precaución con anticoagulación</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={precaucionAntihipertensivos} onChange={e => setPrecaucionAntihipertensivos(e.target.checked)} /> Precaución con antihipertensivos</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={precaucionHipoglucemiantes} onChange={e => setPrecaucionHipoglucemiantes(e.target.checked)} /> Precaución con hipoglucemiantes</label>
        </div>
      </section>

      {modo === 'crear' && (
        <section className="rounded-card border border-linea bg-white p-5">
          <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Dosis (opcional al crear)</p>
          <p className="mb-3 text-[12px] text-choco-soft">
            Toda dosis cargada acá queda marcada explícitamente "sin evidencia cargada" hasta vincular una referencia bibliográfica —
            nunca se presenta como validada sólo por estar cargada.
          </p>
          <div className="grid gap-3 md:grid-cols-4">
            <div><label className={etiqueta}>Mínima</label><input type="number" className={campo} value={dosisMinima} onChange={e => setDosisMinima(e.target.value)} /></div>
            <div><label className={etiqueta}>Usual</label><input type="number" className={campo} value={dosisUsual} onChange={e => setDosisUsual(e.target.value)} /></div>
            <div><label className={etiqueta}>Máxima</label><input type="number" className={campo} value={dosisMaxima} onChange={e => setDosisMaxima(e.target.value)} /></div>
            <div><label className={etiqueta}>Unidad</label>
              <select className={campo} value={dosisUnidad} onChange={e => setDosisUnidad(e.target.value as typeof UNIDADES[number])}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3"><label className={etiqueta}>Frecuencia (dosis usual)</label>
            <input className={campo} value={dosisFrecuencia} onChange={e => setDosisFrecuencia(e.target.value)} placeholder="ej. cada 24 horas" /></div>
        </section>
      )}

      {modo === 'crear' && (
        <section className="rounded-card border border-linea bg-white p-5">
          <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Contraindicaciones y evidencia</p>
          <div><label className={etiqueta}>Contraindicaciones (separadas por coma)</label>
            <input className={campo} value={contraindicaciones} onChange={e => setContraindicaciones(e.target.value)} /></div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div><label className={etiqueta}>Nivel de evidencia</label>
              <select className={campo} value={evidenciaNivel} onChange={e => setEvidenciaNivel(e.target.value)}>
                <option value="">Sin evidencia cargada</option>
                {NIVELES_EVIDENCIA.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div><label className={etiqueta}>Resumen de evidencia</label>
              <input className={campo} value={evidenciaResumen} onChange={e => setEvidenciaResumen(e.target.value)} /></div>
          </div>
        </section>
      )}

      {modo === 'editar' && (
        <label className="flex items-center gap-1.5 text-[13px] text-choco-deep">
          <input type="checkbox" checked={forzarSobrescritura} onChange={e => setForzarSobrescritura(e.target.checked)} />
          Confirmo sobrescribir un principio ya validado (vuelve a quedar en revisión)
        </label>
      )}

      {mensaje && <p className={`text-[13px] ${esError ? 'text-fase-reset' : 'text-fase-restore'}`}>{mensaje}</p>}

      <button type="submit" disabled={enviando} className="rounded-md bg-choco-deep px-4 py-2.5 text-[13px] font-medium text-white hover:bg-choco-mid disabled:opacity-50">
        {enviando ? 'Guardando...' : modo === 'crear' ? 'Crear principio activo' : 'Guardar cambios'}
      </button>
    </form>
  );
}
