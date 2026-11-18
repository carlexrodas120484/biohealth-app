import { Seo } from '@/components/layout/Seo';
import { Boton } from '@/components/ui/Boton';
import { Isotipo } from '@/components/ui/Logo';
import { Helmet } from 'react-helmet-async';

export default function NoEncontrada() {
  return (
    <>
      <Seo titulo="Página no encontrada" />
      <Helmet><meta name="robots" content="noindex" /></Helmet>
      <section className="flex min-h-[70vh] items-center bg-crema py-24">
        <div className="mx-auto max-w-xl px-5 text-center">
          <Isotipo className="mx-auto h-16 w-16" />
          <h1 className="mt-8 font-display text-5xl text-tinta">Página no encontrada</h1>
          <p className="mt-4 text-tinta-suave">La dirección que buscás no existe o fue actualizada.</p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Boton a="/">Volver al inicio</Boton>
            <Boton a="/agendar" variante="secundario">Solicitar turno</Boton>
          </div>
        </div>
      </section>
    </>
  );
}
