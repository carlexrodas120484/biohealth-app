import { Link, useParams } from 'react-router-dom';
import { Seo } from '@/components/layout/Seo';
import { Imagen } from '@/components/ui/Imagen';
import { Icono } from '@/components/ui/Icono';
import { articulosPublicados, type Bloque } from '@/content/blog/articulos';
import { fechaCorta } from '@/lib/fechas';
import { urlCanonica } from '@/lib/seo';
import { centro } from '@/config/centro';
import { LlamadoAccion } from '@/components/sections/LlamadoAccion';
import { TarjetaArticulo } from '@/components/sections/Educacion';
import NoEncontrada from './NoEncontrada';

function Contenido({ b }: { b: Bloque }) {
  switch (b.tipo) {
    case 'h2':
      return <h2 className="mt-12 font-display text-3xl font-medium text-tinta">{b.texto}</h2>;
    case 'lista':
      return (
        <ul className="mt-6 space-y-3">
          {b.items.map((i) => (
            <li key={i} className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-dorado" />{i}</li>
          ))}
        </ul>
      );
    case 'nota':
      return (
        <aside className="mt-10 flex gap-4 rounded-2xl border border-dorado/30 bg-dorado-wash/50 p-5 text-[0.95rem]">
          <Icono nombre="info" className="mt-0.5 h-5 w-5 shrink-0 text-dorado-oscuro" />
          <p>{b.texto}</p>
        </aside>
      );
    default:
      return <p className="mt-6">{b.texto}</p>;
  }
}

export default function Articulo() {
  const { slug = '' } = useParams();
  const todos = articulosPublicados();
  const a = todos.find((x) => x.slug === slug);
  if (!a) return <NoEncontrada />;
  const otros = todos.filter((x) => x.slug !== slug).slice(0, 2);

  const esquema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.titulo,
    description: a.resumen,
    datePublished: a.fecha,
    author: { '@type': 'Organization', name: a.autor },
    publisher: { '@type': 'Organization', name: centro.nombreCompleto },
    image: a.foto,
    mainEntityOfPage: urlCanonica(`/blog/${a.slug}`),
  };

  return (
    <>
      <Seo titulo={a.titulo} descripcion={a.resumen} ruta={`/blog/${a.slug}`} imagen={a.foto} tipo="article" esquema={esquema} />
      <article className="bg-crema pb-20 pt-10 sm:pt-14">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <Link to="/blog" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-tinta-suave hover:text-tinta">
            <Icono nombre="flechaIzq" className="h-4 w-4" /> Educación en salud
          </Link>
          <p className="mt-10 flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-tinta-tenue">
            <span className="text-dorado-oscuro">{a.categoria}</span>
            <span className="h-px w-5 bg-linea" />
            <time dateTime={a.fecha}>{fechaCorta(a.fecha)}</time>
            <span className="h-px w-5 bg-linea" />
            {a.lecturaMin} min
          </p>
          <h1 className="mt-5 font-display text-4xl font-medium leading-[1.08] text-tinta sm:text-[3.4rem]">{a.titulo}</h1>
          <p className="mt-6 text-xl leading-relaxed text-tinta-suave">{a.resumen}</p>
          <p className="mt-6 text-sm text-tinta-tenue">Por {a.autor}</p>
        </div>
        <div className="mx-auto mt-12 max-w-5xl px-5 sm:px-8">
          <Imagen src={a.foto} alt="" prioridad className="aspect-[16/8] w-full rounded-[1.8rem]" />
        </div>
        <div className="mx-auto max-w-3xl px-5 text-[1.07rem] leading-[1.85] text-tinta-suave sm:px-8">
          {a.contenido.map((b, i) => <Contenido key={i} b={b} />)}
        </div>
      </article>
      {otros.length > 0 && (
        <section className="bg-white py-20">
          <div className="contenedor">
            <h2 className="font-display text-4xl text-tinta">Seguí leyendo</h2>
            <div className="mt-10 grid gap-12 md:grid-cols-2">
              {otros.map((o) => <TarjetaArticulo key={o.slug} a={o} />)}
            </div>
          </div>
        </section>
      )}
      <LlamadoAccion />
    </>
  );
}
