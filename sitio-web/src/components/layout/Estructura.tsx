import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Encabezado } from './Encabezado';
import { Pie } from './Pie';
import { WhatsAppFlotante } from './WhatsAppFlotante';
import { registrarVistaPagina } from '@/lib/analitica';

export function Estructura() {
  const { pathname, state } = useLocation();

  useEffect(() => {
    if (!(state as { seccion?: string } | null)?.seccion) window.scrollTo(0, 0);
    registrarVistaPagina(pathname);
  }, [pathname, state]);

  return (
    <>
      <button type="button" onClick={() => document.getElementById('contenido')?.focus()} className="saltar-contenido">
        Saltar al contenido
      </button>
      <Encabezado />
      <main id="contenido" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <Pie />
      <WhatsAppFlotante />
    </>
  );
}
