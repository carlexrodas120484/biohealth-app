import { centro } from '@/config/centro';
import { servicios } from '@/config/servicios';
import { profesionalesActivos, nombreCompleto } from '@/config/profesionales';

const url = (ruta = '/') => `${centro.urlSitio}${ruta}`;

/** Datos estructurados schema.org para el centro médico (SEO local). */
export function esquemaCentro() {
  const u = centro.ubicacion;
  const mismosQue = [centro.redes.instagram.url, centro.redes.facebook, centro.redes.tiktok].filter(Boolean);
  const telefono = centro.contacto.whatsapp ? `+${centro.contacto.whatsapp.replace(/\D/g, '')}` : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': ['MedicalClinic', 'MedicalBusiness'],
    '@id': url('/#centro'),
    name: centro.nombreCompleto,
    alternateName: centro.nombre,
    description: centro.descripcionCorta,
    url: url('/'),
    logo: url('/favicon.svg'),
    image: url('/og-image.png'),
    ...(telefono && { telephone: telefono }),
    ...(centro.contacto.email && { email: centro.contacto.email }),
    address: {
      '@type': 'PostalAddress',
      ...(u.direccion && { streetAddress: u.direccion }),
      addressLocality: u.ciudad,
      addressRegion: u.departamento,
      addressCountry: u.codigoPais,
    },
    geo: { '@type': 'GeoCoordinates', latitude: u.latitud, longitude: u.longitud },
    areaServed: [
      { '@type': 'City', name: 'Ayolas' },
      { '@type': 'AdministrativeArea', name: 'Misiones, Paraguay' },
    ],
    medicalSpecialty: [
      'PrimaryCare',
      'Cardiovascular',
      'Gynecologic',
      'Obstetric',
      'Psychiatric',
      'DietNutrition',
    ],
    availableService: servicios.map((s) => ({
      '@type': s.categoria === 'estudio' ? 'MedicalTest' : 'MedicalTherapy',
      name: s.nombre,
      url: url(`/servicios/${s.id}`),
    })),
    employee: profesionalesActivos().map((p) => ({
      '@type': 'Physician',
      name: nombreCompleto(p),
      description: p.especialidad,
    })),
    ...(centro.horarioSEO.length > 0 && {
      openingHoursSpecification: centro.horarioSEO.map((h) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: h.dias,
        opens: h.abre,
        closes: h.cierra,
      })),
    }),
    ...(mismosQue.length && { sameAs: mismosQue }),
  };
}

export const urlCanonica = url;
