import { centro } from '@/config/centro';

/**
 * Carga Google Analytics 4 y Meta Pixel SOLO si sus IDs están configurados en centro.ts.
 * Sin IDs no se carga ningún script de terceros.
 */
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
  }
}

const ID_VALIDO = /^[A-Za-z0-9-]+$/;
let iniciado = false;

export function iniciarAnalitica() {
  if (iniciado || typeof window === 'undefined') return;
  iniciado = true;
  const { googleAnalyticsId: ga, metaPixelId: px } = centro.analitica;

  if (ga && ID_VALIDO.test(ga)) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${ga}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', ga, { anonymize_ip: true });
  }

  if (px && /^\d+$/.test(px)) {
    /* Fragmento oficial de Meta Pixel, reescrito sin eval. */
    const fbq = function (...args: unknown[]) {
      (fbq as any).callMethod ? (fbq as any).callMethod(...args) : (fbq as any).queue.push(args);
    } as any;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
    window.fbq!('init', px);
    window.fbq!('track', 'PageView');
  }
}

export function registrarVistaPagina(ruta: string) {
  window.gtag?.('event', 'page_view', { page_path: ruta });
  window.fbq?.('track', 'PageView');
}

/** Conversión: clic en WhatsApp o envío de solicitud de turno. */
export function registrarConversion(origen: string, detalle?: Record<string, string>) {
  window.gtag?.('event', 'generate_lead', { origen, ...detalle });
  window.fbq?.('track', origen === 'solicitud_turno' ? 'Schedule' : 'Contact', detalle);
}
