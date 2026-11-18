import { useState } from 'react';
import { Isotipo } from './Logo';

interface Props {
  src: string;
  alt: string;
  className?: string;
  prioridad?: boolean;
  sizes?: string;
}

/**
 * Imagen con carga diferida y respaldo de marca: mientras carga, o si la foto no
 * está disponible, se ve una composición en tonos crema/dorado (nunca un recuadro roto).
 */
export function Imagen({ src, alt, className = '', prioridad = false, sizes }: Props) {
  const [fallo, setFallo] = useState(!src);
  const [cargada, setCargada] = useState(false);

  return (
    <div
      role={fallo ? 'img' : undefined}
      aria-label={fallo ? alt || undefined : undefined}
      className={`relative overflow-hidden bg-gradient-to-br from-beige via-crema to-dorado-wash ${className}`}
    >
      {!cargada && (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full border border-dorado/20" />
          <div className="absolute -bottom-16 -left-8 h-56 w-56 rounded-full border border-dorado/15" />
          <Isotipo className="h-14 w-14 opacity-40" />
        </div>
      )}
      {!fallo && (
        <img
          src={src}
          alt={alt}
          sizes={sizes}
          loading={prioridad ? 'eager' : 'lazy'}
          decoding="async"
          // @ts-expect-error atributo válido en navegadores modernos
          fetchpriority={prioridad ? 'high' : 'auto'}
          onError={() => setFallo(true)}
          onLoad={() => setCargada(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${cargada ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}
