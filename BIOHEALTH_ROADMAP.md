# BioHealth — Roadmap de Producto y Plataforma

| Campo | Valor |
|---|---|
| **Documento** | BIOHEALTH_ROADMAP.md |
| **Versión** | 1.0.0 |
| **Fecha de emisión** | 2026-08-03 |
| **Estado** | `Active` |
| **Tipo** | Documento vivo de planificación técnica |
| **Horizonte** | Multi-año — revisado y versionado en cada hito mayor |
| **Documentos relacionados** | `BIOHEALTH_DESIGN_PRINCIPLES.md` · `BIOHEALTH_DECISIONS.md` · `BIOHEALTH_IDEAS.md` |

---

## Índice

1. [Cómo leer este roadmap](#1-cómo-leer-este-roadmap)
2. [Visión de plataforma](#2-visión-de-plataforma)
3. [Estado actual — módulos entregados](#3-estado-actual--módulos-entregados)
4. [Horizonte 1 — Consolidación de la Base de Conocimiento](#4-horizonte-1--consolidación-de-la-base-de-conocimiento)
5. [Horizonte 2 — Motor clínico avanzado](#5-horizonte-2--motor-clínico-avanzado)
6. [Horizonte 3 — Plataforma y escala](#6-horizonte-3--plataforma-y-escala)
7. [No-objetivos permanentes](#7-no-objetivos-permanentes)
8. [Historial de cambios](#8-historial-de-cambios)

---

## 1. Cómo leer este roadmap

Cada ítem tiene un estado:

| Estado | Significado |
|---|---|
| ✅ `Done` | Implementado, con tests y en `main`. |
| 🚧 `In progress` | En desarrollo activo. |
| 📋 `Planned` | Priorizado, no iniciado. |
| 💭 `Under discussion` | Sin compromiso de fecha; ver `BIOHEALTH_IDEAS.md` para la discusión abierta. |
| 🚫 `Non-goal` | Explícitamente fuera de alcance salvo ADR que lo reautorice (ver [Sección 7](#7-no-objetivos-permanentes)). |

Ningún ítem de este roadmap se implementa violando `BIOHEALTH_DESIGN_PRINCIPLES.md`. Si un ítem lo requiere, primero se resuelve el conflicto vía ADR en `BIOHEALTH_DECISIONS.md`.

---

## 2. Visión de plataforma

BioHealth es la plataforma clínica de apoyo a la decisión para un consultorio de medicina funcional/integrativa: desde el ingreso del paciente hasta la formulación magistral, pasando por diagnóstico funcional, plan terapéutico y seguimiento nutricional — siempre como **sugerencia revisable por un profesional**, nunca como decisión autónoma del sistema.

La visión de largo plazo es que la Base de Conocimiento Clínica se convierta en el activo central y reutilizable de la plataforma: una fuente única, auditada y versionada de principios activos, dosis, evidencia e interacciones, de la que se alimentan todos los motores clínicos (formulación, nutrición, y eventualmente apoyo diagnóstico).

---

## 3. Estado actual — módulos entregados

| Módulo | Estado | Notas |
|---|---|---|
| Gestión de pacientes (alta, ficha, edición, aislamiento multi-tenant) | ✅ `Done` | Base de todo el resto del sistema. |
| Historia clínica | ✅ `Done` | Versionado de historia por paciente. |
| Cuestionario funcional | ✅ `Done` | Motor de scoring por sistema. |
| Diagnóstico funcional (motor de patrones) | ✅ `Done` | Reglas de patrones clínicos, no diagnóstico automático. |
| Plan terapéutico | ✅ `Done` | Vinculado a fases del método. |
| Formulación magistral (motor de reglas) | ✅ `Done` | Reglas de cápsula/sobre configurables (`ReglasFormulacion`). |
| Nutrición clínica | ✅ `Done` | Motor de cálculo nutricional. |
| Dashboard clínico | ✅ `Done` | |
| Motor IA clínica v1 | ✅ `Done` | Asistencia, no automatización de decisión clínica. |
| Flujo clínico automático de principio a fin | ✅ `Done` | Orquestación de los módulos anteriores. |
| **Base de Conocimiento Clínica v1** | ✅ `Done` | 17 tablas, ciclo de vida borrador→validado, importación/exportación CSV, panel admin `medico_titular`. Ver ADR-0009 en `BIOHEALTH_DECISIONS.md`. |

---

## 4. Horizonte 1 — Consolidación de la Base de Conocimiento

Objetivo: que la Base de Conocimiento pase de "estructura y semilla mínima" a "catálogo clínicamente útil y completo", sin comprometer el rigor de validación ya establecido.

| Ítem | Estado | Descripción |
|---|---|---|
| Ampliación del catálogo de principios activos validados | 📋 `Planned` | Revisión y validación profesional de los ~16 principios sembrados en `borrador`, y alta de nuevos principios con evidencia real (nunca inventada). |
| Persistencia de "Preferencias del paciente" (Sección 7 de `BIOHEALTH_DESIGN_PRINCIPLES.md`) | 📋 `Planned` | Tabla y API para sabor favorito, sabores rechazados, dificultad para tragar, preferencia de forma farmacéutica. |
| Consumo de preferencias del paciente por el motor de formulación | 📋 `Planned` | El motor debe considerar preferencias al sugerir sabor/forma, sin relajar reglas de seguridad. |
| Lectura dinámica de `reglas_formulacion` desde la ruta de formulación | 📋 `Planned` | Hoy los valores por defecto están seedeados en la base pero la ruta de formulación aún no los lee dinámicamente (recorte de alcance deliberado documentado en ADR-0010). |
| Gestión de categorías clínicas y relación `principio_categoria` desde el panel admin | 📋 `Planned` | Las tablas existen desde la migración 0024; falta UI de administración. |
| Edición de sub-entidades (dosis, sinónimos, contraindicaciones, evidencia) desde el panel de edición | 📋 `Planned` | Hoy sólo se cargan al crear o vía importación CSV; el `PATCH` de edición sólo cubre campos escalares del principio (ver ADR-0011). |
| Importador de Excel (.xlsx) además de CSV | 💭 `Under discussion` | Sólo si no exige una dependencia pesada; CSV es y seguirá siendo el importador estable de referencia. |

---

## 5. Horizonte 2 — Motor clínico avanzado

Objetivo: enriquecer las sugerencias del motor sin cruzar la frontera de diagnóstico/prescripción automática.

| Ítem | Estado | Descripción |
|---|---|---|
| Motor de interacciones extendido (principio↔medicamento externo) | 📋 `Planned` | Hoy `interacciones_principios` soporta sustancia externa como texto libre; falta un catálogo estructurado de medicamentos externos. |
| Motor de alertas de dosis acumulada entre preparaciones históricas del mismo paciente | 💭 `Under discussion` | Requiere definir ventana temporal y criterio clínico antes de implementar. |
| Panel de revisión clínica comparada (ver versiones anteriores de un principio validado) | 📋 `Planned` | Se apoya en `historial_principios_activos`, ya existente. |
| Recomendaciones nutricionales cruzadas con la Base de Conocimiento | 💭 `Under discussion` | Unificar el catálogo de activos con el motor de nutrición. |
| Apoyo diagnóstico asistido por IA, explícitamente no vinculante | 💭 `Under discussion` | Requiere ADR específico de gobernanza clínica antes de cualquier prototipo — no es un ítem de "cuándo", es un ítem de "bajo qué condiciones". |

---

## 6. Horizonte 3 — Plataforma y escala

| Ítem | Estado | Descripción |
|---|---|---|
| Multi-idioma (es/en) en catálogo y panel admin | 💭 `Under discussion` | |
| Exportación/backup completo de la Base de Conocimiento (más allá del CSV de principios) | 📋 `Planned` | Incluir evidencia, referencias y reglas de formulación en la exportación. |
| Auditoría centralizada multi-tenant para operadores de plataforma | 💭 `Under discussion` | Requiere definir el rol de "operador de plataforma" distinto de `medico_titular`. |
| API pública/documentada para integraciones externas (labs, farmacias) | 💭 `Under discussion` | |

---

## 7. No-objetivos permanentes

Estos ítems están **explícitamente fuera del roadmap** salvo que un ADR formal los reautorice con condiciones claras de gobernanza clínica y legal:

- 🚫 **Diagnóstico automático que reemplace el juicio del profesional.** El sistema puede sugerir patrones; nunca "diagnostica" de forma vinculante.
- 🚫 **Prescripción automática o firma automática de formulaciones.** Toda receta requiere acción explícita de un profesional habilitado.
- 🚫 **Relajar el aislamiento multi-tenant** por conveniencia de una feature (por ejemplo, "catálogo compartido editable por cualquier tenant").
- 🚫 **Borrado físico de datos clínicos históricos**, bajo ningún argumento de performance o limpieza.

---

## 8. Historial de cambios

| Versión | Fecha | Estado | Cambios | Autor |
|---|---|---|---|---|
| 1.0.0 | 2026-08-03 | `Active` | Emisión inicial: estado actual de módulos entregados, Horizonte 1 (consolidación de Base de Conocimiento), Horizonte 2 (motor clínico avanzado), Horizonte 3 (plataforma y escala), no-objetivos permanentes. | Arquitectura BioHealth |
