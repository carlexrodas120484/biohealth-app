import { Boton } from '@/components/ui/Boton';
import { EncabezadoSeccion } from '@/components/ui/EncabezadoSeccion';
import { Icono } from '@/components/ui/Icono';
import { Imagen } from '@/components/ui/Imagen';
import { Revelar } from '@/components/ui/Revelar';
import { profesionalesActivos, nombreCompleto, type Profesional } from '@/config/profesionales';
import { enlaceWhatsApp } from '@/lib/whatsapp';
import { centro } from '@/config/centro';

function Monograma({ p }: { p: Profesional }) {
  const iniciales = p.nombre.split(' ').map((x) => x[0]).slice(0, 2).join('');
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-beige to-dorado-wash">
      <div className="absolute inset-6 rounded-full border border-dorado/25" />
      <span className="font-display text-7xl font-medium tracking-wider text-dorado-oscuro/80">{iniciales}</span>
    </div>
  );
}

function Horarios({ p, claro = false }: { p: Profesional; claro?: boolean }) {
  return (
    <ul className="space-y-2">
      {p.horarios.map((h) => (
        <li key={h.dias + h.horas} className={`flex items-center gap-3 text-sm ${claro ? 'text-tinta-suave' : 'text-tinta-suave'}`}>
          <Icono nombre="reloj" className="h-4 w-4 shrink-0 text-dorado" />
          <span className="font-medium text-tinta">{h.dias}:</span> {h.horas}
        </li>
      ))}
    </ul>
  );
}

function TarjetaDestacada({ p }: { p: Profesional }) {
  return (
    <article className="grid overflow-hidden rounded-[2rem] border border-linea bg-white shadow-suave md:grid-cols-[0.9fr_1.1fr]">
      <div className="relative aspect-[4/5] md:aspect-auto md:min-h-[30rem]">
        {p.foto ? <Imagen src={p.foto} alt={`Fotografía de ${nombreCompleto(p)}`} className="h-full w-full" /> : <Monograma p={p} />}
        <span className="absolute left-5 top-5 rounded-full bg-tinta px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white">
          Equipo BioHealth
        </span>
      </div>
      <div className="flex flex-col justify-center p-8 sm:p-12">
        <p className="etiqueta">Profesional destacado</p>
        <h3 className="mt-4 font-display text-5xl font-medium leading-none text-tinta">{nombreCompleto(p)}</h3>
        <p className="mt-4 text-lg text-dorado-oscuro">{p.especialidad}</p>
        {p.registro && <p className="mt-2 text-xs uppercase tracking-[0.16em] text-tinta-tenue">{p.registro}</p>}
        {p.bio && <p className="mt-6 leading-relaxed text-tinta-suave">{p.bio}</p>}
        <div className="mt-8 border-t border-linea pt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-tinta-tenue">Horarios de atención</p>
          <Horarios p={p} />
        </div>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Boton a={`/agendar?profesional=${p.id}`}>
            <Icono nombre="calendario" className="h-4 w-4" />
            Agendar con {p.titulo} {p.nombre.split(' ')[0]}
          </Boton>
        </div>
      </div>
    </article>
  );
}

function TarjetaProfesional({ p }: { p: Profesional }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-linea bg-white shadow-suave">
      <div className="aspect-[4/4]">
        {p.foto ? <Imagen src={p.foto} alt={`Fotografía de ${nombreCompleto(p)}`} className="h-full w-full" /> : <Monograma p={p} />}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-2xl text-tinta">{nombreCompleto(p)}</h3>
        <p className="mt-1 text-sm text-dorado-oscuro">{p.especialidad}</p>
        <div className="mt-5 flex-1"><Horarios p={p} /></div>
        <Boton a={`/agendar?profesional=${p.id}`} variante="secundario" className="mt-6 w-full !py-3">
          Agendar turno
        </Boton>
      </div>
    </article>
  );
}

export function Equipo() {
  const lista = profesionalesActivos();
  const destacados = lista.filter((p) => p.destacado);
  const resto = lista.filter((p) => !p.destacado);

  return (
    <section id="profesionales" aria-labelledby="titulo-equipo" className="seccion bg-beige/60">
      <div className="contenedor">
        <EncabezadoSeccion
          centrado
          etiqueta="Equipo médico"
          titulo={<span id="titulo-equipo">Nuestros profesionales</span>}
          texto="Profesionales comprometidos con una atención cercana, actualizada y coordinada entre especialidades."
        />

        <div className="mt-14 space-y-8">
          {destacados.map((p) => (
            <Revelar key={p.id}><TarjetaDestacada p={p} /></Revelar>
          ))}

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {resto.map((p, i) => (
              <Revelar key={p.id} retardo={i * 80} className="h-full"><TarjetaProfesional p={p} /></Revelar>
            ))}
            <Revelar className="h-full sm:col-span-2 lg:col-span-3">
              <div className="flex h-full flex-col items-start justify-between gap-6 rounded-[1.4rem] border border-dashed border-dorado/40 bg-white/60 p-8 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-display text-2xl text-tinta">Más especialidades en el centro</h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-tinta-suave">
                    Para Ginecología, Cardiología, Psiquiatría, Psicología, Nutrición y estudios, consultanos por los profesionales
                    y horarios disponibles.
                  </p>
                </div>
                <Boton
                  variante="whatsapp"
                  href={enlaceWhatsApp(`Hola, ${centro.nombre}. Quisiera conocer los profesionales y horarios disponibles.`)}
                  className="shrink-0"
                >
                  <Icono nombre="whatsapp" className="h-4 w-4" />
                  Consultar disponibilidad
                </Boton>
              </div>
            </Revelar>
          </div>
        </div>
      </div>
    </section>
  );
}
