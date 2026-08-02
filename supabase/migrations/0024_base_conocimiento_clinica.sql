-- Base de Conocimiento Clínica BioHealth V1
--
-- Infraestructura normalizada y auditable para principios activos,
-- dosis, evidencia, interacciones, contraindicaciones y reglas de
-- formulación. NO genera recomendaciones clínicas autónomas ni
-- prescripciones automáticas: es sólo la fuente de datos estructurada
-- que un profesional revisa, valida y usa como referencia.
--
-- Relación con lo existente: no reemplaza `catalogo_formulacion`
-- (0012) — esa tabla sigue existiendo y el motor de formulación sigue
-- pudiendo leerla; ninguna receta ya guardada depende de esta
-- migración. Lo que sí hace `app/api/pacientes/[id]/formulacion` a
-- partir de ahora es sumar, además de `catalogo_formulacion`, los
-- principios de `principios_activos` que estén en estado 'validado'
-- (ver lib/clinica/baseConocimiento.ts). Un principio en cualquier
-- otro estado (borrador/en_revision/archivado) es invisible para el
-- motor clínico, aunque sea visible en el panel administrativo.
--
-- Idempotente y no destructiva: sólo `create table if not exists`,
-- `create index/policy if not exists` + `drop policy if exists` antes
-- de recrearlas, sin ningún DROP TABLE ni DELETE.

-- ==================== Funciones de apoyo para RLS ====================
-- Centralizan la resolución de tenant_id/rol del usuario autenticado
-- para no repetir la subconsulta en cada una de las ~17 tablas nuevas
-- (mismo patrón que ya usa el resto del proyecto, sólo que acá con
-- tantas tablas conviene una función en vez de copiar la subconsulta
-- seis veces por tabla).

create or replace function fn_tenant_actual() returns uuid
language sql stable as $$
  select u.tenant_id from usuarios u where u.auth_id = auth.uid()
$$;

create or replace function fn_rol_actual() returns text
language sql stable as $$
  select u.rol from usuarios u where u.auth_id = auth.uid()
$$;

-- Sólo medico_titular administra la base de conocimiento (crear,
-- editar, revisar, validar, archivar, importar). Lectura sí está
-- abierta a cualquier usuario autenticado del tenant (o catálogo
-- compartido), igual que ya funciona `catalogo_formulacion`.
create or replace function fn_puede_administrar_conocimiento() returns boolean
language sql stable as $$
  select fn_rol_actual() = 'medico_titular'
$$;

-- ==================== 1) categorias_clinicas ====================
create table if not exists categorias_clinicas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text not null default '',
  created_at timestamptz not null default now()
);
alter table categorias_clinicas enable row level security;
drop policy if exists categorias_clinicas_select on categorias_clinicas;
drop policy if exists categorias_clinicas_write on categorias_clinicas;
create policy categorias_clinicas_select on categorias_clinicas for select to authenticated using (true);
create policy categorias_clinicas_write on categorias_clinicas for all to authenticated
  using (fn_puede_administrar_conocimiento()) with check (fn_puede_administrar_conocimiento());

-- ==================== 2) referencias_bibliograficas ====================
create table if not exists referencias_bibliograficas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  autor text,
  anio integer check (anio is null or anio between 1900 and 2100),
  tema text,
  nivel_evidencia text check (nivel_evidencia in ('A', 'B', 'C', 'D')),
  estado text not null default 'solo_referencia'
    check (estado in ('vigente', 'revisar_vigencia', 'solo_referencia')),
  url text,
  notas text,
  created_at timestamptz not null default now()
);
alter table referencias_bibliograficas enable row level security;
drop policy if exists referencias_bibliograficas_select on referencias_bibliograficas;
drop policy if exists referencias_bibliograficas_write on referencias_bibliograficas;
create policy referencias_bibliograficas_select on referencias_bibliograficas for select to authenticated using (true);
create policy referencias_bibliograficas_write on referencias_bibliograficas for all to authenticated
  using (fn_puede_administrar_conocimiento()) with check (fn_puede_administrar_conocimiento());

-- ==================== 3) principios_activos (tabla central) ====================
create table if not exists principios_activos (
  id uuid primary key default gen_random_uuid(),

  -- NULL = catálogo compartido entre tenants; UUID = entrada privada
  -- de un consultorio. Mismo patrón que catalogo_formulacion (0012).
  tenant_id uuid references tenants(id),

  nombre_canonico text not null,
  nombre_comercial text,
  descripcion text,
  mecanismo_accion text,
  funciones_clinicas text[] not null default '{}'::text[],
  sistemas_relacionados text[] not null default '{}'::text[],

  -- Límites y precauciones — cada uno puede quedar NULL/false si no
  -- hay dato confiable todavía; NUNCA se asume seguro por omisión.
  limite_edad_min_anios integer check (limite_edad_min_anios is null or limite_edad_min_anios >= 0),
  limite_edad_max_anios integer check (limite_edad_max_anios is null or limite_edad_max_anios >= 0),
  limite_peso_min_kg numeric check (limite_peso_min_kg is null or limite_peso_min_kg >= 0),
  limite_peso_max_kg numeric check (limite_peso_max_kg is null or limite_peso_max_kg >= 0),
  limite_renal text,
  limite_hepatico text,
  contraindicado_embarazo boolean,
  contraindicado_lactancia boolean,
  contraindicado_oncologico boolean,
  precaucion_anticoagulacion boolean not null default false,
  precaucion_antihipertensivos boolean not null default false,
  precaucion_hipoglucemiantes boolean not null default false,

  -- Estado de validación clínica — el corazón de la seguridad de esta
  -- base: sólo 'validado' puede alimentar un motor clínico.
  estado text not null default 'borrador'
    check (estado in ('borrador', 'en_revision', 'validado', 'archivado')),
  version integer not null default 1,
  pendiente_validacion boolean not null default true,
  fecha_revision date,

  -- NULL = sembrado por una migración (sin usuario real detrás,
  -- p.ej. la semilla inicial de principios frecuentes); un registro
  -- creado desde el panel siempre trae el uuid del médico autenticado.
  creado_por uuid,
  actualizado_por uuid,
  revisado_por uuid,
  validado_por uuid,
  validado_en timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (limite_edad_min_anios is null or limite_edad_max_anios is null or limite_edad_max_anios >= limite_edad_min_anios),
  check (limite_peso_min_kg is null or limite_peso_max_kg is null or limite_peso_max_kg >= limite_peso_min_kg),
  -- Un registro validado siempre tiene quién lo validó y cuándo.
  check (estado <> 'validado' or (validado_por is not null and validado_en is not null))
);

create unique index if not exists ux_principios_activos_tenant_nombre
  on principios_activos (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre_canonico));
create index if not exists ix_principios_activos_tenant on principios_activos (tenant_id);
create index if not exists ix_principios_activos_estado on principios_activos (estado);
create index if not exists ix_principios_activos_busqueda on principios_activos
  using gin (to_tsvector('spanish', coalesce(nombre_canonico, '') || ' ' || coalesce(nombre_comercial, '')));

drop trigger if exists trg_principios_activos_updated_at on principios_activos;
create trigger trg_principios_activos_updated_at
  before update on principios_activos
  for each row execute function fn_historia_updated_at();

alter table principios_activos enable row level security;
drop policy if exists principios_activos_select on principios_activos;
drop policy if exists principios_activos_insert on principios_activos;
drop policy if exists principios_activos_update on principios_activos;
create policy principios_activos_select on principios_activos for select to authenticated
  using (tenant_id is null or tenant_id = fn_tenant_actual());
create policy principios_activos_insert on principios_activos for insert to authenticated
  with check (fn_puede_administrar_conocimiento() and (tenant_id is null or tenant_id = fn_tenant_actual()));
create policy principios_activos_update on principios_activos for update to authenticated
  using (fn_puede_administrar_conocimiento() and (tenant_id is null or tenant_id = fn_tenant_actual()))
  with check (fn_puede_administrar_conocimiento() and (tenant_id is null or tenant_id = fn_tenant_actual()));
-- Sin policy de delete: un principio no se borra físicamente, se archiva (estado='archivado').

-- ==================== 4) sinonimos_principios ====================
create table if not exists sinonimos_principios (
  id uuid primary key default gen_random_uuid(),
  principio_id uuid not null references principios_activos(id) on delete cascade,
  sinonimo text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists ux_sinonimos_principios on sinonimos_principios (principio_id, lower(sinonimo));
create index if not exists ix_sinonimos_principios_texto on sinonimos_principios (lower(sinonimo));
alter table sinonimos_principios enable row level security;
drop policy if exists sinonimos_principios_select on sinonimos_principios;
drop policy if exists sinonimos_principios_write on sinonimos_principios;
create policy sinonimos_principios_select on sinonimos_principios for select to authenticated
  using (exists (select 1 from principios_activos p where p.id = principio_id and (p.tenant_id is null or p.tenant_id = fn_tenant_actual())));
create policy sinonimos_principios_write on sinonimos_principios for all to authenticated
  using (fn_puede_administrar_conocimiento()) with check (fn_puede_administrar_conocimiento());

-- ==================== 5) principio_categoria ====================
create table if not exists principio_categoria (
  principio_id uuid not null references principios_activos(id) on delete cascade,
  categoria_id uuid not null references categorias_clinicas(id) on delete cascade,
  primary key (principio_id, categoria_id)
);
alter table principio_categoria enable row level security;
drop policy if exists principio_categoria_select on principio_categoria;
drop policy if exists principio_categoria_write on principio_categoria;
create policy principio_categoria_select on principio_categoria for select to authenticated
  using (exists (select 1 from principios_activos p where p.id = principio_id and (p.tenant_id is null or p.tenant_id = fn_tenant_actual())));
create policy principio_categoria_write on principio_categoria for all to authenticated
  using (fn_puede_administrar_conocimiento()) with check (fn_puede_administrar_conocimiento());

-- ==================== 6) dosis_principios ====================
create table if not exists dosis_principios (
  id uuid primary key default gen_random_uuid(),
  principio_id uuid not null references principios_activos(id) on delete cascade,
  tipo text not null check (tipo in ('informativa', 'minima', 'usual', 'maxima')),
  valor numeric not null check (valor > 0),
  unidad text not null check (unidad in ('mg', 'g', 'mcg', 'ui', 'ml')),
  frecuencia text,
  duracion_habitual text,
  -- Toda dosis debe traer una fuente o quedar marcada explícitamente
  -- "sin evidencia cargada" — nunca se presenta como validada sin una cosa u otra.
  referencia_id uuid references referencias_bibliograficas(id),
  sin_evidencia boolean not null default true,
  notas text,
  -- NULL = valor sembrado por migración a partir de datos ya
  -- existentes en el repositorio, sin un médico autenticado detrás.
  creado_por uuid,
  created_at timestamptz not null default now(),
  check (referencia_id is not null or sin_evidencia = true)
);
create index if not exists ix_dosis_principios_principio on dosis_principios (principio_id, tipo);
alter table dosis_principios enable row level security;
drop policy if exists dosis_principios_select on dosis_principios;
drop policy if exists dosis_principios_write on dosis_principios;
create policy dosis_principios_select on dosis_principios for select to authenticated
  using (exists (select 1 from principios_activos p where p.id = principio_id and (p.tenant_id is null or p.tenant_id = fn_tenant_actual())));
create policy dosis_principios_write on dosis_principios for all to authenticated
  using (fn_puede_administrar_conocimiento()) with check (fn_puede_administrar_conocimiento());

-- ==================== 7) presentaciones_farmaceuticas ====================
create table if not exists presentaciones_farmaceuticas (
  id uuid primary key default gen_random_uuid(),
  principio_id uuid not null references principios_activos(id) on delete cascade,
  forma text not null check (forma in ('capsula', 'sobre', 'liquido', 'comercial')),
  capacidad_capsula_mg numeric check (capacidad_capsula_mg is null or capacidad_capsula_mg > 0),
  preferida boolean not null default false,
  presentacion_comercial_obligatoria boolean not null default false,
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists ix_presentaciones_farmaceuticas_principio on presentaciones_farmaceuticas (principio_id);
alter table presentaciones_farmaceuticas enable row level security;
drop policy if exists presentaciones_farmaceuticas_select on presentaciones_farmaceuticas;
drop policy if exists presentaciones_farmaceuticas_write on presentaciones_farmaceuticas;
create policy presentaciones_farmaceuticas_select on presentaciones_farmaceuticas for select to authenticated
  using (exists (select 1 from principios_activos p where p.id = principio_id and (p.tenant_id is null or p.tenant_id = fn_tenant_actual())));
create policy presentaciones_farmaceuticas_write on presentaciones_farmaceuticas for all to authenticated
  using (fn_puede_administrar_conocimiento()) with check (fn_puede_administrar_conocimiento());

-- ==================== 8) propiedades_organolepticas ====================
create table if not exists propiedades_organolepticas (
  id uuid primary key default gen_random_uuid(),
  principio_id uuid not null unique references principios_activos(id) on delete cascade,
  sabor text,
  intensidad_sabor smallint check (intensidad_sabor is null or intensidad_sabor between 0 and 5),
  olor text,
  solubilidad text,
  estabilidad text,
  notas text,
  created_at timestamptz not null default now()
);
alter table propiedades_organolepticas enable row level security;
drop policy if exists propiedades_organolepticas_select on propiedades_organolepticas;
drop policy if exists propiedades_organolepticas_write on propiedades_organolepticas;
create policy propiedades_organolepticas_select on propiedades_organolepticas for select to authenticated
  using (exists (select 1 from principios_activos p where p.id = principio_id and (p.tenant_id is null or p.tenant_id = fn_tenant_actual())));
create policy propiedades_organolepticas_write on propiedades_organolepticas for all to authenticated
  using (fn_puede_administrar_conocimiento()) with check (fn_puede_administrar_conocimiento());

-- ==================== 9) indicaciones_principios ====================
create table if not exists indicaciones_principios (
  id uuid primary key default gen_random_uuid(),
  principio_id uuid not null references principios_activos(id) on delete cascade,
  indicacion text not null,
  sistema_relacionado text,
  created_at timestamptz not null default now()
);
create index if not exists ix_indicaciones_principios_principio on indicaciones_principios (principio_id);
alter table indicaciones_principios enable row level security;
drop policy if exists indicaciones_principios_select on indicaciones_principios;
drop policy if exists indicaciones_principios_write on indicaciones_principios;
create policy indicaciones_principios_select on indicaciones_principios for select to authenticated
  using (exists (select 1 from principios_activos p where p.id = principio_id and (p.tenant_id is null or p.tenant_id = fn_tenant_actual())));
create policy indicaciones_principios_write on indicaciones_principios for all to authenticated
  using (fn_puede_administrar_conocimiento()) with check (fn_puede_administrar_conocimiento());

-- ==================== 10) contraindicaciones_principios ====================
create table if not exists contraindicaciones_principios (
  id uuid primary key default gen_random_uuid(),
  principio_id uuid not null references principios_activos(id) on delete cascade,
  contraindicacion text not null,
  severidad text not null default 'moderada' check (severidad in ('leve', 'moderada', 'alta')),
  created_at timestamptz not null default now()
);
create index if not exists ix_contraindicaciones_principios_principio on contraindicaciones_principios (principio_id);
alter table contraindicaciones_principios enable row level security;
drop policy if exists contraindicaciones_principios_select on contraindicaciones_principios;
drop policy if exists contraindicaciones_principios_write on contraindicaciones_principios;
create policy contraindicaciones_principios_select on contraindicaciones_principios for select to authenticated
  using (exists (select 1 from principios_activos p where p.id = principio_id and (p.tenant_id is null or p.tenant_id = fn_tenant_actual())));
create policy contraindicaciones_principios_write on contraindicaciones_principios for all to authenticated
  using (fn_puede_administrar_conocimiento()) with check (fn_puede_administrar_conocimiento());

-- ==================== 11) interacciones_principios ====================
create table if not exists interacciones_principios (
  id uuid primary key default gen_random_uuid(),
  principio_id uuid not null references principios_activos(id) on delete cascade,
  -- Con otro principio del catálogo, o con una sustancia/clase externa
  -- (ej. "warfarina") que todavía no está cargada como principio propio.
  principio_relacionado_id uuid references principios_activos(id),
  sustancia_externa text,
  tipo text,
  descripcion text not null,
  severidad text not null default 'moderada' check (severidad in ('leve', 'moderada', 'alta')),
  created_at timestamptz not null default now(),
  check (principio_relacionado_id is not null or sustancia_externa is not null)
);
create index if not exists ix_interacciones_principios_principio on interacciones_principios (principio_id);
alter table interacciones_principios enable row level security;
drop policy if exists interacciones_principios_select on interacciones_principios;
drop policy if exists interacciones_principios_write on interacciones_principios;
create policy interacciones_principios_select on interacciones_principios for select to authenticated
  using (exists (select 1 from principios_activos p where p.id = principio_id and (p.tenant_id is null or p.tenant_id = fn_tenant_actual())));
create policy interacciones_principios_write on interacciones_principios for all to authenticated
  using (fn_puede_administrar_conocimiento()) with check (fn_puede_administrar_conocimiento());

-- ==================== 12) incompatibilidades_formulacion ====================
create table if not exists incompatibilidades_formulacion (
  id uuid primary key default gen_random_uuid(),
  principio_id uuid not null references principios_activos(id) on delete cascade,
  principio_incompatible_id uuid not null references principios_activos(id) on delete cascade,
  motivo text,
  created_at timestamptz not null default now(),
  check (principio_id <> principio_incompatible_id)
);
create unique index if not exists ux_incompatibilidades_formulacion on incompatibilidades_formulacion (principio_id, principio_incompatible_id);
alter table incompatibilidades_formulacion enable row level security;
drop policy if exists incompatibilidades_formulacion_select on incompatibilidades_formulacion;
drop policy if exists incompatibilidades_formulacion_write on incompatibilidades_formulacion;
create policy incompatibilidades_formulacion_select on incompatibilidades_formulacion for select to authenticated
  using (exists (select 1 from principios_activos p where p.id = principio_id and (p.tenant_id is null or p.tenant_id = fn_tenant_actual())));
create policy incompatibilidades_formulacion_write on incompatibilidades_formulacion for all to authenticated
  using (fn_puede_administrar_conocimiento()) with check (fn_puede_administrar_conocimiento());

-- ==================== 13) evidencia_cientifica ====================
create table if not exists evidencia_cientifica (
  id uuid primary key default gen_random_uuid(),
  principio_id uuid not null references principios_activos(id) on delete cascade,
  nivel_evidencia text not null check (nivel_evidencia in ('A', 'B', 'C', 'D')),
  resumen text,
  referencia_id uuid references referencias_bibliograficas(id),
  created_at timestamptz not null default now()
);
create index if not exists ix_evidencia_cientifica_principio on evidencia_cientifica (principio_id);
alter table evidencia_cientifica enable row level security;
drop policy if exists evidencia_cientifica_select on evidencia_cientifica;
drop policy if exists evidencia_cientifica_write on evidencia_cientifica;
create policy evidencia_cientifica_select on evidencia_cientifica for select to authenticated
  using (exists (select 1 from principios_activos p where p.id = principio_id and (p.tenant_id is null or p.tenant_id = fn_tenant_actual())));
create policy evidencia_cientifica_write on evidencia_cientifica for all to authenticated
  using (fn_puede_administrar_conocimiento()) with check (fn_puede_administrar_conocimiento());

-- ==================== 14) reglas_formulacion ====================
-- Reglas configurables del motor (capacidad de cápsula, umbral de
-- sobre, amargor que bloquea conversión automática) — antes vivían
-- como constantes fijas en lib/clinica/formulacion.ts. Con tenant_id
-- NULL = regla global por defecto; un tenant puede tener su propia
-- fila para personalizar sin tocar código.
create table if not exists reglas_formulacion (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  capacidad_capsula_mg_defecto numeric not null default 1000 check (capacidad_capsula_mg_defecto > 0),
  limite_capsulas_antes_de_sobre integer not null default 2 check (limite_capsulas_antes_de_sobre > 0),
  amargor_bloquea_sobre_automatico smallint not null default 3 check (amargor_bloquea_sobre_automatico between 0 and 5),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ux_reglas_formulacion_tenant
  on reglas_formulacion (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));
drop trigger if exists trg_reglas_formulacion_updated_at on reglas_formulacion;
create trigger trg_reglas_formulacion_updated_at
  before update on reglas_formulacion
  for each row execute function fn_historia_updated_at();
alter table reglas_formulacion enable row level security;
drop policy if exists reglas_formulacion_select on reglas_formulacion;
drop policy if exists reglas_formulacion_write on reglas_formulacion;
create policy reglas_formulacion_select on reglas_formulacion for select to authenticated
  using (tenant_id is null or tenant_id = fn_tenant_actual());
create policy reglas_formulacion_write on reglas_formulacion for all to authenticated
  using (fn_puede_administrar_conocimiento() and (tenant_id is null or tenant_id = fn_tenant_actual()))
  with check (fn_puede_administrar_conocimiento() and (tenant_id is null or tenant_id = fn_tenant_actual()));

insert into reglas_formulacion (tenant_id, capacidad_capsula_mg_defecto, limite_capsulas_antes_de_sobre, amargor_bloquea_sobre_automatico)
  select null, 1000, 2, 3
  where not exists (select 1 from reglas_formulacion where tenant_id is null);

-- ==================== 15) importaciones_catalogo ====================
create table if not exists importaciones_catalogo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  archivo_nombre text not null,
  importado_por uuid not null,
  filas_totales integer not null default 0,
  filas_validas integer not null default 0,
  filas_rechazadas integer not null default 0,
  estado text not null default 'previsualizado'
    check (estado in ('previsualizado', 'confirmado', 'parcial', 'cancelado')),
  created_at timestamptz not null default now()
);
create index if not exists ix_importaciones_catalogo_tenant on importaciones_catalogo (tenant_id, created_at desc);
alter table importaciones_catalogo enable row level security;
drop policy if exists importaciones_catalogo_select on importaciones_catalogo;
drop policy if exists importaciones_catalogo_insert on importaciones_catalogo;
create policy importaciones_catalogo_select on importaciones_catalogo for select to authenticated
  using (tenant_id = fn_tenant_actual());
create policy importaciones_catalogo_insert on importaciones_catalogo for insert to authenticated
  with check (fn_puede_administrar_conocimiento() and tenant_id = fn_tenant_actual() and importado_por = auth.uid());

-- ==================== 16) errores_importacion ====================
create table if not exists errores_importacion (
  id uuid primary key default gen_random_uuid(),
  importacion_id uuid not null references importaciones_catalogo(id) on delete cascade,
  numero_fila integer not null,
  columna text,
  valor text,
  mensaje_error text not null,
  created_at timestamptz not null default now()
);
create index if not exists ix_errores_importacion_importacion on errores_importacion (importacion_id);
alter table errores_importacion enable row level security;
drop policy if exists errores_importacion_select on errores_importacion;
drop policy if exists errores_importacion_insert on errores_importacion;
create policy errores_importacion_select on errores_importacion for select to authenticated
  using (exists (select 1 from importaciones_catalogo i where i.id = importacion_id and i.tenant_id = fn_tenant_actual()));
create policy errores_importacion_insert on errores_importacion for insert to authenticated
  with check (fn_puede_administrar_conocimiento() and exists (select 1 from importaciones_catalogo i where i.id = importacion_id and i.tenant_id = fn_tenant_actual()));

-- ==================== 17) historial_principios_activos ====================
-- Historial de cambios exigido por la sección de seguridad clínica:
-- nunca se borra físicamente un principio ni su historial; cada
-- creación, edición, revisión, validación o archivado queda anotada.
create table if not exists historial_principios_activos (
  id uuid primary key default gen_random_uuid(),
  principio_id uuid not null references principios_activos(id) on delete cascade,
  accion text not null check (accion in ('creado', 'editado', 'revisado', 'validado', 'archivado', 'restaurado')),
  campo_modificado text,
  valor_anterior text,
  valor_nuevo text,
  -- NULL sólo para la entrada 'creado' que deja la semilla inicial de
  -- migración; toda acción hecha desde el panel trae un uuid real.
  realizado_por uuid,
  created_at timestamptz not null default now()
);
create index if not exists ix_historial_principios_activos_principio on historial_principios_activos (principio_id, created_at desc);
alter table historial_principios_activos enable row level security;
drop policy if exists historial_principios_activos_select on historial_principios_activos;
drop policy if exists historial_principios_activos_insert on historial_principios_activos;
create policy historial_principios_activos_select on historial_principios_activos for select to authenticated
  using (exists (select 1 from principios_activos p where p.id = principio_id and (p.tenant_id is null or p.tenant_id = fn_tenant_actual())));
create policy historial_principios_activos_insert on historial_principios_activos for insert to authenticated
  with check (fn_puede_administrar_conocimiento() and realizado_por = auth.uid());
-- Sin policy de update/delete: es un log de sólo-inserción.

-- ==================== Semilla inicial: 20 principios frecuentes ====================
-- Sólo 4 (Omega-3, Curcumina, Glutamina, Zinc) tienen datos reales ya
-- existentes en el repositorio (lib/clinica/formulacion.ts —
-- SUGERENCIAS_POR_OBJETIVO, la misma referencia bibliográfica de dosis
-- que ya usaba el formulario de formulación). Quedan en 'en_revision':
-- tienen contenido, pero no pasaron por esta validación formal todavía.
-- Los otros 16 no tienen ningún dato confiable en el repo: se cargan
-- como registro vacío en 'borrador', pendiente_validacion = true, sin
-- inventar dosis ni propiedades. Nada acá queda en 'validado' —eso lo
-- decide un médico desde el panel— así que el motor de formulación no
-- usa ninguno de estos principios todavía (ver integración más abajo).

insert into referencias_bibliograficas (titulo, tema, nivel_evidencia, estado, notas)
  select 'Material docente aportado', 'Formulación ortomolecular', 'C', 'solo_referencia',
    'Etiqueta de fuente ya usada en el catálogo de sugerencias del formulario de formulación.'
  where not exists (select 1 from referencias_bibliograficas where titulo = 'Material docente aportado');

insert into referencias_bibliograficas (titulo, tema, nivel_evidencia, estado, notas)
  select 'Manual profesional; validar indicación', 'Formulación ortomolecular', 'B', 'solo_referencia',
    'Etiqueta de fuente ya usada en el catálogo de sugerencias del formulario de formulación.'
  where not exists (select 1 from referencias_bibliograficas where titulo = 'Manual profesional; validar indicación');

-- --- Omega-3 (EPA + DHA) ---
insert into principios_activos (tenant_id, nombre_canonico, descripcion, estado, pendiente_validacion)
  select null, 'Omega-3 (EPA + DHA)', 'Ácidos grasos poliinsaturados de cadena larga, objetivo clínico: disminuir inflamación.', 'en_revision', true
  where not exists (select 1 from principios_activos where tenant_id is null and lower(nombre_canonico) = lower('Omega-3 (EPA + DHA)'));

insert into dosis_principios (principio_id, tipo, valor, unidad, frecuencia, referencia_id, sin_evidencia, notas)
  select p.id, 'minima', 1, 'g', 'con comida', r.id, false, 'Rango informativo tomado de material profesional ya usado en el catálogo de formulación.'
  from principios_activos p, referencias_bibliograficas r
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Omega-3 (EPA + DHA)') and r.titulo = 'Manual profesional; validar indicación'
    and not exists (select 1 from dosis_principios d where d.principio_id = p.id and d.tipo = 'minima');
insert into dosis_principios (principio_id, tipo, valor, unidad, frecuencia, referencia_id, sin_evidencia, notas)
  select p.id, 'maxima', 2, 'g', 'con comida', r.id, false, 'Rango informativo tomado de material profesional ya usado en el catálogo de formulación.'
  from principios_activos p, referencias_bibliograficas r
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Omega-3 (EPA + DHA)') and r.titulo = 'Manual profesional; validar indicación'
    and not exists (select 1 from dosis_principios d where d.principio_id = p.id and d.tipo = 'maxima');
insert into presentaciones_farmaceuticas (principio_id, forma, preferida)
  select p.id, 'capsula', true from principios_activos p
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Omega-3 (EPA + DHA)')
    and not exists (select 1 from presentaciones_farmaceuticas pf where pf.principio_id = p.id);
insert into contraindicaciones_principios (principio_id, contraindicacion, severidad)
  select p.id, 'Revisar anticoagulantes, antiagregantes y riesgo hemorrágico.', 'alta' from principios_activos p
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Omega-3 (EPA + DHA)')
    and not exists (select 1 from contraindicaciones_principios c where c.principio_id = p.id);
update principios_activos set precaucion_anticoagulacion = true
  where tenant_id is null and lower(nombre_canonico) = lower('Omega-3 (EPA + DHA)');
insert into evidencia_cientifica (principio_id, nivel_evidencia, resumen, referencia_id)
  select p.id, 'B', 'Disminuir inflamación; validar indicación según manual profesional.', r.id
  from principios_activos p, referencias_bibliograficas r
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Omega-3 (EPA + DHA)') and r.titulo = 'Manual profesional; validar indicación'
    and not exists (select 1 from evidencia_cientifica e where e.principio_id = p.id);

-- --- Curcumina ---
insert into principios_activos (tenant_id, nombre_canonico, descripcion, estado, pendiente_validacion)
  select null, 'Curcumina', 'Polifenol derivado de la cúrcuma, objetivo clínico: disminuir inflamación.', 'en_revision', true
  where not exists (select 1 from principios_activos where tenant_id is null and lower(nombre_canonico) = lower('Curcumina'));

insert into dosis_principios (principio_id, tipo, valor, unidad, frecuencia, referencia_id, sin_evidencia, notas)
  select p.id, 'usual', 500, 'mg', '1-2 veces al día con comida', r.id, false, 'Tomado de material docente ya usado en el catálogo de formulación.'
  from principios_activos p, referencias_bibliograficas r
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Curcumina') and r.titulo = 'Material docente aportado'
    and not exists (select 1 from dosis_principios d where d.principio_id = p.id and d.tipo = 'usual');
insert into presentaciones_farmaceuticas (principio_id, forma, preferida)
  select p.id, 'capsula', true from principios_activos p
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Curcumina')
    and not exists (select 1 from presentaciones_farmaceuticas pf where pf.principio_id = p.id);
insert into contraindicaciones_principios (principio_id, contraindicacion, severidad)
  select p.id, 'Revisar anticoagulación, patología biliar e interacciones.', 'moderada' from principios_activos p
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Curcumina')
    and not exists (select 1 from contraindicaciones_principios c where c.principio_id = p.id);
update principios_activos set precaucion_anticoagulacion = true
  where tenant_id is null and lower(nombre_canonico) = lower('Curcumina');
insert into evidencia_cientifica (principio_id, nivel_evidencia, resumen, referencia_id)
  select p.id, 'C', 'Disminuir inflamación; material docente, no define dosis por sí solo.', r.id
  from principios_activos p, referencias_bibliograficas r
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Curcumina') and r.titulo = 'Material docente aportado'
    and not exists (select 1 from evidencia_cientifica e where e.principio_id = p.id);

-- --- Glutamina (L-glutamina) ---
insert into principios_activos (tenant_id, nombre_canonico, descripcion, estado, pendiente_validacion)
  select null, 'Glutamina', 'Aminoácido no esencial, objetivo clínico: reparar mucosa intestinal.', 'en_revision', true
  where not exists (select 1 from principios_activos where tenant_id is null and lower(nombre_canonico) = lower('Glutamina'));

insert into sinonimos_principios (principio_id, sinonimo)
  select p.id, 'L-glutamina' from principios_activos p
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Glutamina')
    and not exists (select 1 from sinonimos_principios s where s.principio_id = p.id and lower(s.sinonimo) = lower('L-glutamina'));
insert into dosis_principios (principio_id, tipo, valor, unidad, frecuencia, referencia_id, sin_evidencia, notas)
  select p.id, 'usual', 5, 'g', '1 vez al día, en ayunas', r.id, false, 'Tomado de material docente ya usado en el catálogo de formulación.'
  from principios_activos p, referencias_bibliograficas r
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Glutamina') and r.titulo = 'Material docente aportado'
    and not exists (select 1 from dosis_principios d where d.principio_id = p.id and d.tipo = 'usual');
insert into presentaciones_farmaceuticas (principio_id, forma, preferida)
  select p.id, 'sobre', true from principios_activos p
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Glutamina')
    and not exists (select 1 from presentaciones_farmaceuticas pf where pf.principio_id = p.id);
insert into contraindicaciones_principios (principio_id, contraindicacion, severidad)
  select p.id, 'Individualizar en enfermedad hepática, renal o contexto oncológico.', 'alta' from principios_activos p
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Glutamina')
    and not exists (select 1 from contraindicaciones_principios c where c.principio_id = p.id);
update principios_activos set contraindicado_oncologico = true, limite_renal = 'Individualizar; sin valor de corte cargado.', limite_hepatico = 'Individualizar; sin valor de corte cargado.'
  where tenant_id is null and lower(nombre_canonico) = lower('Glutamina');
insert into evidencia_cientifica (principio_id, nivel_evidencia, resumen, referencia_id)
  select p.id, 'C', 'Reparar mucosa intestinal; material docente, no define dosis por sí solo.', r.id
  from principios_activos p, referencias_bibliograficas r
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Glutamina') and r.titulo = 'Material docente aportado'
    and not exists (select 1 from evidencia_cientifica e where e.principio_id = p.id);

-- --- Zinc (dato disponible en el repo es específico de zinc-L-carnosina) ---
insert into principios_activos (tenant_id, nombre_canonico, descripcion, estado, pendiente_validacion)
  select null, 'Zinc', 'Oligoelemento. El dato de dosis cargado corresponde específicamente a la forma zinc-L-carnosina, objetivo clínico: reparar mucosa intestinal — no generalizar a otras sales de zinc sin revisión.', 'en_revision', true
  where not exists (select 1 from principios_activos where tenant_id is null and lower(nombre_canonico) = lower('Zinc'));

insert into sinonimos_principios (principio_id, sinonimo)
  select p.id, 'Zinc-L-carnosina' from principios_activos p
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Zinc')
    and not exists (select 1 from sinonimos_principios s where s.principio_id = p.id and lower(s.sinonimo) = lower('Zinc-L-carnosina'));
insert into dosis_principios (principio_id, tipo, valor, unidad, frecuencia, referencia_id, sin_evidencia, notas)
  select p.id, 'usual', 75, 'mg', '2 veces al día', r.id, false, 'Específico de zinc-L-carnosina; tomado de material docente ya usado en el catálogo de formulación.'
  from principios_activos p, referencias_bibliograficas r
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Zinc') and r.titulo = 'Material docente aportado'
    and not exists (select 1 from dosis_principios d where d.principio_id = p.id and d.tipo = 'usual');
insert into presentaciones_farmaceuticas (principio_id, forma, preferida)
  select p.id, 'capsula', true from principios_activos p
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Zinc')
    and not exists (select 1 from presentaciones_farmaceuticas pf where pf.principio_id = p.id);
insert into contraindicaciones_principios (principio_id, contraindicacion, severidad)
  select p.id, 'Considerar aporte total de zinc y uso prolongado.', 'moderada' from principios_activos p
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Zinc')
    and not exists (select 1 from contraindicaciones_principios c where c.principio_id = p.id);
insert into evidencia_cientifica (principio_id, nivel_evidencia, resumen, referencia_id)
  select p.id, 'C', 'Reparar mucosa intestinal (zinc-L-carnosina); material docente, no define dosis por sí solo.', r.id
  from principios_activos p, referencias_bibliograficas r
  where p.tenant_id is null and lower(p.nombre_canonico) = lower('Zinc') and r.titulo = 'Material docente aportado'
    and not exists (select 1 from evidencia_cientifica e where e.principio_id = p.id);

-- --- Los 16 restantes: sin dato confiable en el repo. Se cargan
-- vacíos, en 'borrador', pendiente_validacion = true. Ningún campo se
-- completa por conocimiento supuesto. ---
insert into principios_activos (tenant_id, nombre_canonico, estado, pendiente_validacion)
select null, nombre, 'borrador', true
from unnest(array[
  'Magnesio', 'Vitamina D3', 'Vitamina K2', 'Vitamina C', 'Selenio',
  'Berberina', 'NAC (N-acetilcisteína)', 'Coenzima Q10', 'Resveratrol',
  'Psyllium', 'Inositol', 'Glicina', 'Quercetina', 'Complejo B', 'Silimarina', 'Colina'
]) as nombre
where not exists (
  select 1 from principios_activos where tenant_id is null and lower(nombre_canonico) = lower(nombre)
);

-- Deja constancia en el historial de que la semilla creó estos 20
-- registros, sin atribuirlo a un usuario real (ver comentario en la
-- definición de la columna `realizado_por`).
insert into historial_principios_activos (principio_id, accion, valor_nuevo, realizado_por)
select p.id, 'creado', p.estado, null
from principios_activos p
where p.tenant_id is null
  and lower(p.nombre_canonico) in (
    lower('Omega-3 (EPA + DHA)'), lower('Curcumina'), lower('Glutamina'), lower('Zinc'),
    lower('Magnesio'), lower('Vitamina D3'), lower('Vitamina K2'), lower('Vitamina C'), lower('Selenio'),
    lower('Berberina'), lower('NAC (N-acetilcisteína)'), lower('Coenzima Q10'), lower('Resveratrol'),
    lower('Psyllium'), lower('Inositol'), lower('Glicina'), lower('Quercetina'), lower('Complejo B'),
    lower('Silimarina'), lower('Colina')
  )
  and not exists (select 1 from historial_principios_activos h where h.principio_id = p.id and h.accion = 'creado');
