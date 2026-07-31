-- Selección de fase terapéutica por paciente, basada en el IPT confirmado.

create table if not exists fases_terapeuticas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  paciente_id uuid not null references pacientes(id),
  clasificaciones jsonb not null default '[]'::jsonb,
  fase_sugerida text not null check (fase_sugerida in ('restore','repair','reset','target','regenerate','balance')),
  fase_seleccionada text not null check (fase_seleccionada in ('restore','repair','reset','target','regenerate','balance')),
  compuertas jsonb not null default '[]'::jsonb,
  bandera_roja boolean not null default false,
  motivo_anulacion text,
  confirmado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, paciente_id)
);

create index if not exists ix_fases_terapeuticas_tenant on fases_terapeuticas (tenant_id);
create index if not exists ix_fases_terapeuticas_paciente on fases_terapeuticas (paciente_id);

drop trigger if exists trg_fase_terapeutica_updated_at on fases_terapeuticas;
create trigger trg_fase_terapeutica_updated_at
  before update on fases_terapeuticas
  for each row execute function fn_historia_updated_at();

alter table fases_terapeuticas enable row level security;

drop policy if exists fases_terapeuticas_select on fases_terapeuticas;
drop policy if exists fases_terapeuticas_insert on fases_terapeuticas;
drop policy if exists fases_terapeuticas_update on fases_terapeuticas;

create policy fases_terapeuticas_select on fases_terapeuticas for select to authenticated
  using (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));

create policy fases_terapeuticas_insert on fases_terapeuticas for insert to authenticated
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id and p.tenant_id = fases_terapeuticas.tenant_id
        and p.deleted_at is null
    )
  );

create policy fases_terapeuticas_update on fases_terapeuticas for update to authenticated
  using (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()))
  with check (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));
