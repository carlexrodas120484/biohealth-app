-- Objetivos terapéuticos del ciclo, restringidos a la fase confirmada.

create table if not exists objetivos_terapeuticos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  paciente_id uuid not null references pacientes(id),
  fase text not null check (fase in ('restore','repair','reset','target','regenerate','balance')),
  objetivos jsonb not null default '[]'::jsonb,
  semanas_previstas integer not null default 0 check (semanas_previstas >= 0 and semanas_previstas <= 104),
  confirmado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, paciente_id)
);

create index if not exists ix_objetivos_terapeuticos_tenant on objetivos_terapeuticos (tenant_id);
create index if not exists ix_objetivos_terapeuticos_paciente on objetivos_terapeuticos (paciente_id);

drop trigger if exists trg_objetivos_terapeuticos_updated_at on objetivos_terapeuticos;
create trigger trg_objetivos_terapeuticos_updated_at
  before update on objetivos_terapeuticos
  for each row execute function fn_historia_updated_at();

alter table objetivos_terapeuticos enable row level security;

drop policy if exists objetivos_terapeuticos_select on objetivos_terapeuticos;
drop policy if exists objetivos_terapeuticos_insert on objetivos_terapeuticos;
drop policy if exists objetivos_terapeuticos_update on objetivos_terapeuticos;

create policy objetivos_terapeuticos_select on objetivos_terapeuticos for select to authenticated
  using (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));

create policy objetivos_terapeuticos_insert on objetivos_terapeuticos for insert to authenticated
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id and p.tenant_id = objetivos_terapeuticos.tenant_id
        and p.deleted_at is null
    )
  );

create policy objetivos_terapeuticos_update on objetivos_terapeuticos for update to authenticated
  using (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()))
  with check (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));
