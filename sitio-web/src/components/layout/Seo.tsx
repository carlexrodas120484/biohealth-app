import { Helmet } from 'react-helmet-async';
import { centro } from '@/config/centro';
import { urlCanonica } from '@/lib/seo';

interface Props {
  titulo?: string;
  descripcion?: string;
  ruta?: string;
  imagen?: string;
  tipo?: 'website' | 'article';
  esquema?: object;
}

export function Seo({ titulo, descripcion, ruta = '/', imagen, tipo = 'website', esquema }: Props) {
  const t = titulo ? `${titulo} | ${centro.nombreCompleto}` : `${centro.nombreCompleto} | Centro médico en Ayolas, Misiones`;
  const d = descripcion ?? centro.descripcionCorta;
  const img = imagen ?? `${centro.urlSitio}/og-image.png`;
  return (
    <Helmet>
      <title>{t}</title>
      <meta name="description" content={d} />
      <link rel="canonical" href={urlCanonica(ruta)} />
      <meta property="og:title" content={t} />
      <meta property="og:description" content={d} />
      <meta property="og:url" content={urlCanonica(ruta)} />
      <meta property="og:type" content={tipo} />
      <meta property="og:image" content={img} />
      <meta name="twitter:card" content="summary_large_image" />
      {esquema && <script type="application/ld+json">{JSON.stringify(esquema)}</script>}
    </Helmet>
  );
}
