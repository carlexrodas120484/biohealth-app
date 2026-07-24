'use client';

import { useState } from 'react';
import { PacienteSchema, type PacienteFormValues } from '@/lib/validation/paciente';

const VACIO: PacienteFormValues = {
  nombre: '', apellido: '', documento: '', fechaNacimiento: '', sexo: 'femenino' as any,
  telefono: '', correo: '', direccion: '', ciudad: '', ocupacion: '',
  motivoConsulta: '', antecedentesPersonales: '', antecedentesFamiliares: '',
  medicamentosActuales: '', alergias: '', observaciones: '',
};

interface PacienteFormProps {
  valoresIniciales?: Partial<PacienteFormValues>;
  onSubmit: (valores: PacienteFormValues) => Promise<{ error?: string } | void>;
  textoBoton: string;
}

function Campo({ label, children, obligatorio }: { label: string; children: React.ReactNode; obligatorio?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] text-choco-soft">
        {label}{obligatorio && <span className="text-fase-reset"> *</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls = 'w-full rounded-md border border-linea px-3 py-2 text-sm focus:border-oro-claro focus:outline-none focus:ring-2 focus:ring-oro/10';

export function PacienteForm({ valoresIniciales, onSubmit, textoBoton }: PacienteFormProps) {
  const [v, setV] = useState<PacienteFormValues>({ ...VACIO, ...valoresIniciales } as PacienteFormValues);
  const [errores, setErrores] = useState<Partial<Record<keyof PacienteFormValues, string>>>({});
  const [enviando, setEnviando] = useState(false);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const set = (campo: keyof PacienteFormValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setV(prev => ({ ...prev, [campo]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMensajeError(null);
    setExito(false);

    const parsed = PacienteSchema.safeParse(v);
    if (!parsed.success) {
      const campos = parsed.error.flatten().fieldErrors;
      setErrores(Object.fromEntries(Object.entries(campos).map(([k, msgs]) => [k, msgs?.[0]])));
      return;
    }
    setErrores({});
    setEnviando(true);
    try {
      const resultado = await onSubmit(parsed.data);
      if (resultado?.error) {
        setMensajeError(resultado.error);
      } else {
        setExito(true);
      }
    } catch {
      setMensajeError('No se pudo guardar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {mensajeError && (
        <div className="rounded-lg border border-fase-reset/30 bg-fase-reset/10 px-4 py-3 text-[13px] text-fase-reset">
          {mensajeError}
        </div>
      )}
      {exito && (
        <div className="rounded-lg border border-fase-restore/30 bg-fase-restore/10 px-4 py-3 text-[13px] text-fase-restore">
          ✓ Paciente guardado correctamente.
        </div>
      )}

      <section className="rounded-card border border-linea bg-white p-5">
        <p className="mb-4 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Datos personales</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Nombre" obligatorio>
            <input className={inputCls} value={v.nombre} onChange={set('nombre')} />
            {errores.nombre && <p className="mt-1 text-xs text-fase-reset">{errores.nombre}</p>}
          </Campo>
          <Campo label="Apellido" obligatorio>
            <input className={inputCls} value={v.apellido} onChange={set('apellido')} />
            {errores.apellido && <p className="mt-1 text-xs text-fase-reset">{errores.apellido}</p>}
          </Campo>
          <Campo label="Documento">
            <input className={inputCls} value={v.documento} onChange={set('documento')} placeholder="0.000.000" />
          </Campo>
          <Campo label="Fecha de nacimiento">
            <input type="date" className={inputCls} value={v.fechaNacimiento} onChange={set('fechaNacimiento')} />
          </Campo>
          <Campo label="Sexo" obligatorio>
            <select className={inputCls} value={v.sexo} onChange={set('sexo')}>
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
            </select>
            {errores.sexo && <p className="mt-1 text-xs text-fase-reset">{errores.sexo}</p>}
          </Campo>
          <Campo label="Ocupación">
            <input className={inputCls} value={v.ocupacion} onChange={set('ocupacion')} />
          </Campo>
        </div>
      </section>

      <section className="rounded-card border border-linea bg-white p-5">
        <p className="mb-4 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Contacto</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Teléfono">
            <input className={inputCls} value={v.telefono} onChange={set('telefono')} placeholder="0973 913 205" />
          </Campo>
          <Campo label="Correo">
            <input type="email" className={inputCls} value={v.correo} onChange={set('correo')} />
            {errores.correo && <p className="mt-1 text-xs text-fase-reset">{errores.correo}</p>}
          </Campo>
          <Campo label="Dirección">
            <input className={inputCls} value={v.direccion} onChange={set('direccion')} />
          </Campo>
          <Campo label="Ciudad">
            <input className={inputCls} value={v.ciudad} onChange={set('ciudad')} placeholder="Ayolas" />
          </Campo>
        </div>
      </section>

      <section className="rounded-card border border-linea bg-white p-5">
        <p className="mb-4 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Consulta y antecedentes</p>
        <div className="grid grid-cols-1 gap-4">
          <Campo label="Motivo de consulta">
            <textarea className={`${inputCls} min-h-[70px]`} value={v.motivoConsulta} onChange={set('motivoConsulta')} />
          </Campo>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Antecedentes personales">
              <textarea className={`${inputCls} min-h-[70px]`} value={v.antecedentesPersonales} onChange={set('antecedentesPersonales')} />
            </Campo>
            <Campo label="Antecedentes familiares">
              <textarea className={`${inputCls} min-h-[70px]`} value={v.antecedentesFamiliares} onChange={set('antecedentesFamiliares')} />
            </Campo>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Medicamentos actuales">
              <textarea className={`${inputCls} min-h-[70px]`} value={v.medicamentosActuales} onChange={set('medicamentosActuales')} />
            </Campo>
            <Campo label="Alergias">
              <textarea className={`${inputCls} min-h-[70px]`} value={v.alergias} onChange={set('alergias')} />
            </Campo>
          </div>
          <Campo label="Observaciones">
            <textarea className={`${inputCls} min-h-[70px]`} value={v.observaciones} onChange={set('observaciones')} />
          </Campo>
        </div>
      </section>

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-md bg-choco-deep py-2.5 text-sm text-crema disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {enviando ? 'Guardando…' : textoBoton}
      </button>
    </form>
  );
}
