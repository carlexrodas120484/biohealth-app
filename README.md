# Método BioHealth® — de prototipo a aplicación real

Este proyecto es la continuación directa de `biohealth_prototipo.html`. La
lógica clínica no se rehizo: se extrajo, se verificó numéricamente contra
el prototipo, y se organizó en un proyecto Next.js + Supabase.

## Qué se portó 1:1 (verificado, no reescrito de memoria)

| Del prototipo | A | Verificación |
|---|---|---|
| `calcIPT()`, `PESOS`, `JERARQ` | `lib/algoritmo/ipt.ts` | `tests/algoritmo/ipt.test.ts` reproduce exactamente los puntajes 95/76/69/60/50 vistos en pantalla |
| Árbol de compuertas del paso 6 | `lib/algoritmo/fases.ts` | `tests/algoritmo/fases.test.ts` reproduce el caso demostrado (Barrera IPT 95 → Restore) |
| Criterios de avance del paso 10 | `lib/algoritmo/criterios-avance.ts` | incluye la válvula de 3 reformulaciones consecutivas |
| Los 10 pasos del flujo clínico | `components/flujo/*.tsx` | mismo contenido y estructura visual, ahora con props en vez de estado global mutable |
| `pdfFormula()` / `pdfPlan()` (jsPDF en el navegador) | `lib/pdf/plantillas.ts` + `lib/pdf/render.ts` | pipeline HTML→PDF probado end-to-end con Puppeteer; mismo contenido, ahora server-side contra datos persistidos |

**Corré `npm test` para ver la prueba de fidelidad correr en vivo.** 17 tests,
todos verificando que el número que ve el médico en la app real es el mismo
que ya validamos juntos en el prototipo.

## Qué está conectado a datos reales

- `app/api/ipt/calcular` — lee alteraciones de Supabase, calcula con los
  pesos vigentes del tenant (no hardcodeados), persiste el resultado.
- `app/api/fase/sugerir` — corre el árbol de compuertas contra datos reales,
  guarda la sugerencia como no confirmada hasta que el médico la valide.
- `app/api/formulas/[id]/firmar` — exige reingresar contraseña antes de
  firmar (ver nota de seguridad más abajo), bloquea refirmar.
- `app/api/documentos/generar` — genera ambos PDF desde la consulta
  persistida, registra en `documentos_generados` qué se entregó y cuándo.
- `supabase/migrations/0001_init.sql` — esquema completo con RLS por
  `tenant_id`, trigger de auditoría en tablas clínicas sensibles.

## Una corrección técnica sobre la propuesta de stack anterior

La generación de PDF **no puede correr en un Edge Function**: Puppeteer
necesita un binario de Chromium y un proceso hijo real, que un Edge Function
(isolate V8 sin filesystem) no puede dar. `app/api/documentos/generar/route.ts`
declara `export const runtime = 'nodejs'` explícitamente por esto. En
producción sobre Vercel, se empaqueta `@sparticuz/chromium` en vez del
Chromium completo — el `package.json` ya lo incluye.

## Qué falta para producción (no es lógica clínica, es plomería)

1. **Generar los tipos reales de Supabase.** `types/database.ts` es un stub
   deliberado para que el proyecto compile. Primer comando después de crear
   el proyecto en Supabase:
   ```
   npx supabase gen types typescript --project-id <id> > types/database.ts
   ```
   Eso también elimina los `as any` que hoy rodean las consultas — están
   ahí únicamente porque el stub no tiene columnas reales, no porque el
   patrón de acceso a datos esté mal.
2. **Páginas de listado** (`/pacientes`, `/agenda`, `/biblioteca`,
   `/casos-clinicos`, `/dashboard`) — CRUD estándar sobre Supabase, mismo
   patrón que ya está en `app/api/*/route.ts`. No tienen lógica clínica
   propia, por eso no se priorizaron en esta pasada.
3. **Páginas de cada paso** (`app/(app)/pacientes/[id]/ipt/page.tsx`, etc.)
   — son un `<Paso5IPT alteraciones={...} />` con los datos ya traídos por
   un Server Component. `Paso5IPT` y `Paso6Fase` están completos como
   referencia del patrón; los otros ocho componentes de paso están listos,
   solo falta la página que los invoca con datos reales.
4. **Carga de la biblioteca de 50 activos** vía `supabase/seed.sql` (pendiente
   de escribir — es el trabajo de carga de datos, no de código, que ya
   identificamos como cuello de botella real del proyecto).

## Cómo correr esto

```bash
npm install
cp .env.example .env.local   # completar con las credenciales de tu proyecto Supabase
npm run test                  # confirma que el algoritmo sigue fiel al prototipo
npm run dev
```

## Estructura

```
lib/algoritmo/     ← motor clínico puro, sin dependencias de framework
lib/pdf/           ← plantillas + renderer HTML→PDF
lib/supabase/      ← clientes de browser y de servidor
components/flujo/  ← los 10 pasos + StepRail, ported del prototipo
app/api/           ← rutas que conectan el motor clínico a datos reales
supabase/          ← esquema, RLS, auditoría
tests/algoritmo/   ← prueba de fidelidad contra el prototipo
```
