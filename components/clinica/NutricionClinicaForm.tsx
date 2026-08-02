'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { siguientePaso } from '@/lib/flujo/pasos';

type EstadoPlan = 'borrador' | 'sugerido' | 'revisado' | 'aprobado' | 'archivado';
type Horario = 'desayuno' | 'media_manana' | 'almuerzo' | 'media_tarde' | 'cena' | 'antes_de_dormir';
type ComidaMenu = { horario: Horario; descripcion: string; alternativas: string[] };
type Calculos = {
  imc: number; clasificacionImc: string; gebKcal: number; getKcal: number; objetivoCaloricoKcal: number;
  proteinaG: number; carbohidratosG: number; grasasG: number; fibraG: number; aguaMl: number;
};
type Restricciones = { alergiasAlimentarias: string[]; celiaquia: boolean; vegetarianismo: boolean; veganismo: boolean };
type PlanAlimentario = {
  numeroComidas: number; menuDiario: ComidaMenu[]; menuSemanal: Record<string, ComidaMenu[]>;
  alimentosRecomendados: string[]; alimentosALimitar: string[]; alimentosAEvitar: string[];
  listaCompras: string[]; observaciones: string; duracionDias: number;
};
type Advertencia = { codigo: string; descripcion: string; fuente: string };
type ObjetivoDisponible = { codigo: string; nombre: string; priorizarDefecto: string; evitarDefecto: string };
type Alimento = { codigo: string; nombre: string; categoria: string };
type Respuesta = {
  fase: string; tieneFormula: boolean; objetivoClinico: string; pesoKg: number; tallaCm: number;
  edadAnios: number; sexo: string; nivelActividad: string; calculos: Calculos; restricciones: Restricciones;
  plan: PlanAlimentario; advertencias: Advertencia[]; estado: EstadoPlan; updatedAt: string | null;
  objetivosClinicosDisponibles: ObjetivoDisponible[]; catalogoAlimentos: Alimento[];
  contextoFormulacion: { ingredientesAprobados: string[] }; advertencia: string;
};

const NIVELES_ACTIVIDAD = ['sedentario', 'ligero', 'moderado', 'intenso', 'muy_intenso'];
const ETIQUETA_HORARIO: Record<Horario, string> = { desayuno: 'Desayuno', media_manana: 'Media mañana', almuerzo: 'Almuerzo', media_tarde: 'Media tarde', cena: 'Cena', antes_de_dormir: 'Antes de dormir' };
const ETIQUETA_ESTADO: Record<EstadoPlan, string> = { borrador: 'Borrador', sugerido: 'Sugerido', revisado: 'Revisado', aprobado: 'Aprobado', archivado: 'Archivado' };
const campo = 'w-full rounded-md border border-linea bg-white px-3 py-2 text-sm focus:border-oro-claro focus:outline-none focus:ring-2 focus:ring-oro/10';

function listaDesdeTexto(texto: string): string[] {
  return texto.split(',').map(s => s.trim()).filter(Boolean);
}

function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PY', { dateStyle: 'medium', timeStyle: 'short' });
}

export function NutricionClinicaForm({ pacienteId }: { pacienteId: string }) {
  const router = useRouter();
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [objetivoClinico, setObjetivoClinico] = useState('mantenimiento');
  const [pesoKg, setPesoKg] = useState(70);
  const [tallaCm, setTallaCm] = useState(165);
  const [nivelActividad, setNivelActividad] = useState('moderado');
  const [calculos, setCalculos] = useState<Calculos | null>(null);
  const [restricciones, setRestricciones] = useState<Restricciones>({ alergiasAlimentarias: [], celiaquia: false, vegetarianismo: false, veganismo: false });
  const [plan, setPlan] = useState<PlanAlimentario | null>(null);
  const [advertencias, setAdvertencias] = useState<Advertencia[]>([]);
  const [estado, setEstado] = useState<EstadoPlan>('borrador');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [esError, setEsError] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/pacientes/${pacienteId}/nutricion`).then(async r => {
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? 'No se pudo cargar el plan nutricional.');
      if (cancelado) return;
      setDatos(b);
      setObjetivoClinico(b.objetivoClinico); setPesoKg(b.pesoKg); setTallaCm(b.tallaCm); setNivelActividad(b.nivelActividad);
      setCalculos(b.calculos); setRestricciones(b.restricciones); setPlan(b.plan);
      setAdvertencias(b.advertencias ?? []); setEstado(b.estado ?? 'borrador');
    }).catch(e => { if (!cancelado) { setEsError(true); setMensaje(e instanceof Error ? e.message : 'No se pudo cargar el plan nutricional.'); } })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [pacienteId]);

  async function guardar(nuevoEstado: EstadoPlan) {
    if (!plan) return;
    setGuardando(true); setMensaje(''); setEsError(false);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/nutricion`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objetivoClinico, pesoKg, tallaCm, nivelActividad, restricciones, plan, estado: nuevoEstado,
          calculosOverride: calculos ?? undefined,
        }),
      });
      const b = await res.json();
      if (!res.ok) { setEsError(true); setMensaje(b.error ?? 'No se pudo guardar el plan nutricional.'); return; }
      setCalculos(b.calculos); setAdvertencias(b.advertencias ?? []); setEstado(b.estado ?? nuevoEstado);
      setMensaje(nuevoEstado === 'aprobado' ? 'Plan nutricional aprobado.' : 'Plan nutricional guardado.');
      if (nuevoEstado === 'aprobado') {
        const siguiente = siguientePaso('nutricion');
        if (siguiente) router.push(`/pacientes/${pacienteId}/${siguiente}`);
      }
    } catch {
      setEsError(true);
      setMensaje('No se pudo guardar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <p className="text-sm text-choco-soft">Cargando nutrición…</p>;
  if (!datos || !plan || !calculos) return <div className="rounded-card border border-linea bg-white p-5 text-sm text-choco-soft">{mensaje}</div>;
  const bloqueado = estado === 'aprobado' || estado === 'archivado';

  return <div className="space-y-5">
    <section className="rounded-card border border-linea bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 9</p>
          <h2 className="font-serif text-2xl text-choco-deep">Nutrición clínica inteligente</h2>
        </div>
        <span className="rounded-full border border-linea px-2 py-0.5 text-[11px] text-choco-soft">{ETIQUETA_ESTADO[estado]}</span>
      </div>
      <p className="mb-1 text-xs text-choco-soft">Plan individualizado alineado a la fase {datos.fase}. Última actualización: {formatearFecha(datos.updatedAt)}.</p>
      <p className="text-xs text-choco-soft">La fórmula magistral {datos.tieneFormula ? 'está firmada.' : 'aún no está firmada.'}</p>
    </section>

    {advertencias.length > 0 && (
      <section className="rounded-card border border-fase-reset/20 bg-white p-5">
        <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-wider text-fase-reset">Advertencias para revisión profesional</p>
        <ul className="space-y-1 text-[12.5px] text-choco-mid">
          {advertencias.map(a => <li key={a.codigo}>· {a.descripcion}</li>)}
        </ul>
      </section>
    )}

    <section className="rounded-card border border-linea bg-white p-5">
      <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Objetivo y cálculos</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-choco-soft sm:col-span-2">Objetivo clínico
          <select disabled={bloqueado} className={`${campo} mt-1`} value={objetivoClinico} onChange={e => setObjetivoClinico(e.target.value)}>
            {datos.objetivosClinicosDisponibles.map(o => <option key={o.codigo} value={o.codigo}>{o.nombre}</option>)}
          </select>
        </label>
        <label className="text-xs text-choco-soft">Peso (kg)<input disabled={bloqueado} type="number" min={1} className={`${campo} mt-1`} value={pesoKg} onChange={e => setPesoKg(Number(e.target.value))} /></label>
        <label className="text-xs text-choco-soft">Talla (cm)<input disabled={bloqueado} type="number" min={1} className={`${campo} mt-1`} value={tallaCm} onChange={e => setTallaCm(Number(e.target.value))} /></label>
        <label className="text-xs text-choco-soft sm:col-span-2">Nivel de actividad
          <select disabled={bloqueado} className={`${campo} mt-1`} value={nivelActividad} onChange={e => setNivelActividad(e.target.value)}>
            {NIVELES_ACTIVIDAD.map(n => <option key={n} value={n}>{n.replace('_', ' ')}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-xs text-choco-soft">IMC<input disabled className={`${campo} mt-1 bg-marfil`} value={`${calculos.imc} (${calculos.clasificacionImc})`} /></label>
        <label className="text-xs text-choco-soft">GEB (kcal)<input disabled className={`${campo} mt-1 bg-marfil`} value={calculos.gebKcal} /></label>
        <label className="text-xs text-choco-soft">GET (kcal)<input disabled className={`${campo} mt-1 bg-marfil`} value={calculos.getKcal} /></label>
        <label className="text-xs text-choco-soft">Objetivo calórico (kcal)<input disabled={bloqueado} type="number" className={campo + ' mt-1'} value={calculos.objetivoCaloricoKcal} onChange={e => setCalculos(c => c && { ...c, objetivoCaloricoKcal: Number(e.target.value) })} /></label>
        <label className="text-xs text-choco-soft">Proteína (g)<input disabled={bloqueado} type="number" className={`${campo} mt-1`} value={calculos.proteinaG} onChange={e => setCalculos(c => c && { ...c, proteinaG: Number(e.target.value) })} /></label>
        <label className="text-xs text-choco-soft">Carbohidratos (g)<input disabled={bloqueado} type="number" className={`${campo} mt-1`} value={calculos.carbohidratosG} onChange={e => setCalculos(c => c && { ...c, carbohidratosG: Number(e.target.value) })} /></label>
        <label className="text-xs text-choco-soft">Grasas (g)<input disabled={bloqueado} type="number" className={`${campo} mt-1`} value={calculos.grasasG} onChange={e => setCalculos(c => c && { ...c, grasasG: Number(e.target.value) })} /></label>
        <label className="text-xs text-choco-soft">Fibra (g)<input disabled={bloqueado} type="number" className={`${campo} mt-1`} value={calculos.fibraG} onChange={e => setCalculos(c => c && { ...c, fibraG: Number(e.target.value) })} /></label>
        <label className="text-xs text-choco-soft">Agua (ml)<input disabled={bloqueado} type="number" className={`${campo} mt-1`} value={calculos.aguaMl} onChange={e => setCalculos(c => c && { ...c, aguaMl: Number(e.target.value) })} /></label>
      </div>
      <p className="mt-2 text-[11px] text-choco-soft">Todos los valores calculados pueden sobrescribirse.</p>
    </section>

    <section className="rounded-card border border-linea bg-white p-5">
      <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Restricciones</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-choco-mid"><input disabled={bloqueado} type="checkbox" checked={restricciones.celiaquia} onChange={e => setRestricciones(r => ({ ...r, celiaquia: e.target.checked }))} /> Celiaquía</label>
        <label className="flex items-center gap-2 text-sm text-choco-mid"><input disabled={bloqueado} type="checkbox" checked={restricciones.vegetarianismo} onChange={e => setRestricciones(r => ({ ...r, vegetarianismo: e.target.checked }))} /> Vegetarianismo</label>
        <label className="flex items-center gap-2 text-sm text-choco-mid"><input disabled={bloqueado} type="checkbox" checked={restricciones.veganismo} onChange={e => setRestricciones(r => ({ ...r, veganismo: e.target.checked }))} /> Veganismo</label>
        <label className="text-xs text-choco-soft">Alergias alimentarias (separadas por coma)
          <input disabled={bloqueado} className={`${campo} mt-1`} value={restricciones.alergiasAlimentarias.join(', ')} onChange={e => setRestricciones(r => ({ ...r, alergiasAlimentarias: listaDesdeTexto(e.target.value) }))} />
        </label>
      </div>
    </section>

    <section className="rounded-card border border-linea bg-white p-5">
      <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Plan alimentario</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs text-choco-soft">Comidas por día<input disabled={bloqueado} type="number" min={1} max={6} className={`${campo} mt-1`} value={plan.numeroComidas} onChange={e => setPlan(p => p && { ...p, numeroComidas: Number(e.target.value) })} /></label>
        <label className="text-xs text-choco-soft">Duración (días)<input disabled={bloqueado} type="number" min={1} className={`${campo} mt-1`} value={plan.duracionDias} onChange={e => setPlan(p => p && { ...p, duracionDias: Number(e.target.value) })} /></label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-choco-soft">Alimentos recomendados<textarea disabled={bloqueado} rows={3} className={`${campo} mt-1`} value={plan.alimentosRecomendados.join(', ')} onChange={e => setPlan(p => p && { ...p, alimentosRecomendados: listaDesdeTexto(e.target.value) })} /></label>
        <label className="text-xs text-choco-soft">Alimentos a limitar<textarea disabled={bloqueado} rows={3} className={`${campo} mt-1`} value={plan.alimentosALimitar.join(', ')} onChange={e => setPlan(p => p && { ...p, alimentosALimitar: listaDesdeTexto(e.target.value) })} /></label>
        <label className="text-xs text-choco-soft">Alimentos a evitar<textarea disabled={bloqueado} rows={3} className={`${campo} mt-1`} value={plan.alimentosAEvitar.join(', ')} onChange={e => setPlan(p => p && { ...p, alimentosAEvitar: listaDesdeTexto(e.target.value) })} /></label>
      </div>
      <label className="mt-3 block text-xs text-choco-soft">Lista de compras<textarea disabled={bloqueado} rows={2} className={`${campo} mt-1`} value={plan.listaCompras.join(', ')} onChange={e => setPlan(p => p && { ...p, listaCompras: listaDesdeTexto(e.target.value) })} /></label>
      <label className="mt-3 block text-xs text-choco-soft">Observaciones<textarea disabled={bloqueado} rows={3} className={`${campo} mt-1`} value={plan.observaciones} onChange={e => setPlan(p => p && { ...p, observaciones: e.target.value })} /></label>

      <div className="mt-4">
        <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Menú diario</p>
        <div className="space-y-2">
          {plan.menuDiario.map((c, i) => <div key={i} className="grid gap-2 sm:grid-cols-[120px_1fr]">
            <span className="text-xs text-choco-soft">{ETIQUETA_HORARIO[c.horario]}</span>
            <input disabled={bloqueado} className={campo} value={c.descripcion} onChange={e => setPlan(p => p && { ...p, menuDiario: p.menuDiario.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x) })} />
          </div>)}
          {plan.menuDiario.length === 0 && <p className="text-xs text-choco-soft">Sin comidas cargadas todavía.</p>}
        </div>
      </div>
    </section>

    {datos.contextoFormulacion.ingredientesAprobados.length > 0 && (
      <section className="rounded-card border border-linea bg-white p-5">
        <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Suplementos aprobados (formulación)</p>
        <p className="text-sm text-choco-mid">{datos.contextoFormulacion.ingredientesAprobados.join(', ')}</p>
        <p className="mt-1 text-[11px] text-choco-soft">Coordinar horarios y evitar duplicar nutrientes. La formulación no se modifica desde acá.</p>
      </section>
    )}

    <section className="rounded-card border border-linea bg-white p-5">
      <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Catálogo de alimentos locales</p>
      <p className="text-[12.5px] text-choco-mid">{datos.catalogoAlimentos.map(a => a.nombre).join(', ')}</p>
    </section>

    {mensaje && <p className={`text-sm ${esError ? 'text-fase-reset' : 'text-choco-mid'}`}>{mensaje}</p>}
    <div className="flex flex-wrap gap-2">
      <button disabled={guardando} onClick={() => guardar('borrador')} className="rounded-md border border-linea-fuerte px-5 py-2.5 text-sm disabled:opacity-40">Guardar borrador</button>
      <button disabled={guardando} onClick={() => guardar('revisado')} className="rounded-md border border-linea-fuerte px-5 py-2.5 text-sm disabled:opacity-40">Marcar como revisado</button>
      <button disabled={guardando} onClick={() => guardar('aprobado')} className="rounded-md bg-choco-deep px-5 py-2.5 text-sm text-crema disabled:opacity-40">Aprobar plan</button>
      {estado === 'aprobado' && <button disabled={guardando} onClick={() => guardar('archivado')} className="rounded-md border border-fase-reset/40 px-5 py-2.5 text-sm text-fase-reset disabled:opacity-40">Archivar</button>}
    </div>
    <p className="text-[11.5px] text-choco-soft">{datos.advertencia}</p>
  </div>;
}
