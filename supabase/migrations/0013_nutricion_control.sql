-- Pasos 9 y 10 del flujo clínico, persistidos por paciente y tenant.
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

create table if not exists controles_clinicos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  paciente_id uuid not null references pacientes(id),
  fase text not null check (fase in ('restore','repair','reset','target','regenerate','balance')),
  ciclo_num int not null default 1 check (ciclo_num between 1 and 100),
  reduccion_ipt_pct numeric not null check (reduccion_ipt_pct between -100 and 100),
  mejoria_objetivos_pct numeric not null check (mejoria_objetivos_pct between -100 and 100),
  adherencia_pct numeric not null check (adherencia_pct between 0 and 100),
  semanas_en_fase int not null check (semanas_en_fase between 0 and 520),
  bandera_roja_nueva boolean not null default false,
  reformulaciones_previas int not null default 0 check (reformulaciones_previas between 0 and 3),
  decision text not null check (decision in ('avanzar','reformular','derivar_paso4')),
  created_at timestamptz not null default now()
);

alter table planes_nutricionales_clinicos enable row level security;
alter table controles_clinicos enable row level security;

create policy planes_nutricionales_clinicos_all on planes_nutricionales_clinicos for all to authenticated
  using (tenant_id = app_current_tenant_id()) with check (tenant_id = app_current_tenant_id());
create policy controles_clinicos_all on controles_clinicos for all to authenticated
  using (tenant_id = app_current_tenant_id()) with check (tenant_id = app_current_tenant_id());
