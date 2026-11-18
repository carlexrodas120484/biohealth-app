import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { Icono } from '@/components/ui/Icono';
import { centro } from '@/config/centro';
import { servicios } from '@/config/servicios';
import { SECCIONES, useIrASeccion } from '@/lib/navegacion';
import { enlaceWhatsApp, mensajeConsultaGeneral } from '@/lib/whatsapp';

export function Pie() {
  const ir = useIrASeccion();
  const u = centro.ubicacion;
  const anio = new Date().getFullYear();

  return (
    <footer className="bg-tinta text-white/70">
      <div className="mx-auto grid max-w-contenido gap-12 px-5 py-16 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo claro />
          <p className="mt-6 max-w-xs text-sm leading-relaxed">{centro.descripcionCorta}</p>
          <div className="mt-6 flex gap-3">
            <a
              href={centro.redes.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Instagram @${centro.redes.instagram.usuario}`}
              className="rounded-full border border-white/15 p-2.5 transition hover:border-dorado hover:text-dorado-claro"
            >
              <Icono nombre="instagram" />
            </a>
            {centro.redes.facebook && (
              <a href={centro.redes.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="rounded-full border border-white/15 p-2.5 transition hover:border-dorado hover:text-dorado-claro">
                <Icono nombre="facebook" />
              </a>
            )}
            <a
              href={enlaceWhatsApp(mensajeConsultaGeneral())}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="rounded-full border border-white/15 p-2.5 transition hover:border-dorado hover:text-dorado-claro"
            >
              <Icono nombre="whatsapp" />
            </a>
          </div>
        </div>

        <div>
          <h2 className="titulo-pie">Especialidades</h2>
          <ul className="mt-5 space-y-2.5 text-sm">
            {servicios.filter((s) => s.categoria === 'consulta').slice(0, 6).map((s) => (
              <li key={s.id}>
                <Link to={`/servicios/${s.id}`} className="transition hover:text-white">{s.nombre}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="titulo-pie">Navegación</h2>
          <ul className="mt-5 space-y-2.5 text-sm">
            {SECCIONES.map((s) => (
              <li key={s.id}>
                <button onClick={() => ir(s.id)} className="transition hover:text-white">{s.etiqueta}</button>
              </li>
            ))}
            <li><Link to="/blog" className="transition hover:text-white">Blog</Link></li>
            <li><Link to="/agendar" className="transition hover:text-white">Solicitar turno</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="titulo-pie">Contacto</h2>
          <ul className="mt-5 space-y-3 text-sm">
            <li className="flex gap-3">
              <Icono nombre="ubicacion" className="mt-0.5 h-4 w-4 shrink-0 text-dorado-claro" />
              <span>{u.direccion && <>{u.direccion}<br /></>}{u.ciudad}, {u.departamento}, {u.pais}</span>
            </li>
            {centro.contacto.telefonoVisible && (
              <li className="flex gap-3">
                <Icono nombre="telefono" className="mt-0.5 h-4 w-4 shrink-0 text-dorado-claro" />
                {centro.contacto.telefonoVisible}
              </li>
            )}
            {centro.contacto.email && (
              <li className="flex gap-3">
                <Icono nombre="correo" className="mt-0.5 h-4 w-4 shrink-0 text-dorado-claro" />
                <a href={`mailto:${centro.contacto.email}`} className="hover:text-white">{centro.contacto.email}</a>
              </li>
            )}
            <li className="flex gap-3">
              <Icono nombre="instagram" className="mt-0.5 h-4 w-4 shrink-0 text-dorado-claro" />
              @{centro.redes.instagram.usuario}
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-contenido flex-col gap-3 px-5 py-6 text-xs text-white/45 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p>© {anio} {centro.nombreCompleto}. Todos los derechos reservados.</p>
          <p className="max-w-xl md:text-right">
            La información de este sitio es orientativa y no reemplaza la consulta médica. Ante una emergencia, acudí al servicio de urgencias más cercano.
            {' '}<Link to="/privacidad" className="underline underline-offset-2 hover:text-white">Privacidad</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
