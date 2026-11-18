# Sitio web — BioHealth · Medicina Avanzada

Sitio público del centro médico (Ayolas, Misiones, Paraguay).
React 18 + TypeScript + Tailwind CSS + Vite. Independiente del sistema clínico (Next.js) que está en la raíz del repositorio.

## Comandos

```bash
cd sitio-web
npm install
npm run dev            # desarrollo en http://localhost:5173
npm run build          # producción → dist/ (incluye sitemap.xml)
npm run preview        # sirve dist/ localmente
npm run build:preview  # un único HTML autocontenido → dist-preview/index.html (vista previa para compartir)
```

## Qué editar (sin tocar componentes)

| Quiero cambiar… | Archivo |
|---|---|
| **Número de WhatsApp**, teléfono, correo, dirección, mapa, horario general, redes, formas de pago, Google Analytics / Meta Pixel, logo | `src/config/centro.ts` |
| Servicios (textos, fotos, agregar/quitar) | `src/config/servicios.ts` |
| Profesionales y sus horarios (agregar médicos) | `src/config/profesionales.ts` |
| Días de atención, franjas horarias y aviso de la agenda | `src/config/agenda.ts` |
| Sobre BioHealth, Por qué elegirnos, Preguntas frecuentes | `src/config/contenido.ts` |
| Artículos del blog | `src/content/blog/articulos.ts` |
| Colores y tipografías | `tailwind.config.ts` |

### Pasos pendientes antes de publicar
1. **WhatsApp:** escribir el número en `centro.contacto.whatsapp` (solo dígitos, p. ej. `595981123456`). Hasta entonces, WhatsApp se abre con el mensaje listo y el paciente elige el contacto.
2. **Logo original:** copiar el archivo a `public/images/` y poner la ruta en `centro.logo.src`. Mientras tanto se usa un logotipo vectorial provisorio.
3. **Fotografías:** se usan fotos de stock de Unsplash como referencia. Se recomienda reemplazarlas por fotos reales del centro y del equipo (`public/images/…`). Si una imagen no carga, se ve un fondo de marca, nunca un recuadro roto.
4. **Profesionales:** completar horarios reales del Dr. Carlos Rodas y agregar al resto del equipo con datos verificados (hay una plantilla comentada).
5. **Dominio:** actualizar `centro.urlSitio` y la URL de `public/robots.txt`.
6. **Ubicación exacta:** dirección, coordenadas y enlace a la ficha de Google Maps.
7. **Medición (opcional):** IDs de Google Analytics 4 y Meta Pixel. Sin IDs no se carga ningún script de terceros.

## Agendamiento
El formulario (especialidad → profesional → fecha → horario) valida los días de atención y arma un mensaje ordenado para WhatsApp.
No se guarda ningún dato y no se pide información clínica. El turno queda sujeto a confirmación del centro.

## SEO
Títulos y descripciones por página, Open Graph, datos estructurados `MedicalClinic` + `FAQPage` + `Article`, metadatos geográficos, `sitemap.xml` generado en cada build y `robots.txt`.

## Publicación
Es un sitio estático (`dist/`). Incluye configuración para **Vercel** (`vercel.json`) y **Netlify / Cloudflare Pages** (`public/_redirects`, `public/_headers`) con cabeceras de seguridad (CSP, HSTS, etc.) y redirección de rutas al `index.html`.
Si agregan otros servicios externos (por ejemplo, otro proveedor de imágenes), hay que sumarlos a la Content-Security-Policy.
