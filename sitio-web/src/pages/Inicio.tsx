import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Seo } from '@/components/layout/Seo';
import { Portada } from '@/components/sections/Portada';
import { Servicios } from '@/components/sections/Servicios';
import { Nosotros, PorQueElegirnos } from '@/components/sections/Nosotros';
import { Equipo } from '@/components/sections/Equipo';
import { Agendar } from '@/components/sections/Agendar';
import { Educacion } from '@/components/sections/Educacion';
import { Instagram } from '@/components/sections/Instagram';
import { Preguntas, esquemaPreguntas } from '@/components/sections/Preguntas';
import { Contacto } from '@/components/sections/Contacto';
import { LlamadoAccion } from '@/components/sections/LlamadoAccion';
import { esquemaCentro } from '@/lib/seo';
import { desplazarA } from '@/lib/navegacion';

export default function Inicio() {
  const { state } = useLocation();
  const navigate = useNavigate();

  // Al llegar desde otra página con una sección destino, desplazarse a ella.
  useEffect(() => {
    const seccion = (state as { seccion?: string } | null)?.seccion;
    if (!seccion) return;
    const t = setTimeout(() => {
      desplazarA(seccion);
      navigate('.', { replace: true, state: null });
    }, 60);
    return () => clearTimeout(t);
  }, [state, navigate]);

  return (
    <>
      <Seo
        descripcion="BioHealth – Medicina Avanzada: centro médico multidisciplinario en Ayolas, Misiones, Paraguay. Medicina familiar, integrativa, cardiología, ginecología, psiquiatría, psicología, nutrición y estudios. Turnos por WhatsApp."
        esquema={[esquemaCentro(), esquemaPreguntas()]}
      />
      <Portada />
      <Servicios />
      <PorQueElegirnos />
      <Equipo />
      <Nosotros />
      <Agendar />
      <Educacion />
      <Instagram />
      <Preguntas />
      <Contacto />
      <LlamadoAccion />
    </>
  );
}
