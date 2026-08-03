# BioHealth — Registro de Decisiones de Arquitectura (ADR)

| Campo | Valor |
|---|---|
| **Documento** | BIOHEALTH_DECISIONS.md |
| **Versión** | 1.0.0 |
| **Fecha de emisión** | 2026-08-03 |
| **Estado** | `Active` |
| **Tipo** | Architecture Decision Record (ADR) log |
| **Formato** | Basado en el formato Nygard de ADR (Contexto → Decisión → Consecuencias) |
| **Documentos relacionados** | `BIOHEALTH_DESIGN_PRINCIPLES.md` · `BIOHEALTH_ROADMAP.md` · `BIOHEALTH_IDEAS.md` |

---

## Índice

1. [Cómo usar este registro](#1-cómo-usar-este-registro)
2. [Convenciones](#2-convenciones)
3. [Registro de decisiones](#3-registro-de-decisiones)
   - [ADR-0001 — Aislamiento multi-tenant vía RLS + subquery de tenant](#adr-0001--aislamiento-multi-tenant-vía-rls--subquery-de-tenant)
   - [ADR-0002 — Catálogo compartido vs. privado mediante `tenant_id NULL`](#adr-0002--catálogo-compartido-vs-privado-mediante-tenant_id-null)
   - [ADR-0003 — División de esquemas Zod en base/refinado](#adr-0003--división-de-esquemas-zod-en-baserefinado)
   - [ADR-0004 — Reglas de formulación configurables, no hardcodeadas](#adr-0004--reglas-de-formulación-configurables-no-hardcodeadas)
   - [ADR-0005 — Integración aditiva de la Base de Conocimiento con el motor existente](#adr-0005--integración-aditiva-de-la-base-de-conocimiento-con-el-motor-existente)
   - [ADR-0006 — Auditoría append-only para cambios clínicos](#adr-0006--auditoría-append-only-para-cambios-clínicos)
   - [ADR-0007 — Máquina de estados para el ciclo de vida de un principio activo](#adr-0007--máquina-de-estados-para-el-ciclo-de-vida-de-un-principio-activo)
   - [ADR-0008 — Importador CSV propio en vez de dependencia de Excel](#adr-0008--importador-csv-propio-en-vez-de-dependencia-de-excel)
   - [ADR-0009 — Creación de la Base de Conocimiento Clínica v1](#adr-0009--creación-de-la-base-de-conocimiento-clínica-v1)
   - [ADR-0010 — Alcance recortado: `reglas_formulacion` aún no se lee dinámicamente](#adr-0010--alcance-recortado-reglas_formulacion-aún-no-se-lee-dinámicamente)
   - [ADR-0011 — Edición de principio activo limitada a campos escalares](#adr-0011--edición-de-principio-activo-limitada-a-campos-escalares)
   - [ADR-0012 — Rol único autorizado para administrar la Base de Conocimiento](#adr-0012--rol-único-autorizado-para-administrar-la-base-de-conocimiento)
   - [ADR-0013 — Prohibición de `service_role` para servir datos de tenant](#adr-0013--prohibición-de-service_role-para-servir-datos-de-tenant)
   - [ADR-0014 — Entrega de código vía `git bundle` cuando el push directo falla](#adr-0014--entrega-de-código-vía-git-bundle-cuando-el-push-directo-falla)
4. [Plantilla para nuevos ADR](#4-plantilla-para-nuevos-adr)
5. [Historial de cambios](#5-historial-de-cambios)

---

## 1. Cómo usar este registro

Cada decisión de arquitectura con impacto duradero en BioHealth se registra acá como un ADR numerado secuencialmente (`ADR-000N`), inmutable una vez publicado. Si una decisión posterior reemplaza a una anterior, el ADR anterior se marca `Superseded by ADR-000M` — **no se edita ni se borra**, siguiendo el mismo principio de no-destrucción que rige los datos clínicos del sistema.

## 2. Convenciones

| Estado del ADR | Significado |
|---|---|
| `Proposed` | En discusión, aún no aplicado en código. |
| `Accepted` | Decidido y reflejado en el código actual. |
| `Superseded` | Reemplazado por un ADR posterior (se referencia cuál). |
| `Deprecated` | Ya no aplica y no fue reemplazado por otra decisión activa. |

> **Nota sobre fechas de los ADR 0001–0014:** documentan decisiones ya tomadas e implementadas durante el desarrollo incremental de BioHealth hasta la entrega de la Base de Conocimiento Clínica v1. Se registran retroactivamente en esta primera versión del documento para dejar trazabilidad formal; a partir de la versión 1.0.0 de este archivo, todo ADR nuevo se redacta **antes o durante** la implementación de la decisión que describe.

---

## 3. Registro de decisiones

### ADR-0001 — Aislamiento multi-tenant vía RLS + subquery de tenant

- **Estado:** `Accepted`
- **Contexto:** BioHealth es multi-tenant (un consultorio = un tenant). Un fallo de aislamiento entre tenants en un sistema clínico es inaceptable: expone historia clínica de un paciente a otro consultorio.
- **Decisión:** Todo acceso a datos de tenant se protege en dos capas: (1) Row Level Security en Postgres, con una función auxiliar que resuelve `tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())`; (2) filtrado explícito del mismo `tenant_id` en cada consulta de la API, sin depender únicamente de RLS. Ninguna ruta confía en una sola de las dos capas.
- **Consecuencias:** Cada endpoint nuevo debe resolver el tenant del usuario autenticado antes de cualquier consulta (`lib/tenant.ts`, y su equivalente administrativo `lib/adminAuth.ts`). El costo es una consulta adicional a `usuarios` por request; se acepta como costo de seguridad no negociable.

---

### ADR-0002 — Catálogo compartido vs. privado mediante `tenant_id NULL`

- **Estado:** `Accepted`
- **Contexto:** Ciertos catálogos (activos de formulación, y ahora la Base de Conocimiento Clínica) tienen sentido como referencia compartida entre todos los tenants, pero un tenant puede necesitar entradas propias.
- **Decisión:** `tenant_id IS NULL` representa una entrada de catálogo compartido/global; `tenant_id = <uuid>` representa una entrada privada de ese tenant. Las consultas de lectura filtran con `tenant_id.is.null OR tenant_id.eq.<tenant>`. Establecido primero en `catalogo_formulacion` (migración 0012) y reutilizado explícitamente en `principios_activos` y `reglas_formulacion`.
- **Consecuencias:** Simplifica compartir un catálogo curado sin duplicar datos por tenant. Requiere que toda escritura administrativa sea consciente de si crea una entrada global o privada (hoy: la creación desde el panel admin crea siempre entradas globales, `tenant_id: null`, dado que sólo `medico_titular` puede crearlas).

---

### ADR-0003 — División de esquemas Zod en base/refinado

- **Estado:** `Accepted`
- **Contexto:** Los esquemas de validación con reglas cruzadas entre campos (`.refine()`) en Zod devuelven un tipo `ZodEffects` que no soporta `.partial()`, necesario para validar ediciones parciales (PATCH).
- **Decisión:** Todo esquema de entidad compleja se define en dos partes: un esquema base (`z.object`, exportado, apto para `.partial()`) y un esquema de entrada completo (`= Base.refine(...).refine(...)`) que agrega las validaciones cruzadas para creación. Las rutas de creación usan el segundo; las rutas de edición parcial usan `Base.partial()`.
- **Consecuencias:** Evita duplicar la definición de campos entre creación y edición. Aplica en `lib/validation/baseConocimiento.ts` (`PrincipioActivoBaseSchema` / `PrincipioActivoInputSchema`) y debe seguir aplicándose en cualquier entidad futura con validaciones cruzadas y edición parcial.

---

### ADR-0004 — Reglas de formulación configurables, no hardcodeadas

- **Estado:** `Accepted`
- **Contexto:** Los umbrales clínicos del motor de formulación (capacidad de cápsula, límite antes de sugerir sobre, umbral de amargor) estaban hardcodeados como constantes de módulo.
- **Decisión:** Se extraen a un tipo `ReglasFormulacion`, con un valor por defecto (`REGLAS_FORMULACION_DEFECTO`) que reproduce exactamente el comportamiento previo, pasado como parámetro opcional a las funciones del motor (`calcularPresentacion`, `construirPreparaciones`). Persistidas también como fila configurable en la tabla `reglas_formulacion`.
- **Consecuencias:** Cambio 100% retrocompatible (verificado con la suite de tests existente sin modificarla). Habilita que estos umbrales se administren como dato en el futuro (ver ADR-0010 para el alcance pendiente de esa integración).

---

### ADR-0005 — Integración aditiva de la Base de Conocimiento con el motor existente

- **Estado:** `Accepted`
- **Contexto:** Al introducir la Base de Conocimiento Clínica, existía el riesgo de romper el motor de formulación y sus fórmulas ya guardadas, que dependían únicamente de `catalogo_formulacion`.
- **Decisión:** La Base de Conocimiento se integra de forma **aditiva**: `catalogoPorNombreNormalizado()` combina `catalogo_formulacion` con los principios `validado` de la Base de Conocimiento, dando prioridad a esta última cuando ambas fuentes tienen datos para el mismo nombre. Ninguna fórmula guardada se reescribe ni se invalida por esta integración.
- **Consecuencias:** El motor de formulación no necesita saber que la Base de Conocimiento existe como estructura separada; sólo consume el mismo mapa `nombre → InfoCatalogo` de siempre. Este puente vive en `lib/clinica/baseConocimiento.ts` (`principiosValidadosAInfoCatalogo`).

---

### ADR-0006 — Auditoría append-only para cambios clínicos

- **Estado:** `Accepted`
- **Contexto:** El principio de "nunca borrar datos clínicos históricos" (`BIOHEALTH_DESIGN_PRINCIPLES.md`, Sección 3) exige un mecanismo concreto para registrar cambios sin permitir que se sobrescriban.
- **Decisión:** Toda entidad clínica con ciclo de vida relevante tiene una tabla de historial append-only asociada (`historial_principios_activos`, siguiendo el mismo patrón que `controles_clinicos`), con política RLS que permite `INSERT` pero no `UPDATE` ni `DELETE`.
- **Consecuencias:** Cada transición de estado, creación o edición relevante debe escribir una fila de historial explícita. El volumen de estas tablas crece de forma monotónica por diseño; se acepta como costo del requisito de auditabilidad.

---

### ADR-0007 — Máquina de estados para el ciclo de vida de un principio activo

- **Estado:** `Accepted`
- **Contexto:** Se requería impedir que un principio activo pasara a `validado` sin pasar por revisión, y que datos incompletos se presentaran como validados.
- **Decisión:** Ciclo de vida cerrado como máquina de estados: `borrador → en_revision → validado → archivado`, con `archivado → borrador` como único camino de restauración. Transiciones no listadas se rechazan (`409`). Un `CHECK` a nivel de base de datos exige `validado_por` y `validado_en` no nulos si `estado = 'validado'`.
- **Consecuencias:** No existe combinación de llamadas a la API que permita saltar directamente de `borrador` a `validado`. La regla vive tanto en la ruta (`TRANSICIONES_VALIDAS`) como en el `CHECK` de base de datos — doble capa, igual que ADR-0001.

---

### ADR-0008 — Importador CSV propio en vez de dependencia de Excel

- **Estado:** `Accepted`
- **Contexto:** Se requería importación masiva de principios activos. Un importador de `.xlsx` implica una dependencia pesada (parser de formato binario Office).
- **Decisión:** Se implementa un parser/serializador CSV propio (RFC 4180: comillas, comas y saltos de línea dentro de campo, BOM UTF-8 para compatibilidad con Excel al abrir el CSV) sin agregar dependencias nuevas al proyecto.
- **Consecuencias:** Cubre el caso de uso principal (carga masiva desde una planilla) sin el costo de mantenimiento de un parser de Excel. Un importador `.xlsx` queda como ítem en discusión (`BIOHEALTH_ROADMAP.md`, Horizonte 1), condicionado a que exista una librería liviana antes de reconsiderarlo.

---

### ADR-0009 — Creación de la Base de Conocimiento Clínica v1

- **Estado:** `Accepted`
- **Contexto:** El motor de formulación necesitaba una fuente de verdad clínica estructurada, versionada y auditable para principios activos, en vez de un catálogo plano (`catalogo_formulacion`) sin ciclo de revisión.
- **Decisión:** Migración `0024_base_conocimiento_clinica.sql` crea 17 tablas normalizadas (los 16 conceptos requeridos + `historial_principios_activos` por ADR-0006), con RLS, `CHECK` de seguridad clínica y una semilla mínima de 20 principios activos usando únicamente datos ya presentes en el repositorio — sin inventar evidencia. Panel de administración restringido a `medico_titular` (ver ADR-0012).
- **Consecuencias:** Sienta la base de datos y de gobernanza para todo el Horizonte 1 de `BIOHEALTH_ROADMAP.md`. Validada contra una instancia real de Postgres 16 antes de aplicarse, incluyendo verificación de idempotencia.

---

### ADR-0010 — Alcance recortado: `reglas_formulacion` aún no se lee dinámicamente

- **Estado:** `Accepted`
- **Contexto:** Al integrar la Base de Conocimiento en la ruta de formulación (ADR-0005), se evaluó también leer `reglas_formulacion` dinámicamente desde la base en esa misma ruta.
- **Decisión:** Se decidió **no** hacerlo en esta iteración: agregar una segunda consulta nueva a una ruta ya extensamente testeada (26+ tests) duplicaba el riesgo de regresión en un solo cambio. Se mantiene `REGLAS_FORMULACION_DEFECTO` como valor efectivo en tiempo de ejecución, aunque `reglas_formulacion` ya existe como tabla configurable.
- **Consecuencias:** Cambiar un umbral en `reglas_formulacion` hoy **no** afecta el comportamiento en producción hasta que se implemente esta lectura dinámica. Este ítem queda explícitamente en `BIOHEALTH_ROADMAP.md`, Horizonte 1, para no perderse como deuda técnica silenciosa.

---

### ADR-0011 — Edición de principio activo limitada a campos escalares

- **Estado:** `Accepted`
- **Contexto:** El endpoint `PATCH /api/admin/base-conocimiento/principios/[id]` permite editar campos del principio activo, pero las sub-entidades (dosis, sinónimos, contraindicaciones, interacciones, evidencia) sólo se cargan al crear o vía importación CSV.
- **Decisión:** Se acepta esta limitación en la v1 para no expandir el alcance de la primera entrega. La edición de sub-entidades queda pendiente de diseño (¿edición in-place vs. nueva versión con revalidación?) antes de implementarse.
- **Consecuencias:** Hoy, corregir una dosis cargada incorrectamente en un principio ya creado requiere reimportación CSV con autorización de sobrescritura, no edición directa en el panel. Documentado como ítem de `BIOHEALTH_ROADMAP.md`, Horizonte 1.

---

### ADR-0012 — Rol único autorizado para administrar la Base de Conocimiento

- **Estado:** `Accepted`
- **Contexto:** La Base de Conocimiento Clínica es un catálogo compartido entre todos los usuarios del tenant; una edición incorrecta (dosis, contraindicación) tiene impacto clínico directo sobre todos los pacientes del consultorio.
- **Decisión:** Sólo el rol `medico_titular` puede leer y escribir en el panel y la API de administración de la Base de Conocimiento (`ROLES_AUTORIZADOS = ['medico_titular']`, verificado en cada ruta vía `resolverUsuarioAutorizado` / `requerirRolAdminEnPagina`). `medico_invitado` y `recepcion` no tienen acceso, ni siquiera de lectura del panel.
- **Consecuencias:** Cualquier ampliación de este acceso (por ejemplo, lectura para `medico_invitado`) es un cambio de gobernanza clínica y requiere su propio ADR, no un ajuste incidental de código.

---

### ADR-0013 — Prohibición de `service_role` para servir datos de tenant

- **Estado:** `Accepted`
- **Contexto:** El cliente `service_role` de Supabase evita RLS por diseño; usarlo para servir datos a un usuario final elimina la segunda capa de defensa de ADR-0001.
- **Decisión:** `createServiceClient()` (`lib/supabase/server.ts`) está reservado exclusivamente para jobs administrativos de servidor que necesitan cruzar RLS de forma controlada, y **nunca** se usa para responder a una request de un usuario autenticado ni se expone al cliente.
- **Consecuencias:** Toda ruta de API de cara a un usuario usa el cliente autenticado estándar (`createClient()`), que respeta RLS. Un uso de `service_role` fuera de este alcance debe tratarse como hallazgo de seguridad, no como optimización.

---

### ADR-0014 — Entrega de código vía `git bundle` cuando el push directo falla

- **Estado:** `Accepted`
- **Contexto:** El entorno de desarrollo usado en varias sesiones de este proyecto tiene un proxy git local que devuelve `403` de forma persistente y no transitoria al intentar `git push` al remoto.
- **Decisión:** Ante un `403` confirmado en `git push`, el flujo de entrega es: crear una rama temporal desde `HEAD`, generar un `git bundle` de esa rama, verificarlo con `git bundle verify`, entregarlo al usuario, y limpiar la rama y el archivo temporal localmente. El commit ya existe en el historial local con autor/firma válidos — el bundle es sólo el mecanismo de transporte cuando el canal de red normal no está disponible.
- **Consecuencias:** El código queda siempre en un commit verificable localmente (`git cat-file`), incluso cuando no se puede empujar al remoto en el momento. El estado "Unverified" que puede mostrar GitHub para un commit que aún no llegó a `origin` es un falso positivo esperado bajo esta decisión, no un problema de firma real.

---

## 4. Plantilla para nuevos ADR

```markdown
### ADR-00NN — <Título corto y descriptivo>

- **Estado:** `Proposed` | `Accepted` | `Superseded by ADR-00MM` | `Deprecated`
- **Fecha:** AAAA-MM-DD
- **Contexto:** ¿Qué problema o tensión motiva esta decisión? ¿Qué principio de `BIOHEALTH_DESIGN_PRINCIPLES.md` está en juego, si aplica?
- **Decisión:** ¿Qué se decidió, en términos concretos y verificables en el código?
- **Consecuencias:** ¿Qué se gana, qué se sacrifica, qué queda como deuda o alcance futuro (referenciar `BIOHEALTH_ROADMAP.md` si corresponde)?
- **Alternativas consideradas:** (opcional) ¿Qué otras opciones se evaluaron y por qué no se eligieron?
```

---

## 5. Historial de cambios

| Versión | Fecha | Estado | Cambios | Autor |
|---|---|---|---|---|
| 1.0.0 | 2026-08-03 | `Active` | Emisión inicial del registro ADR, documentando retroactivamente las decisiones ADR-0001 a ADR-0014 tomadas hasta la entrega de la Base de Conocimiento Clínica v1. | Arquitectura BioHealth |
