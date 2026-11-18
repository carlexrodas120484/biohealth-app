import { Link } from 'react-router-dom';
import { EncabezadoSeccion } from '@/components/ui/EncabezadoSeccion';
import { Imagen } from '@/components/ui/Imagen';
import { Revelar } from '@/components/ui/Revelar';
import { Boton } from '@/components/ui/Boton';
import { articulosPublicados, type Articulo } from '@/content/blog/articulos';
import { fechaCorta } from '@/lib/fechas';

export function TarjetaArticulo({ a, grande = false }: { a: Articulo; grande?: boolean }) {
  return (
    <article className="group flex h-full flex-col">
      <Link to={`/blog/${a.slug}`} className="block overflow-hidden rounded-[1.4rem]" tabIndex={-1} aria-hidden="true">
        <Imagen src={a.foto} alt="" className={`w-full transition duration-[1.2s] group-hover:scale-[1.04] ${grande ? 'aspect-[16/10]' : 'aspect-[16/11]'}`} />
      </Link>
      <div className="mt-6 flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-tinta-tenue">
        <span className="text-dorado-oscuro">{a.categoria}</span>
        <span className="h-px w-5 bg-linea" />
        <time dateTime={a.fecha}>{fechaCorta(a.fecha)}</time>
      </div>
      <h3 className={`mt-3 font-display font-medium leading-tight text-tinta ${grande ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}>
        <Link to={`/blog/${a.slug}`} className="transition hover:text-dorado-oscuro">{a.titulo}</Link>
      </h3>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-tinta-suave">{a.resumen}</p>
      <p className="mt-4 text-xs text-tinta-tenue">{a.lecturaMin} min de lectura</p>
    </article>
  );
}

export function Educacion() {
  const [principal, ...resto] = articulosPublicados();
  if (!principal) return null;
  return (
    <section id="educacion" aria-labelledby="titulo-educacion" className="seccion bg-white">
      <div className="contenedor">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <EncabezadoSeccion
            etiqueta="Educación en salud"
            titulo={<span id="titulo-educacion">Información clara para cuidarte mejor</span>}
            texto="Artículos de prevención y bienestar escritos por nuestro equipo. Informativos, nunca un reemplazo de la consulta."
          />
          <Boton a="/blog" variante="secundario" className="shrink-0">Ver todos los artículos</Boton>
        </div>
        <div className="mt-14 grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
          <Revelar><TarjetaArticulo a={principal} grande /></Revelar>
          <div className="grid gap-12">
            {resto.slice(0, 2).map((a, i) => (
              <Revelar key={a.slug} retardo={i * 90}><TarjetaArticulo a={a} /></Revelar>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
