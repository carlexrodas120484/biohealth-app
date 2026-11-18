import { Link } from 'react-router-dom';
import type { ReactNode, MouseEventHandler } from 'react';

type Variante = 'primario' | 'secundario' | 'claro' | 'texto' | 'whatsapp';

const estilos: Record<Variante, string> = {
  primario:
    'bg-dorado text-tinta hover:bg-tinta hover:text-white shadow-[0_10px_30px_-12px_rgba(201,150,36,.75)] hover:shadow-[0_14px_34px_-12px_rgba(43,41,37,.5)]',
  secundario: 'border border-tinta/20 text-tinta hover:border-dorado hover:text-dorado-oscuro bg-white/60 backdrop-blur',
  claro: 'border border-white/40 text-white hover:bg-white hover:text-tinta',
  texto: 'text-dorado-oscuro hover:text-tinta px-0 py-0',
  whatsapp: 'bg-[#1F7A4D] text-white hover:bg-[#17603C]',
};

const base =
  'inline-flex items-center justify-center gap-2.5 whitespace-nowrap text-center rounded-full px-7 py-3.5 text-[0.8rem] font-semibold uppercase tracking-[0.16em] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado focus-visible:ring-offset-2 focus-visible:ring-offset-crema disabled:cursor-not-allowed disabled:opacity-50';

interface Props {
  children: ReactNode;
  variante?: Variante;
  a?: string; // ruta interna
  href?: string; // enlace externo
  onClick?: MouseEventHandler<HTMLElement>;
  type?: 'button' | 'submit';
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function Boton({ children, variante = 'primario', a, href, onClick, type = 'button', className = '', disabled, ariaLabel }: Props) {
  const cls = `${base} ${estilos[variante]} ${className}`;
  if (a) {
    return (
      <Link to={a} className={cls} onClick={onClick} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onClick} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
