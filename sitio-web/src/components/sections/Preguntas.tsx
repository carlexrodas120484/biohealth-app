import { useState } from 'react';
import { EncabezadoSeccion } from '@/components/ui/EncabezadoSeccion';
import { Icono } from '@/components/ui/Icono';
import { Boton } from '@/components/ui/Boton';
import { preguntasFrecuentes } from '@/config/contenido';
import { enlaceWhatsApp, mensajeConsultaGeneral } from '@/lib/whatsapp';

export function Preguntas() {
  const [abierta, setAbierta] = useState<number | null>(0);
  return (
    <section id="preguntas" aria-labelledby="titulo-preguntas" className="seccion bg-white">
      <div className="contenedor grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <EncabezadoSeccion
            etiqueta="Preguntas frecuentes"
            titulo={<span id="titulo-preguntas">Respuestas antes de tu visita</span>}
            texto="Si no encontrás lo que buscás, escribinos por WhatsApp y te orientamos."
          />
          <Boton variante="whatsapp" href={enlaceWhatsApp(mensajeConsultaGeneral())} className="mt-8">
            <Icono nombre="whatsapp" className="h-4 w-4" />
            Hacer una consulta
          </Boton>
        </div>

        <div className="divide-y divide-linea border-y border-linea">
          {preguntasFrecuentes.map((p, i) => {
            const abierto = abierta === i;
            return (
              <div key={p.pregunta}>
                <h3>
                  <button
                    id={`pregunta-${i}`}
                    aria-expanded={abierto}
                    aria-controls={`respuesta-${i}`}
                    onClick={() => setAbierta(abierto ? null : i)}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left"
                  >
                    <span>
                      <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-dorado-oscuro">{p.grupo}</span>
                      <span className="mt-1.5 block font-display text-[1.45rem] leading-snug text-tinta">{p.pregunta}</span>
                    </span>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition duration-300 ${abierto ? 'rotate-45 border-dorado bg-dorado text-tinta' : 'border-linea text-tinta'}`}>
                      <Icono nombre="mas" className="h-4 w-4" />
                    </span>
                  </button>
                </h3>
                <div
                  id={`respuesta-${i}`}
                  role="region"
                  aria-labelledby={`pregunta-${i}`}
                  className={`grid transition-all duration-500 ${abierto ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-2xl pb-7 pr-12 leading-relaxed text-tinta-suave">{p.respuesta}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Datos estructurados FAQPage para buscadores. */
export const esquemaPreguntas = () => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: preguntasFrecuentes.map((p) => ({
    '@type': 'Question',
    name: p.pregunta,
    acceptedAnswer: { '@type': 'Answer', text: p.respuesta },
  })),
});
