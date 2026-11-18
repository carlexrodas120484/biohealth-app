import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icono } from '@/components/ui/Icono';
import { Boton } from '@/components/ui/Boton';
import { servicios, servicioPorId } from '@/config/servicios';
import { profesionalesActivos, nombreCompleto } from '@/config/profesionales';
import { agenda } from '@/config/agenda';
import { aISO, deISO, fechaLarga, sumarDias, NOMBRES_DIAS } from '@/lib/fechas';
import { avisoTurno, enlaceWhatsApp, mensajeTurno, whatsappConfigurado } from '@/lib/whatsapp';
import { registrarConversion } from '@/lib/analitica';

const SIN_PREFERENCIA = '';

interface Props {
  servicioInicial?: string;
  profesionalInicial?: string;
}

type Errores = Partial<Record<'nombre' | 'servicio' | 'fecha' | 'horario', string>>;

const diasAtencionTexto = () => {
  const d = agenda.diasDeAtencion;
  if (d.length === 6 && !d.includes(0)) return 'de lunes a sábado';
  if (d.length === 5 && !d.includes(0) && !d.includes(6)) return 'de lunes a viernes';
  return d.map((i) => NOMBRES_DIAS[i]).join(', ');
};

export function FormularioTurno({ servicioInicial = '', profesionalInicial = '' }: Props) {
  const profesionales = useMemo(() => profesionalesActivos(), []);
  const profInicial = profesionales.find((p) => p.id === profesionalInicial);
  const servInicial =
    servicioPorId(servicioInicial)?.id ?? (profInicial ? profInicial.servicios[0] ?? '' : '');

  const [nombre, setNombre] = useState('');
  const [servicio, setServicio] = useState(servInicial);
  const [profesional, setProfesional] = useState(profInicial?.id ?? SIN_PREFERENCIA);
  const [fecha, setFecha] = useState('');
  const [horario, setHorario] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [enlaceEnviado, setEnlaceEnviado] = useState('');

  const hoy = useMemo(() => new Date(), []);
  const min = aISO(hoy);
  const max = aISO(sumarDias(hoy, agenda.diasMaximosAnticipacion));

  const disponibles = useMemo(
    () => (servicio ? profesionales.filter((p) => p.servicios.includes(servicio)) : profesionales),
    [servicio, profesionales],
  );

  // Si el profesional elegido no atiende la especialidad, se vuelve a "sin preferencia".
  useEffect(() => {
    if (profesional && !disponibles.some((p) => p.id === profesional)) setProfesional(SIN_PREFERENCIA);
  }, [disponibles, profesional]);

  const prof = profesionales.find((p) => p.id === profesional);
  const franjas: readonly string[] = prof && prof.franjas.length > 0 ? prof.franjas : agenda.franjasGenerales;

  useEffect(() => {
    if (horario && !franjas.includes(horario)) setHorario('');
  }, [franjas, horario]);

  function validar(): Errores {
    const e: Errores = {};
    const n = nombre.trim();
    if (n.length < 2) e.nombre = 'Ingresá tu nombre para que podamos identificar la solicitud.';
    if (!servicio) e.servicio = 'Elegí una especialidad o estudio.';
    const d = deISO(fecha);
    if (!d) e.fecha = 'Elegí la fecha que preferís.';
    else if (fecha < min) e.fecha = 'La fecha no puede ser anterior a hoy.';
    else if (fecha > max) e.fecha = `Podés solicitar turnos hasta ${agenda.diasMaximosAnticipacion} días en adelante.`;
    else if (!agenda.diasDeAtencion.includes(d.getDay())) e.fecha = `Atendemos ${diasAtencionTexto()}. Elegí otro día.`;
    if (!horario) e.horario = 'Elegí un horario de preferencia.';
    return e;
  }

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length > 0) {
      const primero = Object.keys(e)[0];
      document.getElementById(`turno-${primero}`)?.focus();
      return;
    }
    const servicioNombre = servicioPorId(servicio)?.nombre ?? servicio;
    const mensaje = mensajeTurno({
      nombre: nombre.trim().slice(0, 60),
      especialidad: servicioNombre,
      profesional: prof ? nombreCompleto(prof) : 'Sin preferencia',
      fecha: fechaLarga(deISO(fecha)!),
      horario,
      motivo: motivo || undefined,
    });
    registrarConversion('solicitud_turno', { especialidad: servicioNombre });
    const url = enlaceWhatsApp(mensaje);
    // En la vista previa autocontenida las ventanas emergentes están bloqueadas: se usa solo el enlace.
    if (!__HASH_ROUTER__) window.open(url, '_blank', 'noopener,noreferrer');
    setEnlaceEnviado(url);
  }

  const campo =
    'mt-2 block w-full rounded-xl border bg-white px-4 py-3.5 text-[0.95rem] text-tinta transition placeholder:text-tinta-tenue focus:border-dorado focus:outline-none focus:ring-4 focus:ring-dorado/15';
  const borde = (k: keyof Errores) => (errores[k] ? 'border-red-400' : 'border-linea');
  const Error = ({ k }: { k: keyof Errores }) =>
    errores[k] ? (
      <p id={`error-${k}`} role="alert" className="mt-1.5 text-xs text-red-700">
        {errores[k]}
      </p>
    ) : null;
  const aria = (k: keyof Errores) => ({
    'aria-invalid': !!errores[k],
    'aria-describedby': errores[k] ? `error-${k}` : undefined,
  });

  return (
    <form onSubmit={enviar} noValidate className="rounded-[1.8rem] border border-linea bg-white p-6 shadow-elevada sm:p-10">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="turno-nombre" className="etiqueta-campo">Nombre y apellido</label>
          <input
            id="turno-nombre"
            type="text"
            autoComplete="name"
            maxLength={60}
            placeholder="Ej.: María González"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={`${campo} ${borde('nombre')}`}
            {...aria('nombre')}
          />
          <Error k="nombre" />
        </div>

        <div>
          <label htmlFor="turno-servicio" className="etiqueta-campo">Especialidad o estudio</label>
          <select
            id="turno-servicio"
            value={servicio}
            onChange={(e) => setServicio(e.target.value)}
            className={`${campo} ${borde('servicio')}`}
            {...aria('servicio')}
          >
            <option value="">Seleccionar…</option>
            <optgroup label="Especialidades">
              {servicios.filter((s) => s.categoria === 'consulta').map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </optgroup>
            <optgroup label="Estudios y evaluaciones">
              {servicios.filter((s) => s.categoria !== 'consulta').map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </optgroup>
          </select>
          <Error k="servicio" />
        </div>

        <div>
          <label htmlFor="turno-profesional" className="etiqueta-campo">Profesional</label>
          <select
            id="turno-profesional"
            value={profesional}
            onChange={(e) => setProfesional(e.target.value)}
            className={`${campo} border-linea`}
          >
            <option value={SIN_PREFERENCIA}>
              {disponibles.length === 0 ? 'A asignar por el centro' : 'Sin preferencia'}
            </option>
            {disponibles.map((p) => (
              <option key={p.id} value={p.id}>{nombreCompleto(p)}</option>
            ))}
          </select>
          {servicio && disponibles.length === 0 && (
            <p className="mt-1.5 text-xs text-tinta-tenue">El centro te indicará el profesional disponible.</p>
          )}
        </div>

        <div>
          <label htmlFor="turno-fecha" className="etiqueta-campo">Fecha deseada</label>
          <input
            id="turno-fecha"
            type="date"
            min={min}
            max={max}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={`${campo} ${borde('fecha')}`}
            {...aria('fecha')}
          />
          {errores.fecha ? <Error k="fecha" /> : (
            <p className="mt-1.5 text-xs text-tinta-tenue">Atención {diasAtencionTexto()}.</p>
          )}
        </div>

        <div>
          <label htmlFor="turno-horario" className="etiqueta-campo">Horario preferido</label>
          <select
            id="turno-horario"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            className={`${campo} ${borde('horario')}`}
            {...aria('horario')}
          >
            <option value="">Seleccionar…</option>
            {franjas.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <Error k="horario" />
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="etiqueta-campo">Tipo de consulta <span className="font-normal normal-case tracking-normal text-tinta-tenue">(opcional)</span></legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {agenda.motivos.map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMotivo(motivo === m ? '' : m)}
                aria-pressed={motivo === m}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  motivo === m ? 'border-dorado bg-dorado-wash text-dorado-oscuro' : 'border-linea text-tinta-suave hover:border-dorado/60'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-8 flex gap-3 rounded-2xl bg-crema p-4 text-xs leading-relaxed text-tinta-suave sm:text-sm">
        <Icono nombre="escudo" className="mt-0.5 h-5 w-5 shrink-0 text-dorado-oscuro" />
        <p>
          <strong className="font-semibold text-tinta">Turno sujeto a confirmación.</strong> {avisoTurno} Por tu privacidad, no
          incluyas información clínica en el mensaje: la conversamos de forma reservada en la consulta. Este sitio no almacena tus datos.
        </p>
      </div>

      <Boton type="submit" variante="whatsapp" className="mt-8 w-full !py-4 text-[0.85rem]">
        <Icono nombre="whatsapp" className="h-5 w-5" />
        Solicitar turno
      </Boton>

      {!whatsappConfigurado() && (
        <p className="mt-3 text-center text-xs text-tinta-tenue">
          Se abrirá WhatsApp con el mensaje listo para enviar al número oficial de BioHealth.
        </p>
      )}

      {enlaceEnviado && (
        <div role="status" className="mt-6 flex gap-3 rounded-2xl border border-[#1F7A4D]/25 bg-[#1F7A4D]/5 p-4 text-sm text-tinta">
          <Icono nombre="check" className="mt-0.5 h-5 w-5 shrink-0 text-[#1F7A4D]" />
          <p>
            Tu mensaje está listo. Si WhatsApp no se abrió automáticamente,{' '}
            <a href={enlaceEnviado} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1F7A4D] underline underline-offset-2">
              abrilo desde aquí
            </a>
            . Recordá enviar el mensaje para que podamos responderte.
          </p>
        </div>
      )}
    </form>
  );
}
