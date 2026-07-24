# Pasos finales — módulo Pacientes

Este documento cierra el trabajo hecho sobre el módulo Pacientes:
qué se tocó, y los pasos exactos para dejarlo funcionando en tu
Supabase real y en Vercel.

## Qué se hizo en esta pasada

1. **Migración `supabase/migrations/0004_pacientes_consolidado.sql`**
   (nueva, no reemplaza a 0001-0003). Es idempotente: podés correrla
   las veces que quieras, en cualquier ambiente, y siempre deja el
   mismo resultado final. Corrige un desfasaje real que tenía tu base:
   comparando el esquema real (vía la API de Supabase) contra las
   migraciones existentes, `pacientes.updated_at` **no existía** en la
   base a pesar de que `0002_pacientes_full.sql` la agrega — evidencia
   de que en algún momento se agregaron columnas sueltas a mano en vez
   de correr la migración completa. `0004` es ahora la fuente única de
   verdad: agrega lo que falte, deja `edad`/`ci` nullable, y **recrea
   todas las políticas RLS de `pacientes` y `usuarios`** (SELECT,
   INSERT, UPDATE, DELETE) usando siempre el mismo patrón:
   `tenant_id = (select tenant_id from usuarios where auth_id = auth.uid())`.

2. **`app/api/pacientes/route.ts`** — se sacó el uso de
   `createServiceClient()` (service role) que tenía el `POST` para
   resolver el `tenant_id` del usuario. Ahora usa el mismo cliente de
   sesión (`supabase`, autenticado por cookie) que ya usa el resto de
   la ruta y que ya usa `app/api/pacientes/[id]/route.ts` — una sola
   estrategia de acceso a datos en todo el módulo. Esto funciona porque
   la política `usuarios_self` (RLS) permite a cada usuario leer su
   propia fila en `usuarios`. `lib/supabase/server.ts` conserva
   `createServiceClient()` como utilidad general para casos
   excepcionales documentados (jobs administrativos), pero el módulo
   Pacientes ya no la usa.

3. Verificado: `npm test` (17/17) y `npm run build` terminan sin
   errores con estos cambios.

## Campos que envía el formulario de "Nuevo paciente"

`components/pacientes/PacienteForm.tsx` (validado por
`lib/validation/paciente.ts` → `PacienteSchema`):

| Campo del form | Columna en `pacientes` | Obligatorio |
|---|---|---|
| nombre | `nombre` | sí |
| apellido | `apellido` | sí |
| documento | `documento` | no |
| fechaNacimiento | `fecha_nacimiento` | no |
| sexo | `sexo` | sí |
| telefono | `telefono` | no |
| correo | `correo` | no |
| direccion | `direccion` | no |
| ciudad | `ciudad` | no |
| ocupacion | `ocupacion` | no |
| motivoConsulta | `motivo_consulta` | no |
| antecedentesPersonales | `antecedentes_personales` | no |
| antecedentesFamiliares | `antecedentes_familiares` | no |
| medicamentosActuales | `medicamentos_actuales` | no |
| alergias | `alergias` | no |
| observaciones | `observaciones` | no |

`tenant_id` lo agrega el servidor (`app/api/pacientes/route.ts`), nunca
el cliente. `edad` y `ci` son columnas legacy que usa
`lib/pdf/plantillas.ts`; se completan solas vía trigger a partir de
`fecha_nacimiento`/`documento`.

---

## 1) Aplicar la migración

Tu base ya tiene 0001-0003 aplicadas (parcialmente, en el caso de
0002). Solo falta correr la nueva.

### Opción A — Panel de Supabase (más simple, no necesita CLI)

1. Entrá a tu proyecto en [supabase.com](https://supabase.com/dashboard) → **SQL Editor**.
2. Abrí `supabase/migrations/0004_pacientes_consolidado.sql` de este
   proyecto, copiá todo el contenido y pegalo en un nuevo query.
3. Ejecutá (**Run**). Es seguro volver a correrla si algo falla a mitad
   de camino: es idempotente.

### Opción B — Supabase CLI

```bash
npx supabase login
npx supabase link --project-ref jroysuzcshbzjzfkrotc
npx supabase db push
```

Esto aplica cualquier migración en `supabase/migrations/` que la base
todavía no tenga registrada.

### Verificar que quedó bien

En el SQL Editor, corré:

```sql
select column_name from information_schema.columns
where table_name = 'pacientes' order by column_name;
```

Debe incluir `updated_at`. Y:

```sql
select polname, cmd from pg_policies where tablename = 'pacientes';
```

Debe listar `pacientes_select`, `pacientes_insert`, `pacientes_update`,
`pacientes_delete`.

---

## 2) Configurar variables de entorno

### Local

Ya existe `.env.local` en este proyecto apuntando a tu proyecto de
Supabase real (`jroysuzcshbzjzfkrotc`). Si necesitás recrearlo en otra
máquina, copiá `.env.example` a `.env.local` y completá (Supabase
dashboard → **Settings → API**):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<tu-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave publishable/anon>
SUPABASE_SERVICE_ROLE_KEY=<clave secret/service_role>
```

`SUPABASE_SERVICE_ROLE_KEY` **nunca** debe tener el prefijo
`NEXT_PUBLIC_` — si lo tuviera quedaría expuesta al navegador. No se
usa en el módulo Pacientes; se mantiene solo por si algún job
administrativo futuro la necesita.

### Vercel

**No subas `.env.local` al repo.** Configurá las mismas tres variables
en el proyecto de Vercel: **Settings → Environment Variables**, una por
una, para los entornos que uses (Production / Preview / Development).

---

## 3) Iniciar localmente

```bash
npm install
npm test        # 17/17 — fidelidad del algoritmo clínico
npm run build   # build de producción, sin errores
npm run dev
```

Abrí `http://localhost:3000`, iniciá sesión con
`fernandojose120484@gmail.com` (ya vinculado a un tenant por
`0003_bootstrap_tenant.sql`).

Si en cambio es una base nueva sin usuarios: el **primer** usuario que
inicie sesión se vincula automáticamente como `medico_titular` de un
tenant nuevo (trigger `fn_bootstrap_primer_usuario`, ver 0003). A
partir del segundo usuario, alguien tiene que asignarle tenant a mano
en la tabla `usuarios`.

---

## 4) Desplegar en Vercel

1. Conectá el repositorio en [vercel.com/new](https://vercel.com/new)
   (framework: Next.js, se detecta solo).
2. Cargá las tres variables de entorno del paso 2.
3. Deploy.
4. Verificá que el dominio de Vercel esté permitido en Supabase:
   **Authentication → URL Configuration → Site URL / Redirect URLs**.

---

## 5) Probar crear, listar y editar pacientes

Con sesión iniciada:

1. **Crear** — `/pacientes/nuevo` → completá nombre, apellido y sexo
   (obligatorios) → "Registrar paciente". Debe redirigir a la ficha del
   paciente recién creado. Si ves "Tu usuario no está vinculado a un
   consultorio (tenant)", revisá que la migración 0004 esté aplicada y
   que tu fila en `usuarios` tenga `tenant_id`.
2. **Listar** — `/pacientes` debe mostrar el paciente creado. Probá el
   buscador por nombre, apellido o documento.
3. **Editar** — desde la ficha del paciente, botón "Editar" →
   modificá un campo → "Guardar cambios" → confirmá que el cambio se
   refleje en la ficha.
4. **Eliminar (borrado lógico)** — desde la ficha, confirmá el borrado
   y verificá que el paciente deja de aparecer en el listado (sigue en
   la base con `deleted_at` completado, no se destruye).

### Aislamiento entre consultorios (opcional, recomendado una vez)

Si tenés o creás un segundo usuario en un tenant distinto, iniciá
sesión con esa cuenta y confirmá que **no** ve los pacientes del primer
tenant en `/pacientes`. Esto valida que las políticas RLS de 0004 están
aislando correctamente por `tenant_id`.
