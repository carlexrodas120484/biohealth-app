-- 0012_catalogo_formulacion.sql
-- Catálogo de apoyo para formulación.
-- No prescribe ni calcula dosis clínicas automáticamente.

create table if not exists catalogo_formulacion (
  id uuid primary key default gen_random_uuid(),

  -- NULL = catálogo compartido.
  -- UUID = catálogo privado del consultorio.
  tenant_id uuid references tenants(id) on delete cascade,

  nombre text not null,
  sinonimos text[] not null default '{}'::text[],
  categoria text,
  objetivos text[] not null default '{}'::text[],

  -- Se completan solamente después de validar la fuente.
  dosis_referencia_min numeric,
  dosis_referencia_max numeric,
  unidad_referencia text,
  frecuencia_referencia text,
  limite_superior_referencia numeric,

  presentacion_preferida text not null default 'individualizar'
    check (
      presentacion_preferida in (
        'capsula',
        'sobre',
        'liquido',
        'individualizar'
      )
    ),

  capacidad_capsula_mg numeric not null default 500
    check (capacidad_capsula_mg > 0),

  amargor smallint not null default 0
    check (amargor between 0 and 5),

  sabor text,
  soluble_en_agua boolean,

  compatibilidades text[] not null default '{}'::text[],
  incompatibilidades text[] not null default '{}'::text[],
  contraindicaciones text[] not null default '{}'::text[],
  interacciones text[] not null default '{}'::text[],
  advertencias text[] not null default '{}'::text[],

  nivel_evidencia text not null default 'no_clasificada'
    check (
      nivel_evidencia in (
        'alta',
        'moderada',
        'baja',
        'material_docente',
        'no_clasificada'
      )
    ),

  fuente_titulo text,
  fuente_autor text,
  fuente_anio integer,
  fuente_pagina text,

  verificado boolean not null default false,
  requiere_individualizacion boolean not null default true,
  activo boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    dosis_referencia_min is null
    or dosis_referencia_min >= 0
  ),

  check (
    dosis_referencia_max is null
    or dosis_referencia_max >= 0
  ),

  check (
    dosis_referencia_min is null
    or dosis_referencia_max is null
    or dosis_referencia_max >= dosis_referencia_min
  ),

  check (
    limite_superior_referencia is null
    or limite_superior_referencia >= 0
  )
);

create unique index if not exists ux_catalogo_formulacion_nombre_tenant
  on catalogo_formulacion (
    coalesce(
      tenant_id,
      '00000000-0000-0000-0000-000000000000'::uuid
    ),
    lower(nombre)
  );

create index if not exists ix_catalogo_formulacion_tenant
  on catalogo_formulacion (tenant_id);

create index if not exists ix_catalogo_formulacion_activo
  on catalogo_formulacion (activo);

drop trigger if exists trg_catalogo_formulacion_updated_at
  on catalogo_formulacion;

create trigger trg_catalogo_formulacion_updated_at
  before update on catalogo_formulacion
  for each row
  execute function fn_historia_updated_at();

alter table catalogo_formulacion
  enable row level security;

drop policy if exists catalogo_formulacion_select
  on catalogo_formulacion;

drop policy if exists catalogo_formulacion_insert
  on catalogo_formulacion;

drop policy if exists catalogo_formulacion_update
  on catalogo_formulacion;

drop policy if exists catalogo_formulacion_delete
  on catalogo_formulacion;

create policy catalogo_formulacion_select
  on catalogo_formulacion
  for select
  to authenticated
  using (
    tenant_id is null
    or tenant_id = (
      select u.tenant_id
      from usuarios u
      where u.auth_id = auth.uid()
    )
  );

create policy catalogo_formulacion_insert
  on catalogo_formulacion
  for insert
  to authenticated
  with check (
    tenant_id = (
      select u.tenant_id
      from usuarios u
      where u.auth_id = auth.uid()
    )
  );

create policy catalogo_formulacion_update
  on catalogo_formulacion
  for update
  to authenticated
  using (
    tenant_id = (
      select u.tenant_id
      from usuarios u
      where u.auth_id = auth.uid()
    )
  )
  with check (
    tenant_id = (
      select u.tenant_id
      from usuarios u
      where u.auth_id = auth.uid()
    )
  );

create policy catalogo_formulacion_delete
  on catalogo_formulacion
  for delete
  to authenticated
  using (
    tenant_id = (
      select u.tenant_id
      from usuarios u
      where u.auth_id = auth.uid()
    )
  );

-- Esta función NO recomienda una dosis.
-- Solo decide la presentación después de que el médico
-- haya indicado la cantidad total por toma.
create or replace function sugerir_presentacion_formulacion(
  p_dosis_total_mg numeric,
  p_capacidad_capsula_mg numeric default 500,
  p_amargor smallint default 0
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_capsulas integer;
  v_presentacion text;
  v_enmascarar_sabor boolean;
begin
  if p_dosis_total_mg is null
     or p_dosis_total_mg <= 0 then
    raise exception
      'La dosis total debe ser mayor que cero';
  end if;

  if p_capacidad_capsula_mg is null
     or p_capacidad_capsula_mg <= 0 then
    raise exception
      'La capacidad de la cápsula debe ser mayor que cero';
  end if;

  if p_amargor is null
     or p_amargor < 0
     or p_amargor > 5 then
    raise exception
      'El amargor debe estar entre 0 y 5';
  end if;

  v_capsulas :=
    ceil(
      p_dosis_total_mg / p_capacidad_capsula_mg
    )::integer;

  v_presentacion :=
    case
      when v_capsulas > 2 then 'sobre'
      else 'capsula'
    end;

  v_enmascarar_sabor :=
    v_presentacion = 'sobre'
    and p_amargor >= 3;

  return jsonb_build_object(
    'capsulas_estimadas_por_toma',
    v_capsulas,

    'presentacion_sugerida',
    v_presentacion,

    'requiere_enmascarar_sabor',
    v_enmascarar_sabor,

    'aviso',
    'Solo estima la presentación a partir de una dosis ya definida. No calcula ni recomienda dosis clínicas; requiere revisión médica y farmacéutica.'
  );
end;
$$;

grant select, insert, update, delete
  on catalogo_formulacion
  to authenticated;

grant execute
  on function sugerir_presentacion_formulacion(
    numeric,
    numeric,
    smallint
  )
  to authenticated;

comment on table catalogo_formulacion is
  'Catálogo de apoyo para formulación. No sustituye la prescripción, validación clínica ni revisión farmacéutica.';

comment on column catalogo_formulacion.tenant_id is
  'NULL significa entrada compartida; UUID significa entrada privada del consultorio.';

comment on function sugerir_presentacion_formulacion(
  numeric,
  numeric,
  smallint
) is
  'Estima cápsula o sobre desde una dosis ya definida; no recomienda dosis.';
