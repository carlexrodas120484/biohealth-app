'use client';

import { useEffect, useState } from 'react';

type Historia = Record<string, string | number | boolean | null>;

const INICIAL: Historia = {
  motivo: '', enfermedadActual: '', inicioEvolucion: '', cirugias: '', hospitalizaciones: '',
  alimentacion: '', aguaLitros: '', suenoHoras: '', estres: '', actividadFisica: '', bristol: '',
  peso: '', talla: '', presionArterial: '', frecuenciaCardiaca: '', saturacion: '', cintura: '',
  fiebrePersistente: false, perdidaPesoInvoluntaria: false, sangrado: false,
  dolorToracico: false, disneaReposo: false, deficitNeurologico: false,
  impresionClinica: '', planInicial: '',
};

const input = 'w-full rounded-md border border-linea px-3 py-2 text-sm focus:border-oro-claro focus:outline-none focus:ring-2 focus:ring-oro/10';

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] text-choco-soft">{label}</span>{children}</label>;
}

export function HistoriaClinicaForm({ pacienteId }: { pacienteId: string }) {
  const [v, setV] = useState<Historia>(INICIAL);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    fetch(`/api/pacientes/${pacienteId}/historia`).then(r => r.json()).then(body => {
      setV({ ...INICIAL, ...(body.historia ?? {}) });
    }).finally(() => setCargando(false));
  }, [pacienteId]);

  const set = (campo: string, valor: string | boolean) => setV(prev => ({ ...prev, [campo]: valor }));

  async function guardar() {
    setGuardando(true); setMensaje('');
    const actual = await fetch(`/api/pacientes/${pacienteId}/historia`).then(r => r.json());
    const res = await fetch(`/api/pacientes/${pacienteId}/historia`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ historia: v, respuestas: actual.respuestas ?? {}, completado: actual.completado ?? false }),
    });
    const body = await res.json();
    setMensaje(res.ok ? 'Historia clínica guardada correctamente.' : body.error ?? 'No se pudo guardar.');
    setGuardando(false);
  }

  if (cargando) return <p className="text-sm text-choco-soft">Cargando historia clínica…</p>;

  const texto = (campo: string, rows = 3) => <textarea rows={rows} className={input} value={String(v[campo] ?? '')} onChange={e => set(campo, e.target.value)} />;
  const simple = (campo: string, type = 'text') => <input type={type} className={input} value={String(v[campo] ?? '')} onChange={e => set(campo, e.target.value)} />;

  return <div className="space-y-5">
    <section className="rounded-card border border-linea bg-white p-5">
      <p className="mb-4 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Anamnesis</p>
      <div className="space-y-4">
        <Campo label="Motivo de consulta">{texto('motivo')}</Campo>
        <Campo label="Enfermedad actual">{texto('enfermedadActual', 4)}</Campo>
        <Campo label="Inicio, frecuencia y evolución">{texto('inicioEvolucion')}</Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Cirugías">{texto('cirugias')}</Campo>
          <Campo label="Hospitalizaciones">{texto('hospitalizaciones')}</Campo>
        </div>
      </div>
    </section>

    <section className="rounded-card border border-linea bg-white p-5">
      <p className="mb-4 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Hábitos y estilo de vida</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Alimentación habitual">{texto('alimentacion')}</Campo>
        <Campo label="Actividad física">{texto('actividadFisica')}</Campo>
        <Campo label="Agua por día (litros)">{simple('aguaLitros', 'number')}</Campo>
        <Campo label="Sueño por noche (horas)">{simple('suenoHoras', 'number')}</Campo>
        <Campo label="Estrés percibido (0–10)">{simple('estres', 'number')}</Campo>
        <Campo label="Escala de Bristol (1–7)">{simple('bristol', 'number')}</Campo>
      </div>
    </section>

    <section className="rounded-card border border-linea bg-white p-5">
      <p className="mb-4 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Signos vitales y antropometría</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          ['peso','Peso (kg)'], ['talla','Talla (cm)'], ['presionArterial','Presión arterial'],
          ['frecuenciaCardiaca','Frecuencia cardiaca'], ['saturacion','SpO₂ (%)'], ['cintura','Cintura (cm)'],
        ].map(([campo,label]) => <Campo key={campo} label={label}>{simple(campo)}</Campo>)}
      </div>
    </section>

    <section className="rounded-card border border-fase-reset/20 bg-white p-5">
      <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-fase-reset">Banderas rojas</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ['fiebrePersistente','Fiebre persistente'], ['perdidaPesoInvoluntaria','Pérdida de peso involuntaria'],
          ['sangrado','Sangrado inexplicado'], ['dolorToracico','Dolor torácico'],
          ['disneaReposo','Disnea en reposo'], ['deficitNeurologico','Déficit neurológico nuevo'],
        ].map(([campo,label]) => <label key={campo} className="flex items-center gap-2 text-sm text-choco-deep">
          <input type="checkbox" checked={Boolean(v[campo])} onChange={e => set(campo, e.target.checked)} className="accent-fase-reset" /> {label}
        </label>)}
      </div>
    </section>

    <section className="rounded-card border border-linea bg-white p-5">
      <p className="mb-4 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Evaluación médica</p>
      <div className="space-y-4">
        <Campo label="Impresión clínica / diagnóstico funcional">{texto('impresionClinica', 4)}</Campo>
        <Campo label="Plan inicial y estudios solicitados">{texto('planInicial', 4)}</Campo>
      </div>
    </section>

    {mensaje && <p className="text-sm text-choco-mid">{mensaje}</p>}
    <button onClick={guardar} disabled={guardando} className="rounded-md bg-choco-deep px-6 py-2.5 text-sm text-crema disabled:opacity-50">
      {guardando ? 'Guardando…' : 'Guardar historia clínica'}
    </button>
  </div>;
}

