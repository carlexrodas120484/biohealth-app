-- Base de Conocimiento Clínica v1 — tabla `conocimiento_clinico`.
--
-- Cada fila representa UNA indicación clínica de un principio activo
-- para un objetivo terapéutico + fase determinados: "para el objetivo
-- X en la fase Y, este principio se sugiere con prioridad P, esta
-- dosis y estas advertencias". Es la versión auditable y consultable
-- en base de datos de lo que hoy vive hardcodeado como
-- `SUGERENCIAS_POR_OBJETIVO` en lib/clinica/formulacion.ts — esta
-- migración NO reemplaza esa constante ni toca formulacion.ts: sólo
-- deja preparada la infraestructura para que el Motor Inteligente de
-- Formulación (lib/clinica/mif.ts) la consulte en una iteración
-- futura (ver BIOHEALTH_ROADMAP.md). Ninguna pantalla ni ruta lee
-- todavía esta tabla.
--
-- Reutiliza exactamente los mismos patrones ya establecidos en 0024
-- (Base de Conocimiento Clínica de principios activos):
--   - tenant_id NULL = catálogo compartido, uuid = privado del tenant
--     (mismo patrón que catalogo_formulacion/principios_activos).
--   - Ciclo de vida borrador/en_revision/validado/archivado, con el
--     mismo CHECK de seguridad clínica (validado exige validado_por +
--     validado_en) — ninguna indicación incompleta puede presentarse
--     como validada.
--   - Historial append-only (historial_conocimiento_clinico), sin
--     policy de update/delete — igual que historial_principios_activos.
--   - RLS reutiliza fn_tenant_actual()/fn_puede_administrar_conocimiento()
--     ya creadas en 0024: sólo medico_titular administra, cualquier
--     usuario autenticado del tenant (o catálogo compartido) puede leer.
--
-- Idempotente y no destructiva: sólo `create table/index/policy if not
-- exists`, `drop policy if exists` + recrear, sin ningún DROP TABLE ni
-- DELETE. No agrega columnas a ninguna tabla existente y no toca
-- ninguna política de una tabla del flujo clínico ya en uso.

-- ==================== conocimiento_clinico ====================
create table if not exists conocimiento_clinico (
  id uuid primary key default gen_random_uuid(),

  -- NULL = catálogo compartido entre tenants; UUID = entrada privada
  -- de un consultorio (mismo patrón que principios_activos, 0024).
  tenant_id uuid references tenants(id),

  principio_activo_id uuid not null references principios_activos(id) on delete cascade,

  -- Texto libre, igual que objetivos_terapeuticos.objetivos: no existe
  -- un catálogo cerrado de objetivos en el proyecto todavía.
  objetivo_terapeutico text not null,

  -- Mismo enum de fase que fases_terapeuticas/objetivos_terapeuticos/
  -- formulaciones_terapeuticas (0010/0011/0012).
  fase text not null check (fase in ('restore', 'repair', 'reset', 'target', 'regenerate', 'balance')),

  -- Mismo enum que lib/clinica/patrones.ts (`Prioridad`).
  prioridad text not null default 'media' check (prioridad in ('baja', 'media', 'alta', 'urgente')),

  evidencia text,
  nivel_evidencia text check (nivel_evidencia is null or nivel_evidencia in ('A', 'B', 'C', 'D')),

  -- Dosis + unidad explícita — nunca un número sin unidad (ver
  -- BIOHEALTH_DESIGN_PRINCIPLES.md, sección de seguridad clínica).
  dosis_habitual numeric check (dosis_habitual is null or dosis_habitual > 0),
  dosis_minima numeric check (dosis_minima is null or dosis_minima > 0),
  dosis_maxima numeric check (dosis_maxima is null or dosis_maxima > 0),
  unidad_dosis text check (unidad_dosis is null or unidad_dosis in ('mg', 'g', 'mcg', 'ui', 'ml')),

  -- Mismo catálogo de horarios que lib/clinica/formulacion.ts (`Horario`).
  horario text check (horario is null or horario in ('ayunas', 'desayuno', 'almuerzo', 'cena', 'antes_de_dormir')),

  observaciones text,
  contraindicaciones text[] not null default '{}'::text[],
  interacciones text[] not null default '{}'::text[],

  requiere_sobre boolean not null default false,
  requiere_capsula boolean not null default false,
  -- Ambas nunca true a la vez: son formas farmacéuticas mutuamente excluyentes para una misma indicación.
  check (not (requiere_sobre and requiere_capsula)),

  -- Orden de sugerencia dentro del mismo objetivo+fase (menor = más prioritario).
  orden_sugerido integer not null default 0,

  -- Ciclo de vida clínico — idéntico al de principios_activos (0024):
  -- sólo 'validado' puede alimentar un motor clínico (el MIF).
  estado text not null default 'borrador'
    check (estado in ('borrador', 'en_revision', 'validado', 'archivado')),
  pendiente_validacion boolean not null default true,
  fecha_revision date,

  -- NULL = sin usuario real detrás (no aplica todavía; esta migración no siembra datos).
  creado_por uuid,
  actualizado_por uuid,
  revisado_por uuid,
  validado_por uuid,
  validado_en timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (dosis_minima is null or dosis_maxima is null or dosis_maxima >= dosis_minima),
  check (estado <> 'validado' or (validado_por is not null and validado_en is not null))
);

-- Evita indicaciones duplicadas para el mismo principio+objetivo+fase
-- dentro del mismo catálogo (compartido o de un tenant).
create unique index if not exists ux_conocimiento_clinico_principio_objetivo_fase
  on conocimiento_clinico (
    coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    principio_activo_id,
    objetivo_terapeutico,
    fase
  );

create index if not exists ix_conocimiento_clinico_tenant on conocimiento_clinico (tenant_id);
create index if not exists ix_conocimiento_clinico_principio on conocimiento_clinico (principio_activo_id);
create index if not exists ix_conocimiento_clinico_estado on conocimiento_clinico (estado);
-- Patrón de consulta principal que usará el MIF: candidatos validados por objetivo+fase, en orden de sugerencia.
create index if not exists ix_conocimiento_clinico_objetivo_fase on conocimiento_clinico (objetivo_terapeutico, fase, orden_sugerido);

drop trigger if exists trg_conocimiento_clinico_updated_at on conocimiento_clinico;
create trigger trg_conocimiento_clinico_updated_at
  before update on conocimiento_clinico
  for each row execute function fn_historia_updated_at();

alter table conocimiento_clinico enable row level security;
drop policy if exists conocimiento_clinico_select on conocimiento_clinico;
drop policy if exists conocimiento_clinico_insert on conocimiento_clinico;
drop policy if exists conocimiento_clinico_update on conocimiento_clinico;
create policy conocimiento_clinico_select on conocimiento_clinico for select to authenticated
  using (tenant_id is null or tenant_id = fn_tenant_actual());
create policy conocimiento_clinico_insert on conocimiento_clinico for insert to authenticated
  with check (fn_puede_administrar_conocimiento() and (tenant_id is null or tenant_id = fn_tenant_actual()));
create policy conocimiento_clinico_update on conocimiento_clinico for update to authenticated
  using (fn_puede_administrar_conocimiento() and (tenant_id is null or tenant_id = fn_tenant_actual()))
  with check (fn_puede_administrar_conocimiento() and (tenant_id is null or tenant_id = fn_tenant_actual()));
-- Sin policy de delete: una indicación no se borra físicamente, se archiva (estado='archivado').

-- ==================== historial_conocimiento_clinico ====================
-- Auditoría append-only, mismo patrón que historial_principios_activos (0024).
create table if not exists historial_conocimiento_clinico (
  id uuid primary key default gen_random_uuid(),
  conocimiento_id uuid not null references conocimiento_clinico(id) on delete cascade,
  accion text not null check (accion in ('creado', 'editado', 'revisado', 'validado', 'archivado', 'restaurado')),
  campo_modificado text,
  valor_anterior text,
  valor_nuevo text,
  realizado_por uuid,
  created_at timestamptz not null default now()
);
create index if not exists ix_historial_conocimiento_clinico_conocimiento on historial_conocimiento_clinico (conocimiento_id, created_at desc);
alter table historial_conocimiento_clinico enable row level security;
drop policy if exists historial_conocimiento_clinico_select on historial_conocimiento_clinico;
drop policy if exists historial_conocimiento_clinico_insert on historial_conocimiento_clinico;
create policy historial_conocimiento_clinico_select on historial_conocimiento_clinico for select to authenticated
  using (exists (select 1 from conocimiento_clinico c where c.id = conocimiento_id and (c.tenant_id is null or c.tenant_id = fn_tenant_actual())));
create policy historial_conocimiento_clinico_insert on historial_conocimiento_clinico for insert to authenticated
  with check (fn_puede_administrar_conocimiento() and realizado_por = auth.uid());
-- Sin policy de update/delete: es un log de sólo-inserción.
