-- Plan terapéutico (IPT — Interpretación Personalizada del Tratamiento):
-- organiza el tratamiento del paciente en las 6 fases de secuenciación
-- clínica (Seguridad y estabilización, Digestivo e intestinal,
-- Inflamación y estrés oxidativo, Metabólico y hormonal, Mitocondrial y
-- energía, Reparación y mantenimiento).
--
-- Tabla nueva y aditiva: no toca `ipt_evaluaciones` (Índice de
-- Prioridad Terapéutica numérico, ya validado contra el prototipo) ni
-- `fases_terapeuticas` (selección de fase Restore/Repair/Reset/Target/
-- Regenerate/Balance) — son conceptos distintos que este proyecto ya
-- tenía implementados bajo esos nombres antes de esta migración, y
-- siguen funcionando exactamente igual.
--
-- Cómo ejecutarla: igual que el resto (supabase db push o pegarla en
-- el SQL editor del proyecto). No destructiva, sin DROP. Idempotente.

create table if not exists planes_terapeuticos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  paciente_id uuid not null references pacientes(id),
  fases jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, paciente_id)
);

create index if not exists ix_planes_terapeuticos_tenant on planes_terapeuticos (tenant_id);
create index if not exists ix_planes_terapeuticos_paciente on planes_terapeuticos (paciente_id);

-- Reutiliza el trigger de updated_at ya definido en 0004/0006.
drop trigger if exists trg_plan_terapeutico_updated_at on planes_terapeuticos;
create trigger trg_plan_terapeutico_updated_at
  before update on planes_terapeuticos
  for each row execute function fn_historia_updated_at();

alter table planes_terapeuticos enable row level security;

drop policy if exists planes_terapeuticos_select on planes_terapeuticos;
drop policy if exists planes_terapeuticos_insert on planes_terapeuticos;
drop policy if exists planes_terapeuticos_update on planes_terapeuticos;

create policy planes_terapeuticos_select on planes_terapeuticos for select
  to authenticated
  using (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
  );

-- Exige paciente activo (deleted_at is null) desde el día uno — mismo
-- backstop de defensa en profundidad que 0016/0018 agregaron después
-- a historias_clinicas y diagnosticos_funcionales.
create policy planes_terapeuticos_insert on planes_terapeuticos for insert
  to authenticated
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id
        and p.tenant_id = planes_terapeuticos.tenant_id
        and p.deleted_at is null
    )
  );

create policy planes_terapeuticos_update on planes_terapeuticos for update
  to authenticated
  using (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
  )
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id
        and p.tenant_id = planes_terapeuticos.tenant_id
        and p.deleted_at is null
    )
  );
