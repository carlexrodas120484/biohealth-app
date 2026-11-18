import { Seo } from '@/components/layout/Seo';
import { centro } from '@/config/centro';

export default function Privacidad() {
  const analitica = centro.analitica.googleAnalyticsId || centro.analitica.metaPixelId;
  return (
    <>
      <Seo titulo="Aviso de privacidad" ruta="/privacidad" />
      <section className="bg-crema pb-24 pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl space-y-6 px-5 leading-relaxed text-tinta-suave sm:px-8">
          <p className="etiqueta">Información legal</p>
          <h1 className="font-display text-5xl font-medium text-tinta">Aviso de privacidad</h1>
          <p>
            En {centro.nombreCompleto} cuidamos tu información. Este sitio web es informativo y no cuenta con
            formularios que almacenen datos personales ni información médica.
          </p>
          <h2 className="pt-4 font-display text-3xl text-tinta">Solicitudes de turno</h2>
          <p>
            Al solicitar un turno, el sitio solo arma un mensaje con tu nombre, la especialidad, el profesional, la fecha y el
            horario preferidos, y lo abre en WhatsApp para que vos decidas enviarlo. Esos datos no se guardan en este sitio.
            La comunicación posterior se rige por las condiciones de WhatsApp.
          </p>
          <p>
            Te pedimos no enviar información clínica sensible por mensaje: la evaluamos de forma reservada durante la consulta.
          </p>
          <h2 className="pt-4 font-display text-3xl text-tinta">Medición del sitio</h2>
          <p>
            {analitica
              ? 'Utilizamos herramientas de medición (Google Analytics y/o Meta Pixel) para conocer de forma agregada cómo se usa el sitio y mejorar la comunicación. Estas herramientas pueden utilizar cookies.'
              : 'Actualmente este sitio no utiliza herramientas de medición de terceros.'}
          </p>
          <h2 className="pt-4 font-display text-3xl text-tinta">Contenido</h2>
          <p>
            La información publicada es orientativa y no reemplaza la consulta médica. Ante una emergencia, acudí al servicio de
            urgencias más cercano.
          </p>
        </div>
      </section>
    </>
  );
}
