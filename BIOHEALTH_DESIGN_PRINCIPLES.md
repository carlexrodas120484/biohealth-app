# BioHealth — Principios de Diseño del Motor Clínico

| Campo | Valor |
|---|---|
| **Documento** | BIOHEALTH_DESIGN_PRINCIPLES.md |
| **Versión** | 1.0.0 |
| **Fecha de emisión** | 2026-08-03 |
| **Estado** | `Active` |
| **Tipo** | Documento normativo (estándar de desarrollo) |
| **Alcance** | Todo el motor clínico de BioHealth: cuestionario funcional, diagnóstico, plan terapéutico, formulación magistral, nutrición y base de conocimiento clínica |
| **Autoridad** | Este documento es de cumplimiento obligatorio para cualquier cambio al motor clínico. Toda excepción debe registrarse como ADR en `BIOHEALTH_DECISIONS.md` |
| **Documentos relacionados** | `BIOHEALTH_ROADMAP.md` · `BIOHEALTH_DECISIONS.md` · `BIOHEALTH_IDEAS.md` |

---

## Índice

1. [Propósito y alcance](#1-propósito-y-alcance)
2. [Filosofía BioHealth](#2-filosofía-biohealth)
3. [Principios de seguridad clínica (no negociables)](#3-principios-de-seguridad-clínica-no-negociables)
4. [Reglas oficiales del motor de formulación](#4-reglas-oficiales-del-motor-de-formulación)
5. [Modelo de datos obligatorio por principio activo](#5-modelo-de-datos-obligatorio-por-principio-activo)
6. [Catálogo de sabores de la botica](#6-catálogo-de-sabores-de-la-botica)
7. [Preferencias del paciente](#7-preferencias-del-paciente)
8. [Gobernanza del documento](#8-gobernanza-del-documento)
9. [Historial de cambios](#9-historial-de-cambios)

---

## 1. Propósito y alcance

Este documento establece los principios de diseño **obligatorios** para el motor clínico de BioHealth: las reglas que ningún cambio de código, migración o feature puede contradecir sin pasar antes por un ADR formal en `BIOHEALTH_DECISIONS.md`.

BioHealth es software de apoyo a la decisión médica en un consultorio de medicina funcional/integrativa. No es —y no debe convertirse por accidente en— un sistema de diagnóstico automático ni de prescripción automática. Cada regla de este documento existe para sostener esa frontera de forma explícita y verificable en el código.

Aplica a:
- El motor de reglas de formulación magistral (`lib/clinica/formulacion.ts`).
- La Base de Conocimiento Clínica (`principios_activos` y tablas relacionadas).
- Cualquier motor futuro de sugerencia diagnóstica o nutricional.
- El diseño de datos, RLS y flujos de validación clínica asociados.

---

## 2. Filosofía BioHealth

> **El algoritmo de BioHealth debe optimizar simultáneamente seis dimensiones — nunca una a costa de eliminar las demás:**

| Dimensión | Qué significa en BioHealth |
|---|---|
| **Eficacia** | La formulación debe estar dentro de rangos de dosis reconocidos y respaldados por evidencia cargada en la Base de Conocimiento. |
| **Seguridad** | Ninguna sugerencia se presenta como validada si hay datos incompletos, contraindicaciones, interacciones o evidencia insuficiente sin señalar. |
| **Adherencia** | Un tratamiento que el paciente no sostiene en el tiempo no cumple su función clínica, aunque sea teóricamente óptimo. |
| **Comodidad** | Número de tomas, tamaño de cápsulas, sabor y forma de administración importan tanto como la dosis. |
| **Facilidad de preparación magistral** | La receta debe ser preparable de forma consistente y repetible por el farmacéutico, sin ambigüedad. |
| **Aceptación del paciente** | Preferencias organolépticas y de forma farmacéutica declaradas por el paciente son un insumo clínico, no un detalle estético. |

Estas seis dimensiones **no tienen un orden de prioridad fijo entre sí** — el motor debe buscar el punto que las satisfaga conjuntamente. La única excepción es que **seguridad actúa como piso, no como variable de optimización**: ninguna combinación de comodidad, adherencia o preferencia del paciente puede relajar una regla de seguridad. Ver [Sección 3](#3-principios-de-seguridad-clínica-no-negociables).

Esta filosofía es el criterio de aceptación de cualquier feature nuevo del motor clínico: si una propuesta mejora una dimensión sacrificando otra sin justificación explícita y documentada (ADR), no está alineada con BioHealth.

---

## 3. Principios de seguridad clínica (no negociables)

Estos principios ya rigen el código actual y son la base de todo lo que se construya encima:

1. **Nunca hay diagnóstico automático ni prescripción automática.** Todo lo que el motor produce es una *sugerencia revisable por un profesional*. Ninguna ruta ni componente puede "firmar" o "aprobar" una formulación sin acción explícita de un médico.
2. **Una dosis cargada no es una dosis segura por el solo hecho de estar cargada.** Se distingue siempre entre dosis informativa, mínima, usual y máxima, y toda dosis debe traer una referencia bibliográfica o quedar marcada explícitamente como *"sin evidencia cargada"*.
3. **Datos incompletos nunca se presentan como validados.** Un principio activo en estado `borrador` o `en_revision` no puede llegar al motor de formulación ni a ninguna sugerencia clínica: sólo `validado`.
4. **Aislamiento multi-tenant estricto.** Todo dato clínico se resuelve contra el tenant del usuario autenticado (vía RLS + filtrado explícito en cada consulta); nunca se usa `service_role` para servir datos de un tenant a un usuario.
5. **Nada se borra físicamente.** Los datos clínicos históricos se archivan (`estado='archivado'`) o se registran en tablas de auditoría append-only (`historial_principios_activos`); nunca `DELETE`.
6. **Toda alerta muestra su motivo.** Ninguna advertencia de seguridad (interacción, incompatibilidad, exceso de dosis diaria, contraindicación) se presenta sin la razón concreta que la origina.
7. **Cambios de rol/permiso son explícitos.** Sólo `medico_titular` administra la Base de Conocimiento; cualquier extensión de este acceso requiere un ADR.

---

## 4. Reglas oficiales del motor de formulación

Estas reglas son la especificación normativa del motor de reglas de presentación farmacéutica. Su implementación de referencia vive en `lib/clinica/formulacion.ts` (`ReglasFormulacion` / `REGLAS_FORMULACION_DEFECTO`), configurable, no hardcodeada en múltiples lugares del código.

### 4.1 Límite de cápsulas por toma

> **Por defecto, el máximo es 2 cápsulas por toma.**

- Si una formulación, dada la capacidad aproximada por cápsula del/los principios activos, **supera 2 cápsulas en una misma toma**, el motor **intenta convertir automáticamente esa toma a presentación en sobre**.
- Esta conversión es una *sugerencia automática*, no una escritura silenciosa: el cambio de presentación queda visible y explicado (motivo: "supera el límite de cápsulas por toma") para que el profesional lo confirme.

### 4.2 Excepciones que bloquean la conversión automática a sobre

La conversión automática a sobre **no** debe ocurrir — y el ingrediente se mantiene en cápsulas aun superando el límite recomendado — cuando se cumple **cualquiera** de estas condiciones:

| Condición | Ejemplo | Motivo |
|---|---|---|
| **Mal perfil organoléptico** (sabor amargo/desagradable intenso) | NAC (N-acetilcisteína), Berberina | El sabor arruinaría la aceptación del paciente en sobre, incluso disuelto o saborizado |
| **Incompatibilidad con otro ingrediente de la misma preparación** | Dos principios que reaccionan entre sí en solución | Riesgo de degradación o pérdida de eficacia |
| **Mala solubilidad en agua** | Ingredientes de baja solubilidad acuosa | El sobre quedaría con sedimento o dosis no homogénea |
| **Inestabilidad en la forma sobre** | Principios sensibles a humedad/oxidación en polvo suelto | Pérdida de potencia antes de ser consumido |
| **Presentación comercial obligatoria** | Ingredientes que sólo existen en presentación comercial cerrada (no fraccionable) | No hay forma magistral disponible |

Cuando cualquiera de estas condiciones aplica, el sistema **debe mostrar explícitamente el motivo del bloqueo** — nunca cambia de presentación en silencio, y nunca oculta por qué se mantuvo en cápsulas pese a superar el límite recomendado.

### 4.3 Otras alertas obligatorias del motor

El motor de formulación debe, como mínimo, detectar y alertar (siempre con motivo visible) sobre:

- **Ingrediente activo duplicado** dentro de la misma formulación.
- **Dosis diaria acumulada** de un mismo principio activo a través de múltiples tomas/preparados.
- **Incompatibilidades de formulación** entre principios activos de la misma preparación.

### 4.4 Reglas configurables, no hardcodeadas

Los valores numéricos de estas reglas (capacidad por defecto de cápsula, límite de cápsulas antes de sugerir sobre, umbral de amargor que bloquea la conversión automática) se gestionan como configuración (`reglas_formulacion` en la Base de Conocimiento / `ReglasFormulacion` en código), no como constantes dispersas en múltiples archivos. Cambiar un umbral clínico es una decisión que debe quedar auditada, no un `find & replace`.

---

## 5. Modelo de datos obligatorio por principio activo

Todo principio activo dado de alta en la Base de Conocimiento Clínica debe poder registrar, como mínimo, los siguientes atributos. Un campo sin dato confiable disponible se deja vacío y se marca *"pendiente de validación"* — nunca se completa con un valor supuesto.

| Atributo | Descripción |
|---|---|
| **Dosis habitual** | Dosis usual de referencia, con unidad y frecuencia, y su fuente bibliográfica (o marca explícita de "sin evidencia cargada"). |
| **Dosis máxima** | Límite superior documentado; nunca se asume "seguro" sólo por estar cargado. |
| **Presentación ideal** | Cápsula, sobre, líquido o presentación comercial — la forma farmacéutica preferida para ese principio. |
| **Compatibilidad** | Con qué otros principios activos es compatible o incompatible dentro de una misma preparación, y el motivo. |
| **Perfil organoléptico** | Sabor, intensidad de sabor, olor — la base de la regla de la [Sección 4.2](#42-excepciones-que-bloquean-la-conversión-automática-a-sobre). |
| **Estabilidad** | Estabilidad del principio en las distintas formas de preparación (cápsula, sobre, disolución). |
| **Capacidad aproximada por cápsula** | Miligramos que razonablemente entran en una cápsula estándar para ese principio — la base del cálculo de la [Sección 4.1](#41-límite-de-cápsulas-por-toma). |
| **Posibilidad de formular en sobres** | Sí/No/Con condiciones, y qué condiciones (ver excepciones de la sección 4.2). |
| **Mejor sabor recomendado** | Cuál de los sabores disponibles de la botica (ver [Sección 6](#6-catálogo-de-sabores-de-la-botica)) mejor enmascara o combina con este principio, cuando aplica a preparación en sobre/líquido. |

Este modelo de datos está implementado en las tablas `principios_activos`, `dosis_principios`, `presentaciones_farmaceuticas`, `propiedades_organolepticas`, `incompatibilidades_formulacion` e `interacciones_principios` de la Base de Conocimiento Clínica (migración `0024_base_conocimiento_clinica.sql`).

---

## 6. Catálogo de sabores de la botica

Los sabores disponibles para saborizar preparaciones (fundamentalmente sobres y líquidos) son un catálogo cerrado, correspondiente al stock real de la botica:

| # | Sabor |
|---|---|
| 1 | Naranja |
| 2 | Mandarina |
| 3 | Limón |
| 4 | Uva |
| 5 | Piña |
| 6 | Frutilla |
| 7 | Durazno |
| 8 | Mburucuyá |

Cualquier campo de "mejor sabor recomendado" (Sección 5) o "sabor favorito" / "sabores rechazados" (Sección 7) debe restringirse a este catálogo. Ampliar la lista es una decisión operativa de la botica, no una decisión de software: debe registrarse como ADR cuando ocurra.

---

## 7. Preferencias del paciente

Las preferencias del paciente son un insumo clínico de primer orden (ver [Filosofía BioHealth](#2-filosofía-biohealth): comodidad y aceptación del paciente pesan tanto como eficacia y seguridad). Todo paciente debe poder tener registrado:

| Campo | Descripción |
|---|---|
| **Sabor favorito** | Uno de los sabores del [catálogo de la botica](#6-catálogo-de-sabores-de-la-botica). |
| **Sabores rechazados** | Uno o más sabores del catálogo que el paciente explícitamente no tolera o rechaza. |
| **Dificultad para tragar cápsulas** | Sí/No/Parcial — condiciona la preferencia hacia sobres o líquidos. |
| **Preferencia por cápsulas, sobres o líquidos** | Preferencia declarada de forma farmacéutica, independiente de la dificultad para tragar. |

Estas preferencias son **una señal de entrada para el motor de formulación**, no una orden que se ejecuta ciegamente: si la preferencia del paciente entra en conflicto con una regla de seguridad de la [Sección 3](#3-principios-de-seguridad-clínica-no-negociables) o con una excepción organoléptica/estabilidad de la [Sección 4.2](#42-excepciones-que-bloquean-la-conversión-automática-a-sobre), la regla de seguridad prevalece y el conflicto se muestra explícitamente al profesional — nunca se resuelve en silencio a favor de una preferencia.

> **Estado de implementación:** el modelo de datos de esta sección está definido como estándar en este documento. Su persistencia (tabla y campos en el paciente) y su consumo por el motor de formulación se planifican en `BIOHEALTH_ROADMAP.md`.

---

## 8. Gobernanza del documento

- Este documento es de cumplimiento obligatorio para todo cambio al motor clínico.
- Cualquier propuesta que contradiga un principio aquí establecido debe:
  1. Registrarse primero como propuesta en `BIOHEALTH_IDEAS.md`, o
  2. Pasar directamente a una decisión formal en `BIOHEALTH_DECISIONS.md` (ADR), que referencie explícitamente qué sección de este documento modifica y por qué.
- Un cambio a este documento en sí (no a las ideas o decisiones que lo alimentan) requiere: bump de versión, entrada en el historial de cambios, y — si afecta una regla de seguridad clínica (Sección 3) — un ADR asociado en `BIOHEALTH_DECISIONS.md`.
- Estados posibles de este documento: `Draft` (en discusión, no vinculante), `Active` (vigente y de cumplimiento obligatorio), `Deprecated` (reemplazado por una versión posterior, se conserva por trazabilidad histórica).

---

## 9. Historial de cambios

| Versión | Fecha | Estado | Cambios | Autor |
|---|---|---|---|---|
| 1.0.0 | 2026-08-03 | `Active` | Emisión inicial: filosofía BioHealth, principios de seguridad clínica, reglas oficiales del motor de formulación (límite de cápsulas, conversión a sobre, excepciones organolépticas), modelo de datos por principio activo, catálogo de sabores, preferencias del paciente. | Arquitectura BioHealth |
