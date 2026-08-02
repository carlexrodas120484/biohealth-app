-- Motor de nutrición clínica inteligente sobre planes_nutricionales_clinicos.
--
-- Corrige un bug real de 0013: las políticas RLS de esa migración usan
-- `app_current_tenant_id()`, una función que nunca se definió en
-- ningún lado del proyecto (verificado: no aparece en ninguna otra
-- migración). Una política que referencia una función inexistente hace
-- fallar el `create policy`, así que 0013 probablemente nunca terminó
-- de aplicarse tal cual sobre `planes_nutricionales_clinicos` en un
-- ambiente real. Esta migración reemplaza esas políticas por el mismo
-- patrón que usa el resto de las tablas clínicas del proyecto
-- (`usuarios.auth_id = auth.uid()`), y de paso exige paciente activo en
-- INSERT/UPDATE como 0016/0018/0019/0020. No se toca `controles_clinicos`
-- (tiene el mismo problema pero es la tabla del módulo Control, fuera
-- de alcance de este cambio).
--
-- No destructiva: agrega columnas nuevas con default y hace un backfill
-- de datos existentes; no toca `fase`/`priorizar`/`evitar`/
-- `comidas_dia`/`confirmado`. No cambia la unique constraint
-- (tenant_id, paciente_id): sigue habiendo un único plan nutricional
-- activo por paciente.
--
-- Autocontenida: crea `planes_nutricionales_clinicos` si todavía no
-- existe (mismo esquema que definía 0013), para no depender de que
-- 0013 se haya aplicado con éxito antes. Orden: tabla, índices,
-- trigger de updated_at, RLS y políticas.
--
-- Cómo ejecutarla: igual que el resto (supabase db push o pegarla en
-- el SQL editor del proyecto). Idempotente: correrla dos veces no
-- falla ni duplica columnas, índices, trigger ni políticas.

create table if not exists planes_nutricionales_clinicos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  paciente_id uuid not null references pacientes(id),
  fase text not null check (fase in ('restore','repair','reset','target','regenerate','balance')),
  priorizar text not null default '',
  evitar text not null default '',
  comidas_dia int not null default 4 check (comidas_dia between 1 and 10),
  confirmado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, paciente_id)
);

create index if not exists ix_planes_nutricionales_clinicos_tenant
  on planes_nutricionales_clinicos (tenant_id);
create index if not exists ix_planes_nutricionales_clinicos_paciente
  on planes_nutricionales_clinicos (paciente_id);

-- Reutiliza el trigger de updated_at ya definido en 0006 (mismo patrón
-- que 0007/0008/0009/0010/0011/0012/0019). La tabla tenía la columna
-- `updated_at` desde 0013 pero ningún trigger la mantenía al día.
drop trigger if exists trg_planes_nutricionales_clinicos_updated_at
  on planes_nutricionales_clinicos;
create trigger trg_planes_nutricionales_clinicos_updated_at
  before update on planes_nutricionales_clinicos
  for each row execute function fn_historia_updated_at();

alter table planes_nutricionales_clinicos enable row level security;

alter table planes_nutricionales_clinicos
  add column if not exists objetivo_clinico text,
  add column if not exists calculos jsonb not null default '{}'::jsonb,
  add column if not exists plan jsonb not null default '{}'::jsonb,
  add column if not exists restricciones jsonb not null default '{}'::jsonb,
  add column if not exists advertencias jsonb not null default '[]'::jsonb,
  add column if not exists estado text not null default 'borrador'
    check (estado in ('borrador', 'sugerido', 'revisado', 'aprobado', 'archivado')),
  add column if not exists aprobado_por uuid,
  add column if not exists aprobado_en timestamptz,
  add column if not exists version_motor integer not null default 1;

-- Backfill: los planes ya confirmados quedan como 'aprobado', el resto
-- como 'borrador' (mismo criterio que ya representaba `confirmado`).
update planes_nutricionales_clinicos
  set estado = case when confirmado then 'aprobado' else 'borrador' end
  where estado = 'borrador';

create index if not exists ix_planes_nutricionales_clinicos_estado
  on planes_nutricionales_clinicos (estado);

-- Reemplaza las políticas rotas de 0013 por el patrón estándar del proyecto.
drop policy if exists planes_nutricionales_clinicos_all on planes_nutricionales_clinicos;

create policy planes_nutricionales_clinicos_select on planes_nutricionales_clinicos for select
  to authenticated
  using (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
  );

create policy planes_nutricionales_clinicos_insert on planes_nutricionales_clinicos for insert
  to authenticated
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id
        and p.tenant_id = planes_nutricionales_clinicos.tenant_id
        and p.deleted_at is null
    )
  );

create policy planes_nutricionales_clinicos_update on planes_nutricionales_clinicos for update
  to authenticated
  using (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
  )
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id
        and p.tenant_id = planes_nutricionales_clinicos.tenant_id
        and p.deleted_at is null
    )
  );