import { useEffect, useState } from 'react';
import { Icono } from '@/components/ui/Icono';
import { enlaceWhatsApp, mensajeConsultaGeneral } from '@/lib/whatsapp';
import { registrarConversion } from '@/lib/analitica';

export function WhatsAppFlotante() {
  const [visible, setVisible] = useState(false);
  // Aparece al desplazarse, para no tapar los botones principales de la portada.
  useEffect(() => {
    const f = () => setVisible(window.scrollY > 380);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);

  return (
    <a
      href={enlaceWhatsApp(mensajeConsultaGeneral())}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => registrarConversion('whatsapp_flotante')}
      aria-label="Escribir a BioHealth por WhatsApp"
      className={`group fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-full bg-[#1F7A4D] p-4 text-white shadow-elevada transition-all duration-500 hover:bg-[#17603C] sm:bottom-7 sm:right-7 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
      }`}
    >
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#1F7A4D]/30 [animation-duration:2.8s] motion-reduce:hidden" />
      <Icono nombre="whatsapp" className="h-7 w-7" />
      <span className="hidden max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-500 group-hover:max-w-[12rem] group-hover:pr-2 sm:inline">
        Escribinos
      </span>
    </a>
  );
}
