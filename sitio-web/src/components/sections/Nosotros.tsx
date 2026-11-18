import { EncabezadoSeccion } from '@/components/ui/EncabezadoSeccion';
import { Revelar } from '@/components/ui/Revelar';
import { Imagen } from '@/components/ui/Imagen';
import { Icono } from '@/components/ui/Icono';
import { sobre, motivos } from '@/config/contenido';

const FOTO_NOSOTROS =
  'https://images.unsplash.com/photo-1666214280557-f1b5022eb634?auto=format&fit=crop&w=1200&q=75';

export function Nosotros() {
  return (
    <section id="nosotros" aria-labelledby="titulo-nosotros" className="seccion bg-crema">
      <div className="contenedor grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <Revelar className="relative order-2 lg:order-1">
          <div className="relative overflow-hidden rounded-[2rem]">
            <Imagen src={FOTO_NOSOTROS} alt="Profesional de la salud conversando con un paciente" className="aspect-[5/6] w-full" />
          </div>
          <div className="absolute -right-4 bottom-10 hidden max-w-[15rem] rounded-2xl bg-tinta p-6 text-white shadow-elevada sm:block lg:-right-10">
            <Icono nombre="hoja" className="h-6 w-6 text-dorado-claro" />
            <p className="mt-4 font-display text-xl leading-snug">Cuerpo, mente y entorno: una sola mirada.</p>
          </div>
        </Revelar>

        <div className="order-1 lg:order-2">
          <EncabezadoSeccion
            etiqueta="Sobre BioHealth"
            titulo={<span id="titulo-nosotros">{sobre.titulo}</span>}
            texto={sobre.introduccion}
          />
          <div className="mt-10 space-y-0 divide-y divide-linea border-y border-linea">
            {sobre.pilares.map((p, i) => (
              <Revelar key={p.titulo} retardo={i * 80}>
                <div className="grid gap-2 py-6 sm:grid-cols-[9rem_1fr] sm:gap-6">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-dorado-oscuro">{p.titulo}</h3>
                  <p className="text-[0.96rem] leading-relaxed text-tinta-suave">{p.texto}</p>
                </div>
              </Revelar>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PorQueElegirnos() {
  return (
    <section aria-labelledby="titulo-motivos" className="seccion relative overflow-hidden bg-tinta">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full border border-dorado/15" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-[30rem] w-[30rem] rounded-full border border-dorado/10" />
      <div className="contenedor relative">
        <EncabezadoSeccion
          claro
          etiqueta="Por qué elegirnos"
          titulo={<span id="titulo-motivos">Un cuidado médico pensado alrededor de vos</span>}
        />
        <div className="mt-14 grid gap-px overflow-hidden rounded-[1.6rem] bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {motivos.map((m, i) => (
            <Revelar key={m.titulo} retardo={i * 90} className="h-full">
              <div className="h-full bg-tinta p-8 transition duration-500 hover:bg-[#33302b]">
                <span className="font-display text-sm text-dorado-claro">0{i + 1}</span>
                <Icono nombre={m.icono} className="mt-6 h-9 w-9 text-dorado-claro" />
                <h3 className="mt-6 font-display text-2xl text-white">{m.titulo}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/65">{m.texto}</p>
              </div>
            </Revelar>
          ))}
        </div>
      </div>
    </section>
  );
}
