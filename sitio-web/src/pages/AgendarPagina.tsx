import { useSearchParams } from 'react-router-dom';
import { Seo } from '@/components/layout/Seo';
import { Agendar } from '@/components/sections/Agendar';

export default function AgendarPagina() {
  const [params] = useSearchParams();
  const servicio = params.get('servicio') ?? '';
  const profesional = params.get('profesional') ?? '';
  return (
    <>
      <Seo
        titulo="Solicitar turno"
        ruta="/agendar"
        descripcion="Solicitá tu turno en BioHealth, Ayolas. Elegí especialidad, profesional, fecha y horario, y enviá la solicitud por WhatsApp."
      />
      <Agendar comoPagina key={`${servicio}-${profesional}`} servicioInicial={servicio} profesionalInicial={profesional} />
    </>
  );
}
