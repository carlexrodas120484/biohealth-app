# BioHealth — Registro de Ideas y Backlog Especulativo

| Campo | Valor |
|---|---|
| **Documento** | BIOHEALTH_IDEAS.md |
| **Versión** | 1.0.0 |
| **Fecha de emisión** | 2026-08-03 |
| **Estado** | `Active` |
| **Tipo** | Parking lot — ideas no comprometidas |
| **Documentos relacionados** | `BIOHEALTH_DESIGN_PRINCIPLES.md` · `BIOHEALTH_ROADMAP.md` · `BIOHEALTH_DECISIONS.md` |

---

## ⚠️ Naturaleza de este documento

**Nada en este archivo es una decisión ni un compromiso de roadmap.** Es un espacio para capturar ideas, hipótesis y sugerencias antes de que estén suficientemente maduras para pasar a `BIOHEALTH_ROADMAP.md` (planificadas) o a `BIOHEALTH_DECISIONS.md` (decididas).

Una idea se "promueve" fuera de este documento cuando:
1. Se evalúa explícitamente contra `BIOHEALTH_DESIGN_PRINCIPLES.md` (¿respeta seguridad clínica como piso no negociable? ¿optimiza las seis dimensiones de la Filosofía BioHealth o sacrifica una sin justificación?), y
2. Se decide formalmente: pasa a `BIOHEALTH_ROADMAP.md` si se prioriza para un horizonte, o a `BIOHEALTH_DECISIONS.md` como ADR si ya se implementa.

Ninguna idea de este documento debe implementarse directamente sin pasar por ese proceso.

---

## Índice

1. [Motor clínico y formulación](#1-motor-clínico-y-formulación)
2. [Base de Conocimiento](#2-base-de-conocimiento)
3. [Experiencia del paciente](#3-experiencia-del-paciente)
4. [Panel administrativo](#4-panel-administrativo)
5. [Datos, importación e integraciones](#5-datos-importación-e-integraciones)
6. [Ideas descartadas](#6-ideas-descartadas)
7. [Cómo agregar una idea](#7-cómo-agregar-una-idea)
8. [Historial de cambios](#8-historial-de-cambios)

---

## 1. Motor clínico y formulación

- **Sugerencia de sabor por combinación de principios activos**, no sólo por principio individual — cuando una preparación combina varios activos en un mismo sobre, el "mejor sabor recomendado" de cada uno puede entrar en conflicto; explorar una regla de resolución (¿el sabor del activo más amargo domina?).
- **Alerta de "carga total de sobres por día"**, análoga a la dosis diaria acumulada, para evitar que un paciente termine con un volumen de preparación poco práctico de tomar aunque cada regla individual esté satisfecha.
- **Simulación de "qué pasaría si" al cambiar una preferencia del paciente** — mostrar en el panel cómo cambiaría la formulación sugerida si el paciente tuviera dificultad para tragar cápsulas, antes de guardar el cambio.
- **Score de adherencia estimada** por formulación, combinando número de tomas, tamaño/cantidad de cápsulas o sobres, y preferencias del paciente — puramente informativo para el profesional, nunca un gate automático.

## 2. Base de Conocimiento

- **Vinculación cruzada entre `indicaciones_principios` y el motor de diagnóstico funcional**, para sugerir (no decidir) principios activos candidatos a revisar según el patrón clínico detectado.
- **Nivel de confianza agregado por principio activo**, calculado a partir de cuánta evidencia (`evidencia_cientifica`) y de qué nivel (A–D) tiene cargada — visible en el listado del panel, no usado para saltarse la validación manual.
- **Comparador de versiones de un principio activo** lado a lado, apoyado en `historial_principios_activos`, para revisión antes de re-validar tras una edición.
- **Plantilla CSV específica por tipo de importación** (alta nueva vs. actualización de dosis vs. actualización de evidencia), en vez de una plantilla única con todas las columnas.

## 3. Experiencia del paciente

- **Encuesta de sabor/preferencia en el onboarding del paciente**, para poblar "Preferencias del paciente" (`BIOHEALTH_DESIGN_PRINCIPLES.md`, Sección 7) sin que el profesional tenga que cargarla manualmente en cada consulta.
- **Historial de preferencias declaradas vs. formulaciones aceptadas**, para detectar si el paciente sistemáticamente rechaza formulaciones con cierto sabor o forma, como señal de ajuste futuro.
- **Recordatorio visual en la ficha del paciente** cuando la formulación activa contradice una preferencia declarada (por ejemplo, sobre pese a preferencia por cápsulas por una excepción de la Sección 4.2 de `BIOHEALTH_DESIGN_PRINCIPLES.md`), con el motivo siempre visible.

## 4. Panel administrativo

- **Vista de "principios pendientes de revisión"** como bandeja de trabajo para `medico_titular`, en vez de tener que buscarlos por filtro de estado.
- **Comentarios de revisión** adjuntos a una transición de estado (por qué se rechazó pasar a validado, qué falta corregir), más allá del campo `motivo` ya soportado por `TransicionEstadoSchema`.
- **Exportación de un "paquete de auditoría"** (principio + historial + evidencia + referencias) en un solo archivo, para revisiones externas o legales.
- **Roles adicionales de sólo lectura** sobre la Base de Conocimiento (por ejemplo, `medico_invitado` en modo consulta) — requiere ADR explícito por el impacto de gobernanza (ver ADR-0012 en `BIOHEALTH_DECISIONS.md`).

## 5. Datos, importación e integraciones

- **Importador incremental por lotes grandes** (más de unos pocos miles de filas), con procesamiento en background y notificación al finalizar, si el volumen real de catálogo lo llega a justificar.
- **Integración con una fuente de evidencia externa** (por ejemplo, un identificador estable tipo DOI/PubMed) en `referencias_bibliograficas`, hoy texto libre.
- **Sincronización con el stock real de la botica** para el catálogo de sabores (Sección 6 de `BIOHEALTH_DESIGN_PRINCIPLES.md`), de forma que un sabor agotado se refleje automáticamente como no disponible para nuevas sugerencias.

## 6. Ideas descartadas

Ideas evaluadas y explícitamente **no perseguidas**, con el motivo — para no volver a proponerlas sin nueva información:

| Idea | Motivo del descarte |
|---|---|
| Importador de Excel (`.xlsx`) como reemplazo del CSV | Requiere una dependencia pesada de parseo binario; el CSV cubre el caso de uso y es más simple de auditar/depurar. Ver ADR-0008. |
| Auto-validar un principio activo si tiene "suficiente" evidencia cargada | Contradice directamente el principio de que la validación es siempre una acción humana explícita (`BIOHEALTH_DESIGN_PRINCIPLES.md`, Sección 3). |
| Permitir que cualquier rol edite la Base de Conocimiento para agilizar la carga inicial | El costo de un error clínico propagado a todos los pacientes del tenant supera el beneficio de velocidad. Ver ADR-0012. |

## 7. Cómo agregar una idea

1. Agregar la idea en la sección temática correspondiente, en una línea, con suficiente contexto para que alguien sin memoria de la conversación original la entienda.
2. Si la idea ya fue evaluada y descartada, moverla a la [Sección 6](#6-ideas-descartadas) con el motivo, en vez de borrarla.
3. Cuando una idea se prioriza, moverla a `BIOHEALTH_ROADMAP.md` (con su horizonte correspondiente) y quitarla de este documento.
4. Cuando una idea se implementa directamente sin pasar por el roadmap (cambios pequeños), documentarla como ADR en `BIOHEALTH_DECISIONS.md` y quitarla de acá.

---

## 8. Historial de cambios

| Versión | Fecha | Estado | Cambios | Autor |
|---|---|---|---|---|
| 1.0.0 | 2026-08-03 | `Active` | Emisión inicial del backlog especulativo: motor clínico, Base de Conocimiento, experiencia del paciente, panel administrativo, datos/integraciones, e ideas descartadas con motivo. | Arquitectura BioHealth |
