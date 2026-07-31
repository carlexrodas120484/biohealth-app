-- Historia clínica y screening funcional BioHealth.
-- Un registro vigente por paciente, aislado por tenant mediante RLS.

create table if not exists historias_clinicas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  paciente_id uuid not null references pacientes(id),
  historia jsonb not null default '{}'::jsonb,
  respuestas jsonb not null default '{}'::jsonb,
  puntajes jsonb not null default '{}'::jsonb,
  completado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, paciente_id)
);

create index if not exists ix_historias_clinicas_tenant
  on historias_clinicas (tenant_id);
create index if not exists ix_historias_clinicas_paciente
  on historias_clinicas (paciente_id);

create or replace function fn_historia_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_historia_updated_at on historias_clinicas;
create trigger trg_historia_updated_at
  before update on historias_clinicas
  for each row execute function fn_historia_updated_at();

alter table historias_clinicas enable row level security;

drop policy if exists historias_select on historias_clinicas;
drop policy if exists historias_insert on historias_clinicas;
drop policy if exists historias_update on historias_clinicas;

create policy historias_select on historias_clinicas for select
  to authenticated
  using (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
  );

create policy historias_insert on historias_clinicas for insert
  to authenticated
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id and p.tenant_id = historias_clinicas.tenant_id
    )
  );

create policy historias_update on historias_clinicas for update
  to authenticated
  using (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
  )
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
  );

