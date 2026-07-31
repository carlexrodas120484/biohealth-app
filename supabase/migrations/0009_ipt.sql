-- Índice de Prioridad Terapéutica (IPT) por paciente.
-- La fórmula se calcula en el servidor; aquí se conservan la evaluación y el ranking.

create table if not exists ipt_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  paciente_id uuid not null references pacientes(id),
  evaluaciones jsonb not null default '[]'::jsonb,
  resultado jsonb not null default '[]'::jsonb,
  confirmado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, paciente_id)
);

create index if not exists ix_ipt_evaluaciones_tenant on ipt_evaluaciones (tenant_id);
create index if not exists ix_ipt_evaluaciones_paciente on ipt_evaluaciones (paciente_id);

drop trigger if exists trg_ipt_updated_at on ipt_evaluaciones;
create trigger trg_ipt_updated_at
  before update on ipt_evaluaciones
  for each row execute function fn_historia_updated_at();

alter table ipt_evaluaciones enable row level security;

drop policy if exists ipt_select on ipt_evaluaciones;
drop policy if exists ipt_insert on ipt_evaluaciones;
drop policy if exists ipt_update on ipt_evaluaciones;

create policy ipt_select on ipt_evaluaciones for select to authenticated
  using (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));

create policy ipt_insert on ipt_evaluaciones for insert to authenticated
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id and p.tenant_id = ipt_evaluaciones.tenant_id
        and p.deleted_at is null
    )
  );

create policy ipt_update on ipt_evaluaciones for update to authenticated
  using (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()))
  with check (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));
