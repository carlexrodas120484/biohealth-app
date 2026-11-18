import { useEffect } from 'react';
import { Boton } from '@/components/ui/Boton';
import { Icono } from '@/components/ui/Icono';
import { Isotipo } from '@/components/ui/Logo';
import { centro } from '@/config/centro';

declare global {
  interface Window { instgrm?: { Embeds: { process: () => void } } }
}

/**
 * Integración con Instagram. Si se cargan enlaces en `centro.publicacionesInstagram`
 * se incrustan las publicaciones oficiales; si no, se muestra una tarjeta de perfil.
 */
export function Instagram() {
  const posts = centro.publicacionesInstagram;
  const ig = centro.redes.instagram;

  useEffect(() => {
    if (posts.length === 0) return;
    if (window.instgrm) return window.instgrm.Embeds.process();
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.instagram.com/embed.js';
    document.body.appendChild(s);
  }, [posts.length]);

  return (
    <section aria-labelledby="titulo-instagram" className="bg-crema py-20 sm:py-24">
      <div className="contenedor">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-beige via-crema to-dorado-wash p-8 sm:p-14">
          <Isotipo className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 opacity-[0.12]" />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="etiqueta"><Icono nombre="instagram" className="h-4 w-4" /> Instagram</p>
              <h2 id="titulo-instagram" className="mt-4 font-display text-4xl font-medium leading-tight text-tinta sm:text-5xl">
                Seguinos en @{ig.usuario}
              </h2>
              <p className="mt-4 text-tinta-suave">
                Novedades del centro, consejos de prevención y contenidos de educación en salud.
              </p>
            </div>
            <Boton href={ig.url} className="shrink-0">
              <Icono nombre="instagram" className="h-4 w-4" />
              Ver perfil
            </Boton>
          </div>

          {posts.length > 0 && (
            <div className="relative mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.slice(0, 3).map((url) => (
                <blockquote key={url} className="instagram-media !m-0 !min-w-0 !max-w-none !rounded-2xl" data-instgrm-permalink={url} data-instgrm-version="14">
                  <a href={url} target="_blank" rel="noopener noreferrer">Ver publicación en Instagram</a>
                </blockquote>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
