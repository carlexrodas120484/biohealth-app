import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { centro } from './src/config/centro';
import { servicios } from './src/config/servicios';
import { articulosPublicados } from './src/content/blog/articulos';

/** Genera sitemap.xml a partir de los archivos de configuración en cada build. */
function sitemap(): Plugin {
  return {
    name: 'biohealth-sitemap',
    generateBundle() {
      const hoy = new Date().toISOString().slice(0, 10);
      const rutas: [string, string, string][] = [
        ['/', hoy, '1.0'],
        ['/agendar', hoy, '0.9'],
        ['/blog', hoy, '0.7'],
        ...servicios.map((s) => [`/servicios/${s.id}`, hoy, '0.8'] as [string, string, string]),
        ...articulosPublicados().map((a) => [`/blog/${a.slug}`, a.fecha, '0.6'] as [string, string, string]),
        ['/privacidad', hoy, '0.2'],
      ];
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rutas
        .map(([r, f, p]) => `  <url><loc>${centro.urlSitio}${r}</loc><lastmod>${f}</lastmod><priority>${p}</priority></url>`)
        .join('\n')}\n</urlset>\n`;
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: xml });
    },
  };
}

// Modo "singlefile": genera un único HTML autocontenido (navegación por hash)
// para compartir una vista previa sin servidor. El build normal es el de producción.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'singlefile' ? [viteSingleFile()] : [sitemap()])],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { __HASH_ROUTER__: JSON.stringify(mode === 'singlefile') },
  build: { outDir: mode === 'singlefile' ? 'dist-preview' : 'dist' },
}));
