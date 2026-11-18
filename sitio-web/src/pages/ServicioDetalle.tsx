import { Link, useParams } from 'react-router-dom';
import { Seo } from '@/components/layout/Seo';
import { Imagen } from '@/components/ui/Imagen';
import { Icono } from '@/components/ui/Icono';
import { Boton } from '@/components/ui/Boton';
import { categorias, servicioPorId, servicios } from '@/config/servicios';
import { profesionalesActivos, nombreCompleto } from '@/config/profesionales';
import { enlaceWhatsApp, mensajeServicio } from '@/lib/whatsapp';
import { urlCanonica } from '@/lib/seo';
import { centro } from '@/config/centro';
import { TarjetaServicio } from '@/components/sections/TarjetaServicio';
import NoEncontrada from './NoEncontrada';

export default function ServicioDetalle() {
  const { id = '' } = useParams();
  const s = servicioPorId(id);
  if (!s) return <NoEncontrada />;

  const equipo = profesionalesActivos().filter((p) => p.servicios.includes(s.id));
  const relacionados = servicios.filter((x) => x.id !== s.id && x.categoria === s.categoria).slice(0, 3);
  const esquema = {
    '@context': 'https://schema.org',
    '@type': s.categoria === 'estudio' ? 'MedicalTest' : 'MedicalWebPage',
    name: `${s.nombre} en ${centro.ubicacion.ciudad}`,
    description: s.resumen,
    url: urlCanonica(`/servicios/${s.id}`),
    about: { '@type': 'MedicalSpecialty', name: s.nombre },
    provider: { '@id': urlCanonica('/#centro') },
  };

  return (
    <>
      <Seo
        titulo={`${s.nombre} en Ayolas, Misiones`}
        ruta={`/servicios/${s.id}`}
        descripcion={`${s.resumen} ${centro.nombreCompleto}, Ayolas, Misiones, Paraguay.`}
        esquema={esquema}
      />
      <section className="bg-crema pb-20 pt-10 sm:pt-14">
        <div className="contenedor">
          <nav aria-label="Ruta de navegación" className="text-xs text-tinta-tenue">
            <Link to="/" className="hover:text-tinta">Inicio</Link> <span className="mx-2">/</span>
            <span>Servicios</span> <span className="mx-2">/</span>
            <span className="text-tinta">{s.nombre}</span>
          </nav>

          <div className="mt-10 grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div>
              <p className="etiqueta">{categorias[s.categoria]}</p>
              <h1 className="mt-4 font-display text-5xl font-medium leading-[1.04] text-tinta sm:text-6xl">{s.nombre}</h1>
              <p className="mt-6 text-xl leading-relaxed text-tinta-suave">{s.resumen}</p>
              <div className="mt-8 space-y-5 leading-relaxed text-tinta-suave">
                {s.descripcion.map((p) => <p key={p}>{p}</p>)}
              </div>

              {s.aviso && (
                <div className="mt-8 flex gap-4 rounded-2xl border border-dorado/30 bg-dorado-wash/60 p-5 text-sm leading-relaxed text-tinta">
                  <Icono nombre="info" className="mt-0.5 h-5 w-5 shrink-0 text-dorado-oscuro" />
                  <p><strong className="font-semibold">Aclaración importante.</strong> {s.aviso}</p>
                </div>
              )}

              <ul className="mt-10 grid gap-3 sm:grid-cols-2">
                {s.puntos.map((p) => (
                  <li key={p} className="flex items-start gap-3 rounded-2xl border border-linea bg-white p-4 text-sm text-tinta">
                    <Icono nombre="check" className="mt-0.5 h-4 w-4 shrink-0 text-dorado-oscuro" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            <aside className="lg:sticky lg:top-28">
              <div className="overflow-hidden rounded-[1.8rem] border border-linea bg-white shadow-elevada">
                <Imagen src={s.foto} alt={s.nombre} prioridad className="aspect-[16/11] w-full" />
                <div className="p-7 sm:p-8">
                  <h2 className="font-display text-2xl text-tinta">Solicitá tu consulta</h2>
                  {equipo.length > 0 ? (
                    <p className="mt-2 text-sm text-tinta-suave">
                      Atiende: {equipo.map((p) => `${nombreCompleto(p)}`).join(', ')}.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-tinta-suave">Te indicaremos el profesional y los horarios disponibles.</p>
                  )}
                  <div className="mt-6 flex flex-col gap-3">
                    <Boton a={`/agendar?servicio=${s.id}`} className="w-full">
                      <Icono nombre="calendario" className="h-4 w-4" />
                      Solicitar consulta
                    </Boton>
                    <Boton variante="secundario" href={enlaceWhatsApp(mensajeServicio(s.nombre))} className="w-full">
                      <Icono nombre="whatsapp" className="h-4 w-4" />
                      Hacer una pregunta
                    </Boton>
                  </div>
                  <p className="mt-5 text-xs leading-relaxed text-tinta-tenue">Turno sujeto a confirmación por parte del centro.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {relacionados.length > 0 && (
        <section className="bg-white py-20">
          <div className="contenedor">
            <h2 className="font-display text-4xl text-tinta">También te puede interesar</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relacionados.map((r) => <TarjetaServicio key={r.id} servicio={r} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
