import { Seo } from '@/components/layout/Seo';
import { EncabezadoSeccion } from '@/components/ui/EncabezadoSeccion';
import { Revelar } from '@/components/ui/Revelar';
import { TarjetaArticulo } from '@/components/sections/Educacion';
import { articulosPublicados } from '@/content/blog/articulos';
import { LlamadoAccion } from '@/components/sections/LlamadoAccion';

export default function Blog() {
  const lista = articulosPublicados();
  return (
    <>
      <Seo titulo="Educación en salud" ruta="/blog" descripcion="Artículos de prevención, bienestar y salud escritos por el equipo de BioHealth, Ayolas, Misiones." />
      <section className="bg-crema pb-24 pt-14 sm:pt-20">
        <div className="contenedor">
          <EncabezadoSeccion
            as="h1"
            etiqueta="Educación en salud"
            titulo="Blog BioHealth"
            texto="Contenidos informativos de prevención y bienestar. No reemplazan la consulta con un profesional."
          />
          <div className="mt-16 grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((a, i) => (
              <Revelar key={a.slug} retardo={(i % 3) * 80}><TarjetaArticulo a={a} /></Revelar>
            ))}
          </div>
        </div>
      </section>
      <LlamadoAccion />
    </>
  );
}
