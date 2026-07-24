/**
 * lib/pdf/render.ts
 *
 * Convierte una plantilla HTML en un PDF real, en el servidor.
 *
 * Nota técnica importante: esto reemplaza al jsPDF del prototipo, que
 * corría en el navegador del médico con datos ya cargados en memoria.
 * Ahora el PDF se genera contra la consulta persistida en Supabase, así
 * que tiene que correr donde haya acceso a un runtime de Node completo
 * con un binario de Chromium — es decir, una función serverless de
 * Node.js, NO un Edge Function. Los Edge Functions de Vercel corren en
 * un isolate V8 sin filesystem ni proceso hijo, y Puppeteer no puede
 * arrancar Chromium ahí. (Esto corrige una imprecisión de la propuesta
 * de stack original, que agrupaba la generación de PDF bajo "Edge
 * Functions" — la ruta de API que usa este módulo debe declarar
 * `export const runtime = 'nodejs'`.)
 *
 * En Vercel, el binario de Chromium se empaqueta con
 * `@sparticuz/chromium` en vez del Chromium completo que descarga
 * Puppeteer por defecto (demasiado pesado para el límite de tamaño de
 * una función serverless).
 */

import type { Browser } from 'puppeteer-core';

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserPromise) return browserPromise;

  browserPromise = (async () => {
    if (process.env.VERCEL) {
      const chromium = (await import('@sparticuz/chromium')).default;
      const puppeteer = await import('puppeteer-core');
      return puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    }
    // en desarrollo local, usa el Chromium que instala `puppeteer` normal
    const puppeteer = await import('puppeteer');
    return puppeteer.launch({ headless: true }) as unknown as Promise<Browser>;
  })();

  return browserPromise;
}

export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
