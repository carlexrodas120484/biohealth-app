import { centro } from '@/config/centro';

/** Isotipo vectorial: círculo dorado con dos hojas que forman una cruz sutil (bio + salud). */
export function Isotipo({ className = 'h-10 w-10', claro = false }: { className?: string; claro?: boolean }) {
  const trazo = claro ? '#E4C77E' : '#C99624';
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" fill="none">
      <circle cx="24" cy="24" r="22.5" stroke={trazo} strokeWidth="1.2" />
      <circle cx="24" cy="24" r="18.5" stroke={trazo} strokeWidth="0.5" opacity="0.5" />
      <path d="M24 11c4.6 4.2 4.6 21.8 0 26-4.6-4.2-4.6-21.8 0-26Z" stroke={trazo} strokeWidth="1.2" />
      <path d="M11 24c4.2-4.6 21.8-4.6 26 0-4.2 4.6-21.8 4.6-26 0Z" stroke={trazo} strokeWidth="1.2" />
      <circle cx="24" cy="24" r="1.6" fill={trazo} />
    </svg>
  );
}

interface LogoProps {
  claro?: boolean;
  compacto?: boolean;
  className?: string;
}

/** Logotipo completo. Si se configura `centro.logo.src`, se usa el archivo original. */
export function Logo({ claro = false, compacto = false, className = '' }: LogoProps) {
  const archivo = claro && centro.logo.srcClaro ? centro.logo.srcClaro : centro.logo.src;
  if (archivo) {
    return <img src={archivo} alt={centro.logo.alt} className={`h-11 w-auto object-contain ${className}`} />;
  }
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <Isotipo className={compacto ? 'h-9 w-9' : 'h-11 w-11'} claro={claro} />
      <span className="flex flex-col leading-none">
        <span
          className={`font-display text-[1.45rem] font-semibold tracking-[0.2em] ${claro ? 'text-white' : 'text-tinta'}`}
        >
          BIOHEALTH
        </span>
        <span
          className={`mt-1 text-[0.58rem] font-semibold tracking-[0.42em] ${claro ? 'text-dorado-claro' : 'text-dorado'}`}
        >
          MEDICINA AVANZADA
        </span>
      </span>
      <span className="sr-only">{centro.nombreCompleto}</span>
    </span>
  );
}
