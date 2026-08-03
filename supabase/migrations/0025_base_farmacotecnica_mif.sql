-- Base Farmacotécnica Inteligente — datos para el Motor Inteligente de
-- Formulación (MIF).
--
-- Esta migración es puramente ADITIVA sobre la Base de Conocimiento
-- Clínica (0024): amplía columnas existentes con valores por defecto
-- retrocompatibles, agrega columnas nuevas, y crea tablas nuevas. No
-- toca ninguna tabla del flujo clínico existente (historias_clinicas,
-- diagnosticos_funcionales, ipt_evaluaciones, fases_terapeuticas,
-- objetivos_terapeuticos, formulaciones_terapeuticas, planes_*,
-- catalogo_formulacion) ni sus políticas RLS — el MIF sólo LEE esas
-- tablas (ver lib/repositorios/baseFarmacotecnica.ts), nunca las
-- modifica ni les agrega columnas.
--
-- El motor de reglas actual (lib/clinica/formulacion.ts) y la ruta
-- app/api/pacientes/[id]/formulacion/route.ts siguen funcionando
-- exactamente igual: no leen ninguna de las columnas/tablas nuevas de
-- esta migración. El MIF (lib/clinica/mif.ts) es un servicio nuevo y
-- separado, sin pantalla ni ruta propia todavía (ver
-- BIOHEALTH_ROADMAP.md) — sólo un servicio de lectura que genera una
-- sugerencia de receta, sin persistir nada por su cuenta.
--
-- Idempotente y no destructiva: sólo `create table/column if not
-- exists`, `drop constraint/policy if exists` + recrear, sin ningún
-- DROP TABLE ni DELETE.

-- ==================== 1) Identificación: nombre científico ====================
-- Distinto de nombre_comercial (marca/producto) y de nombre_canonico
-- (nombre de trabajo, ej. "Curcumina"): el nombre científico es el
-- nombre taxonómico/químico de referencia (ej. "Curcuma longa").
alter table principios_activos
  add column if not exists nombre_cientifico text;

-- ==================== 2) Presentación farmacéutica: nuevas formas + capsulación ====================
-- Amplía las formas farmacéuticas válidas (antes: capsula/sobre/
-- liquido/comercial) para cubrir perlas, polvo y comprimidos, tal como
-- pide la Base Farmacotécnica. Ampliar un CHECK con más valores
-- permitidos es retrocompatible: ningún dato existente queda inválido.
alter table presentaciones_farmaceuticas
  drop constraint if exists presentaciones_farmaceuticas_forma_check;
alter table presentaciones_farmaceuticas
  add constraint presentaciones_farmaceuticas_forma_check
  check (forma in ('capsula', 'sobre', 'liquido', 'perlas', 'polvo', 'comprimidos', 'comercial'));

-- CAPSULACIÓN: tamaño de cápsula recomendado (ej. "00", "0", "1") y
-- número máximo de cápsulas por toma específico de este principio —
-- si es NULL, rige el límite global de reglas_formulacion (por
-- defecto 2, Regla 1 del MIF).
alter table presentaciones_farmaceuticas
  add column if not exists tamano_capsula text,
  add column if not exists max_capsulas_por_toma integer
    check (max_capsulas_por_toma is null or max_capsulas_por_toma > 0);

-- ==================== 3) Perfil organoléptico: tipo, intensidad categórica, enmascarado ====================
-- No reemplaza `intensidad_sabor` (smallint 0-5, ya usado por el
-- puente hacia el motor de formulación existente en
-- lib/clinica/baseConocimiento.ts) — lo complementa con la
-- clasificación categórica que pide el MIF.
alter table propiedades_organolepticas
  add column if not exists tipo_sabor text
    check (tipo_sabor is null or tipo_sabor in ('amargo', 'acido', 'salado', 'sulfuroso', 'terroso', 'neutro')),
  add column if not exists intensidad_categoria text
    check (intensidad_categoria is null or intensidad_categoria in ('baja', 'media', 'alta', 'extrema')),
  add column if not exists facilidad_enmascarar text
    check (facilidad_enmascarar is null or facilidad_enmascarar in ('facil', 'media', 'dificil'));

-- ==================== 4) farmacotecnia_principios ====================
-- Compatibilidad con cada forma farmacéutica y sensibilidades físico-
-- químicas. Es una tabla separada de `propiedades_organolepticas`
-- (que es específicamente sabor/olor) porque son datos de una
-- naturaleza distinta: uno es percepción del paciente, el otro es
-- comportamiento físico-químico del principio.
create table if not exists farmacotecnia_principios (
  id uuid primary key default gen_random_uuid(),
  principio_id uuid not null unique references principios_activos(id) on delete cascade,
  -- NULL = sin dato cargado todavía; nunca se asume compatible por omisión.
  compatible_sobres boolean,
  compatible_liquidos boolean,
  compatible_capsulas boolean,
  higroscopico boolean,
  fotosensible boolean,
  sensible_calor boolean,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_farmacotecnia_principios_updated_at on farmacotecnia_principios;
create trigger trg_farmacotecnia_principios_updated_at
  before update on farmacotecnia_principios
  for each row execute function fn_historia_updated_at();
alter table farmacotecnia_principios enable row level security;
drop policy if exists farmacotecnia_principios_select on farmacotecnia_principios;
drop policy if exists farmacotecnia_principios_write on farmacotecnia_principios;
create policy farmacotecnia_principios_select on farmacotecnia_principios for select to authenticated
  using (exists (select 1 from principios_activos p where p.id = principio_id and (p.tenant_id is null or p.tenant_id = fn_tenant_actual())));
create policy farmacotecnia_principios_write on farmacotecnia_principios for all to authenticated
  using (fn_puede_administrar_conocimiento()) with check (fn_puede_administrar_conocimiento());

-- ==================== 5) compatibilidades_formulacion ====================
-- Compatibilidades explícitas conocidas entre dos principios —
-- complementa (no reemplaza) `incompatibilidades_formulacion` (0024):
-- la ausencia de una incompatibilidad registrada NO significa
-- compatibilidad confirmada; esta tabla es para cuando sí hay
-- evidencia positiva de que dos principios se pueden formular juntos.
create table if not exists compatibilidades_formulacion (
  id uuid primary key default gen_random_uuid(),
  principio_id uuid not null references principios_activos(id) on delete cascade,
  principio_compatible_id uuid not null references principios_activos(id) on delete cascade,
  notas text,
  created_at timestamptz not null default now(),
  check (principio_id <> principio_compatible_id)
);
create unique index if not exists ux_compatibilidades_formulacion on compatibilidades_formulacion (principio_id, principio_compatible_id);
alter table compatibilidades_formulacion enable row level security;
drop policy if exists compatibilidades_formulacion_select on compatibilidades_formulacion;
drop policy if exists compatibilidades_formulacion_write on compatibilidades_formulacion;
create policy compatibilidades_formulacion_select on compatibilidades_formulacion for select to authenticated
  using (exists (select 1 from principios_activos p where p.id = principio_id and (p.tenant_id is null or p.tenant_id = fn_tenant_actual())));
create policy compatibilidades_formulacion_write on compatibilidades_formulacion for all to authenticated
  using (fn_puede_administrar_conocimiento()) with check (fn_puede_administrar_conocimiento());

-- ==================== 6) sabores_principios ====================
-- Sabores compatibles de la botica para enmascarar/formular este
-- principio, con un nivel de aceptación (1-5) que alimenta la Regla 4
-- del MIF ("sugerir automáticamente el sabor con mayor aceptación").
-- El catálogo de sabores es cerrado: los 8 disponibles en la botica.
create table if not exists sabores_principios (
  id uuid primary key default gen_random_uuid(),
  principio_id uuid not null references principios_activos(id) on delete cascade,
  sabor text not null check (sabor in ('naranja', 'mandarina', 'limon', 'uva', 'pina', 'frutilla', 'durazno', 'mburucuya')),
  nivel_aceptacion smallint not null default 3 check (nivel_aceptacion between 1 and 5),
  notas text,
  created_at timestamptz not null default now()
);
create unique index if not exists ux_sabores_principios on sabores_principios (principio_id, sabor);
create index if not exists ix_sabores_principios_principio on sabores_principios (principio_id);
alter table sabores_principios enable row level security;
drop policy if exists sabores_principios_select on sabores_principios;
drop policy if exists sabores_principios_write on sabores_principios;
create policy sabores_principios_select on sabores_principios for select to authenticated
  using (exists (select 1 from principios_activos p where p.id = principio_id and (p.tenant_id is null or p.tenant_id = fn_tenant_actual())));
create policy sabores_principios_write on sabores_principios for all to authenticated
  using (fn_puede_administrar_conocimiento()) with check (fn_puede_administrar_conocimiento());

-- ==================== 7) preferencias_formulacion_paciente ====================
-- Preferencias del paciente que influyen en la Regla 5 del MIF (sabor
-- preferido tiene prioridad) y en la elección de presentación. Sigue
-- el mismo patrón de las demás tablas clínicas por-paciente
-- (diagnosticos_funcionales, ipt_evaluaciones, fases_terapeuticas,
-- objetivos_terapeuticos): una fila activa por paciente, lectura para
-- cualquier usuario autenticado del tenant, escritura exige paciente
-- activo del mismo tenant. A diferencia de la Base de Conocimiento,
-- esto es parte del registro clínico del paciente, no un catálogo
-- administrado sólo por medico_titular — cualquier profesional que
-- atiende al paciente puede registrar sus preferencias.
create table if not exists preferencias_formulacion_paciente (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  paciente_id uuid not null references pacientes(id),
  sabor_favorito text check (sabor_favorito is null or sabor_favorito in ('naranja', 'mandarina', 'limon', 'uva', 'pina', 'frutilla', 'durazno', 'mburucuya')),
  sabores_rechazados text[] not null default '{}'::text[]
    check (sabores_rechazados <@ array['naranja', 'mandarina', 'limon', 'uva', 'pina', 'frutilla', 'durazno', 'mburucuya']::text[]),
  dificultad_tragar_capsulas text check (dificultad_tragar_capsulas is null or dificultad_tragar_capsulas in ('si', 'no', 'parcial')),
  preferencia_forma text check (preferencia_forma is null or preferencia_forma in ('capsula', 'sobre', 'liquido')),
  notas text,
  actualizado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, paciente_id),
  -- El sabor favorito nunca puede estar también en la lista de rechazados.
  check (sabor_favorito is null or not (sabor_favorito = any(sabores_rechazados)))
);
create index if not exists ix_preferencias_formulacion_paciente_tenant on preferencias_formulacion_paciente (tenant_id);
create index if not exists ix_preferencias_formulacion_paciente_paciente on preferencias_formulacion_paciente (paciente_id);
drop trigger if exists trg_preferencias_formulacion_paciente_updated_at on preferencias_formulacion_paciente;
create trigger trg_preferencias_formulacion_paciente_updated_at
  before update on preferencias_formulacion_paciente
  for each row execute function fn_historia_updated_at();
alter table preferencias_formulacion_paciente enable row level security;
drop policy if exists preferencias_formulacion_paciente_select on preferencias_formulacion_paciente;
drop policy if exists preferencias_formulacion_paciente_insert on preferencias_formulacion_paciente;
drop policy if exists preferencias_formulacion_paciente_update on preferencias_formulacion_paciente;
create policy preferencias_formulacion_paciente_select on preferencias_formulacion_paciente for select to authenticated
  using (tenant_id = fn_tenant_actual());
create policy preferencias_formulacion_paciente_insert on preferencias_formulacion_paciente for insert to authenticated
  with check (
    tenant_id = fn_tenant_actual()
    and exists (select 1 from pacientes p where p.id = paciente_id and p.tenant_id = preferencias_formulacion_paciente.tenant_id and p.deleted_at is null)
  );
create policy preferencias_formulacion_paciente_update on preferencias_formulacion_paciente for update to authenticated
  using (tenant_id = fn_tenant_actual())
  with check (tenant_id = fn_tenant_actual());
-- Sin policy de delete: se corrige con un nuevo UPDATE, no se borra el registro de preferencias.
