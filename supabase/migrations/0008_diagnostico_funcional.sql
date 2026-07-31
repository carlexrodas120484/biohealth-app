-- Diagnóstico funcional médico, basado en evidencia registrada en pasos previos.

create table if not exists diagnosticos_funcionales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  paciente_id uuid not null references pacientes(id),
  alteraciones jsonb not null default '[]'::jsonb,
  perpetuadores jsonb not null default '[]'::jsonb,
  deficits jsonb not null default '[]'::jsonb,
  impresion text,
  estudios text,
  confirmado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, paciente_id)
);

create index if not exists ix_diagnosticos_funcionales_tenant on diagnosticos_funcionales (tenant_id);
create index if not exists ix_diagnosticos_funcionales_paciente on diagnosticos_funcionales (paciente_id);

drop trigger if exists trg_diagnostico_updated_at on diagnosticos_funcionales;
create trigger trg_diagnostico_updated_at
  before update on diagnosticos_funcionales
  for each row execute function fn_historia_updated_at();

alter table diagnosticos_funcionales enable row level security;

drop policy if exists diagnosticos_select on diagnosticos_funcionales;
drop policy if exists diagnosticos_insert on diagnosticos_funcionales;
drop policy if exists diagnosticos_update on diagnosticos_funcionales;

create policy diagnosticos_select on diagnosticos_funcionales for select to authenticated
  using (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));

create policy diagnosticos_insert on diagnosticos_funcionales for insert to authenticated
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id and p.tenant_id = diagnosticos_funcionales.tenant_id
    )
  );

create policy diagnosticos_update on diagnosticos_funcionales for update to authenticated
  using (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()))
  with check (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));
