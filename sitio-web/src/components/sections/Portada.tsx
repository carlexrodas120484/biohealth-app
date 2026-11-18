import { Boton } from '@/components/ui/Boton';
import { Imagen } from '@/components/ui/Imagen';
import { Icono } from '@/components/ui/Icono';
import { Isotipo } from '@/components/ui/Logo';
import { centro } from '@/config/centro';
import { desplazarA } from '@/lib/navegacion';

/** Fotografía principal: reemplazar por una foto propia del centro en /public/images/portada.jpg */
const FOTO_PORTADA =
  'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=1400&q=80';

export function Portada() {
  return (
    <section aria-labelledby="titulo-portada" className="relative overflow-hidden bg-crema">
      <div className="pointer-events-none absolute -left-40 top-10 h-[34rem] w-[34rem] rounded-full bg-dorado-wash/70 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 hidden h-full w-[46%] bg-beige lg:block" />

      <div className="relative mx-auto grid max-w-contenido items-center gap-14 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28 lg:pt-16">
        <div className="animate-aparecer">
          <div className="flex items-center gap-4">
            <Isotipo className="h-14 w-14" />
            <span className="hidden h-px w-16 bg-dorado/50 sm:block" />
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-tinta-suave">
              {centro.ubicacion.ciudad} · {centro.ubicacion.departamento} · {centro.ubicacion.pais}
            </span>
          </div>

          <h1 id="titulo-portada" className="mt-10">
            <span className="block font-display text-[3.4rem] font-medium leading-[0.95] tracking-[0.06em] text-tinta sm:text-7xl lg:text-[5.4rem]">
              BIOHEALTH
            </span>
            <span className="mt-3 block text-xs font-semibold uppercase tracking-[0.55em] text-dorado sm:text-sm">
              Medicina avanzada
            </span>
          </h1>

          <p className="mt-10 max-w-xl text-balance font-display text-[1.9rem] leading-snug text-tinta sm:text-[2.3rem]">
            “Una nueva forma de cuidar tu salud.”
          </p>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-tinta-suave sm:text-lg">
            Atención médica integral, personalizada y humana. Combinamos conocimiento médico, tecnología y
            acompañamiento profesional para cuidar tu bienestar.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Boton a="/agendar">
              <Icono nombre="calendario" className="h-4 w-4" />
              Agendar consulta
            </Boton>
            <Boton variante="secundario" onClick={() => desplazarA('servicios')}>
              Conocer nuestros servicios
            </Boton>
          </div>

          <ul className="mt-12 grid max-w-lg grid-cols-1 gap-3 border-t sm:grid-cols-3 sm:gap-4 border-linea pt-6 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-tinta-tenue">
            <li>Equipo <span className="text-tinta sm:block">multidisciplinario</span></li>
            <li>Estudios <span className="text-tinta sm:block">en el centro</span></li>
            <li>Turnos por <span className="text-tinta sm:block">WhatsApp</span></li>
          </ul>
        </div>

        <div className="relative animate-aparecer [animation-delay:150ms]">
          <div className="absolute -inset-3 translate-x-6 translate-y-6 rounded-[2.2rem] border border-dorado/40 sm:-inset-4" />
          <div className="relative overflow-hidden rounded-[2rem] shadow-elevada">
            <Imagen
              src={FOTO_PORTADA}
              alt="Consultorio médico luminoso y moderno"
              prioridad
              className="aspect-[4/3] w-full sm:aspect-square lg:aspect-[4/5]"
            />
                      </div>
          <div className="absolute -bottom-6 left-4 right-4 rounded-2xl border border-white/60 bg-white/90 p-5 shadow-elevada backdrop-blur sm:left-auto sm:right-[-1rem] sm:w-72">
            <div className="flex items-start gap-4">
              <span className="rounded-full bg-dorado-wash p-2.5 text-dorado-oscuro">
                <Icono nombre="escudo" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-tinta">Atención basada en evidencia</p>
                <p className="mt-1 text-xs leading-relaxed text-tinta-suave">
                  Cada indicación se explica con claridad y se acompaña con seguimiento.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
