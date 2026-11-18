import { EncabezadoSeccion } from '@/components/ui/EncabezadoSeccion';
import { Icono } from '@/components/ui/Icono';
import { FormularioTurno } from './FormularioTurno';

const pasos = [
  { t: 'Elegí especialidad y profesional', d: 'Podés indicar preferencia o dejar que el centro asigne.' },
  { t: 'Indicá fecha y horario', d: 'Es tu preferencia; la confirmamos según disponibilidad.' },
  { t: 'Enviá el mensaje por WhatsApp', d: 'Te respondemos para confirmar tu turno.' },
];

export function Agendar({ servicioInicial, profesionalInicial, comoPagina = false }: { servicioInicial?: string; profesionalInicial?: string; comoPagina?: boolean }) {
  return (
    <section id="agendar" aria-labelledby="titulo-agendar" className={`relative bg-crema ${comoPagina ? 'pb-24 pt-14 sm:pt-20' : 'seccion'}`}>
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[38%] bg-beige lg:block" />
      <div className="contenedor relative grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="lg:pt-6">
          <EncabezadoSeccion
            as={comoPagina ? 'h1' : 'h2'}
            etiqueta="Agendamiento"
            titulo={<span id="titulo-agendar">Solicitá tu turno en menos de un minuto</span>}
            texto="Completá tus preferencias y enviá la solicitud por WhatsApp. Nuestro equipo te responderá para confirmar."
          />
          <ol className="mt-10 space-y-6">
            {pasos.map((p, i) => (
              <li key={p.t} className="flex gap-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dorado/50 font-display text-lg text-dorado-oscuro">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-tinta">{p.t}</p>
                  <p className="mt-1 text-sm text-tinta-suave">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-10 flex items-center gap-3 text-sm text-tinta-suave">
            <Icono nombre="info" className="h-5 w-5 text-dorado-oscuro" />
            Ante una urgencia, acudí al servicio de emergencias más cercano.
          </p>
        </div>
        <FormularioTurno servicioInicial={servicioInicial} profesionalInicial={profesionalInicial} />
      </div>
    </section>
  );
}
