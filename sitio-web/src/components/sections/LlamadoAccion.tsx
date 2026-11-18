import { Boton } from '@/components/ui/Boton';
import { Icono } from '@/components/ui/Icono';
import { enlaceWhatsApp, mensajeConsultaGeneral } from '@/lib/whatsapp';

export function LlamadoAccion({ titulo = 'Tu salud merece una atención dedicada', texto = 'Solicitá tu turno hoy. Te respondemos por WhatsApp para coordinar día y horario.' }: { titulo?: string; texto?: string }) {
  return (
    <section aria-label="Agendar consulta" className="bg-crema px-5 pb-20 sm:px-8 sm:pb-24">
      <div className="relative mx-auto max-w-contenido overflow-hidden rounded-[2rem] bg-dorado px-8 py-14 text-center text-tinta sm:px-16 sm:py-20">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full border border-tinta/15" />
        <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full border border-tinta/10" />
        <h2 className="relative mx-auto max-w-3xl font-display text-4xl font-medium leading-tight sm:text-5xl">{titulo}</h2>
        <p className="relative mx-auto mt-5 max-w-xl text-tinta/80">{texto}</p>
        <div className="relative mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Boton a="/agendar" className="!bg-tinta !text-white !shadow-none hover:!bg-white hover:!text-tinta">
            <Icono nombre="calendario" className="h-4 w-4" />
            Agendar consulta
          </Boton>
          <Boton variante="secundario" className="!bg-transparent !border-tinta/30 hover:!border-tinta hover:!text-tinta" href={enlaceWhatsApp(mensajeConsultaGeneral())}>
            <Icono nombre="whatsapp" className="h-4 w-4" />
            Escribir por WhatsApp
          </Boton>
        </div>
      </div>
    </section>
  );
}
