import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { Icono } from '@/components/ui/Icono';
import { Boton } from '@/components/ui/Boton';
import { SECCIONES, useIrASeccion } from '@/lib/navegacion';

export function Encabezado() {
  const [abierto, setAbierto] = useState(false);
  const [conSombra, setConSombra] = useState(false);
  const ir = useIrASeccion();
  const { pathname } = useLocation();

  useEffect(() => {
    const f = () => setConSombra(window.scrollY > 12);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);

  useEffect(() => setAbierto(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = abierto ? 'hidden' : '';
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [abierto]);

  const navegar = (id: string) => {
    setAbierto(false);
    ir(id);
  };

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        conSombra ? 'border-b border-linea bg-crema/90 backdrop-blur-md' : 'border-b border-transparent bg-crema'
      }`}
    >
      <div className="mx-auto flex h-20 max-w-contenido items-center justify-between px-5 sm:px-8">
        <Link to="/" aria-label="Ir al inicio" onClick={() => pathname === '/' && window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <Logo compacto />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-7 lg:flex">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              onClick={() => navegar(s.id)}
              className="enlace-nav text-[0.82rem] font-medium tracking-wide text-tinta-suave hover:text-tinta"
            >
              {s.etiqueta}
            </button>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Boton a="/agendar" className="!px-6 !py-3">
            Agendar consulta
          </Boton>
        </div>

        <button
          className="-mr-2 rounded-full p-2 text-tinta lg:hidden"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls="menu-movil"
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
        >
          <Icono nombre={abierto ? 'cerrar' : 'menu'} className="h-7 w-7" />
        </button>
      </div>

      {/* Menú móvil */}
      <div
        id="menu-movil"
        className={`fixed inset-x-0 bottom-0 top-20 z-40 bg-crema transition-all duration-300 lg:hidden ${
          abierto ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <nav aria-label="Menú móvil" className="flex h-full flex-col px-6 pb-10 pt-6">
          {SECCIONES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => navegar(s.id)}
              className="flex items-center justify-between border-b border-linea py-5 text-left font-display text-3xl text-tinta"
              style={{ transitionDelay: `${i * 30}ms` }}
            >
              {s.etiqueta}
              <Icono nombre="flecha" className="h-5 w-5 text-dorado" />
            </button>
          ))}
          <div className="mt-auto pt-8">
            <Boton a="/agendar" className="w-full">
              Agendar consulta
            </Boton>
          </div>
        </nav>
      </div>
    </header>
  );
}
