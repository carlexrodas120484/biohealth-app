import { EncabezadoSeccion } from '@/components/ui/EncabezadoSeccion';
import { Icono } from '@/components/ui/Icono';
import { Boton } from '@/components/ui/Boton';
import { centro } from '@/config/centro';
import { enlaceWhatsApp, mensajeConsultaGeneral } from '@/lib/whatsapp';
import { registrarConversion } from '@/lib/analitica';

export function Contacto() {
  const u = centro.ubicacion;
  const urlMapa = `https://www.google.com/maps?q=${encodeURIComponent(u.consultaMapa)}&output=embed`;
  const enlaceMapa = u.enlaceMapa || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(u.consultaMapa)}`;

  const filas = [
    { icono: 'ubicacion', titulo: 'Ubicación', valor: <>{u.direccion && <>{u.direccion}<br /></>}{u.ciudad}, {u.departamento}<br />{u.pais}</> },
    {
      icono: 'reloj',
      titulo: 'Horarios',
      valor: (
        <>{centro.horarioGeneral.map((h) => <span key={h.dias} className="block">{h.dias}: {h.horas}</span>)}</>
      ),
    },
    {
      icono: 'whatsapp',
      titulo: 'WhatsApp',
      valor: centro.contacto.telefonoVisible || 'Turnos y consultas por mensaje',
    },
    {
      icono: 'instagram',
      titulo: 'Instagram',
      valor: <a href={centro.redes.instagram.url} target="_blank" rel="noopener noreferrer" className="hover:text-dorado-oscuro">@{centro.redes.instagram.usuario}</a>,
    },
    ...(centro.contacto.email
      ? [{ icono: 'correo', titulo: 'Correo', valor: <a href={`mailto:${centro.contacto.email}`} className="hover:text-dorado-oscuro">{centro.contacto.email}</a> }]
      : []),
  ];

  return (
    <section id="contacto" aria-labelledby="titulo-contacto" className="seccion bg-crema">
      <div className="contenedor grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <EncabezadoSeccion
            etiqueta="Contacto"
            titulo={<span id="titulo-contacto">Te esperamos en Ayolas</span>}
            texto="Atención para pacientes de Ayolas y de todo el departamento de Misiones."
          />
          <dl className="mt-10 grid gap-7 sm:grid-cols-2">
            {filas.map((f) => (
              <div key={f.titulo} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-dorado-oscuro shadow-suave">
                  <Icono nombre={f.icono} className="h-5 w-5" />
                </span>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-tinta-tenue">{f.titulo}</dt>
                  <dd className="mt-1.5 text-[0.95rem] leading-relaxed text-tinta">{f.valor}</dd>
                </div>
              </div>
            ))}
          </dl>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Boton variante="whatsapp" href={enlaceWhatsApp(mensajeConsultaGeneral())} onClick={() => registrarConversion('whatsapp_contacto')}>
              <Icono nombre="whatsapp" className="h-4 w-4" />
              Escribir por WhatsApp
            </Boton>
            <Boton variante="secundario" href={enlaceMapa}>
              <Icono nombre="ubicacion" className="h-4 w-4" />
              Cómo llegar
            </Boton>
          </div>
        </div>

        <div className="relative min-h-[22rem] overflow-hidden rounded-[2rem] border border-linea bg-beige shadow-suave lg:min-h-full">
          {(
            <iframe
              title={`Mapa de ubicación de ${centro.nombreCompleto}`}
              src={urlMapa}
              className="absolute inset-0 z-10 h-full w-full border-0 grayscale-[35%]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          )}
          {(
            <a
              href={enlaceMapa}
              target="_blank"
              rel="noopener noreferrer"
              className="group absolute inset-0 -z-0 flex flex-col items-center justify-center gap-4 p-8 text-center"
              aria-label="Abrir ubicación en Google Maps"
            >
              <svg className="absolute inset-0 h-full w-full opacity-[0.35]" aria-hidden="true">
                <defs>
                  <pattern id="cuadricula" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M40 0H0v40" fill="none" stroke="#C99624" strokeWidth="0.4" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#cuadricula)" />
                <path d="M-20 260 C 120 200, 220 320, 380 230 S 640 180, 900 260" stroke="#C99624" strokeWidth="1.2" fill="none" opacity=".6" />
              </svg>
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-dorado text-white shadow-elevada transition group-hover:scale-105">
                <Icono nombre="ubicacion" className="h-7 w-7" />
              </span>
              <span className="relative font-display text-2xl text-tinta">{u.ciudad}, {u.departamento}</span>
              <span className="relative text-xs font-semibold uppercase tracking-[0.18em] text-dorado-oscuro">Ver mapa de Google</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
