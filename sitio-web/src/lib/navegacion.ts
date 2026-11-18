import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const SECCIONES = [
  { id: 'servicios', etiqueta: 'Servicios' },
  { id: 'profesionales', etiqueta: 'Profesionales' },
  { id: 'nosotros', etiqueta: 'Nosotros' },
  { id: 'educacion', etiqueta: 'Educación' },
  { id: 'preguntas', etiqueta: 'Preguntas' },
  { id: 'contacto', etiqueta: 'Contacto' },
] as const;

export function desplazarA(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' });
  return true;
}

/** Ir a una sección de la portada desde cualquier página (compatible con navegación por hash). */
export function useIrASeccion() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback(
    (id: string) => {
      if (pathname === '/' && desplazarA(id)) return;
      navigate('/', { state: { seccion: id } });
    },
    [navigate, pathname],
  );
}
