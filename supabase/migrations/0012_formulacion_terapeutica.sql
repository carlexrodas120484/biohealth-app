-- Fórmula terapéutica por paciente. Los ítems se guardan como instantánea clínica.

create table if not exists formulaciones_terapeuticas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  paciente_id uuid not null references pacientes(id),
  fase text not null check (fase in ('restore','repair','reset','target','regenerate','balance')),
  objetivos jsonb not null default '[]'::jsonb,
  items jsonb not null default '[]'::jsonb,
  seguridad_revisada boolean not null default false,
  firmada boolean not null default false,
  firmada_por uuid,
  firmada_en timestamptz,
  version_reglas text not null default 'v1.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, paciente_id)
);

create index if not exists ix_formulaciones_terapeuticas_tenant on formulaciones_terapeuticas (tenant_id);
create index if not exists ix_formulaciones_terapeuticas_paciente on formulaciones_terapeuticas (paciente_id);

drop trigger if exists trg_formulaciones_terapeuticas_updated_at on formulaciones_terapeuticas;
create trigger trg_formulaciones_terapeuticas_updated_at
  before update on formulaciones_terapeuticas
  for each row execute function fn_historia_updated_at();

alter table formulaciones_terapeuticas enable row level security;

drop policy if exists formulaciones_terapeuticas_select on formulaciones_terapeuticas;
drop policy if exists formulaciones_terapeuticas_insert on formulaciones_terapeuticas;
drop policy if exists formulaciones_terapeuticas_update on formulaciones_terapeuticas;

create policy formulaciones_terapeuticas_select on formulaciones_terapeuticas for select to authenticated
  using (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));

create policy formulaciones_terapeuticas_insert on formulaciones_terapeuticas for insert to authenticated
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id and p.tenant_id = formulaciones_terapeuticas.tenant_id
        and p.deleted_at is null
    )
  );

create policy formulaciones_terapeuticas_update on formulaciones_terapeuticas for update to authenticated
  using (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and firmada = false
  )
  with check (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));
