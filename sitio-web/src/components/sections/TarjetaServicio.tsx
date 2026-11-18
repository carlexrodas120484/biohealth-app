import { Link } from 'react-router-dom';
import { Imagen } from '@/components/ui/Imagen';
import { Icono } from '@/components/ui/Icono';
import { categorias, type Servicio } from '@/config/servicios';

export function TarjetaServicio({ servicio }: { servicio: Servicio }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-linea bg-white shadow-suave transition duration-500 hover:-translate-y-1 hover:shadow-elevada">
      <Link to={`/servicios/${servicio.id}`} className="relative block overflow-hidden" tabIndex={-1} aria-hidden="true">
        <Imagen
          src={servicio.foto}
          alt=""
          className="aspect-[16/11] w-full transition duration-[1.2s] group-hover:scale-[1.04]"
          sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
        />
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-tinta-suave backdrop-blur">
          {categorias[servicio.categoria]}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <h3 className="font-display text-[1.7rem] font-medium leading-tight text-tinta">
          <Link to={`/servicios/${servicio.id}`} className="hover:text-dorado-oscuro">{servicio.nombre}</Link>
        </h3>
        <p className="mt-3 flex-1 text-[0.95rem] leading-relaxed text-tinta-suave">{servicio.resumen}</p>
        {servicio.aviso && (
          <p className="mt-4 flex gap-2 rounded-xl bg-beige/70 p-3 text-xs leading-relaxed text-tinta-suave">
            <Icono nombre="info" className="mt-0.5 h-4 w-4 shrink-0 text-dorado-oscuro" />
            No es un diagnóstico clínico validado.
          </p>
        )}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-linea pt-5">
          <Link
            to={`/servicios/${servicio.id}`}
            className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.16em] text-tinta-suave transition hover:text-tinta"
          >
            Ver detalle
          </Link>
          <Link
            to={`/agendar?servicio=${servicio.id}`}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-dorado-wash px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-dorado-oscuro transition hover:bg-dorado hover:text-tinta"
            aria-label={`Solicitar consulta de ${servicio.nombre}`}
          >
            Solicitar consulta
            <Icono nombre="flecha" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
