import type { ReactNode } from 'react';

interface Props {
  etiqueta: string;
  titulo: ReactNode;
  texto?: ReactNode;
  centrado?: boolean;
  claro?: boolean;
  as?: 'h1' | 'h2';
}

export function EncabezadoSeccion({ etiqueta, titulo, texto, centrado = false, claro = false, as: H = 'h2' }: Props) {
  return (
    <div className={`max-w-2xl ${centrado ? 'mx-auto text-center' : ''}`}>
      <p className={`etiqueta ${centrado ? 'justify-center' : ''} ${claro ? 'text-dorado-claro' : ''}`}>{etiqueta}</p>
      <H className={`mt-4 font-display text-4xl font-medium leading-[1.08] sm:text-5xl ${claro ? 'text-white' : 'text-tinta'}`}>
        {titulo}
      </H>
      {texto && <p className={`mt-5 text-base leading-relaxed sm:text-lg ${claro ? 'text-white/75' : 'text-tinta-suave'}`}>{texto}</p>}
    </div>
  );
}
