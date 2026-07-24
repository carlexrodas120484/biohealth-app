-- Método BioHealth® — esquema inicial
-- Reglas transversales: toda tabla clínica lleva tenant_id; nada se
-- borra (soft delete vía deleted_at); las reglas del algoritmo viven
-- versionadas en tablas propias, nunca hardcodeadas.

create extension if not exists "pgcrypto";

-- ==================== ORGANIZACIÓN Y ACCESO ====================

create table tenants (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  plan text not null default 'mvp',
  created_at timestamptz not null default now()
);

create table usuarios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  auth_id uuid not null references auth.users(id),
  nombre text not null,
  rol text not null check (rol in ('medico_titular','medico_invitado','recepcion')),
  especialidad text,
  activo boolean not null default true
);

-- ==================== PACIENTES ====================

create table pacientes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  nombre text not null,
  edad int not null,
  sexo text not null check (sexo in ('femenino','masculino')),
  ci text,
  telefono text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table antecedentes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id),
  descripcion text not null,
  created_at timestamptz not null default now()
);

create table medicacion_actual (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id),
  nombre text not null,
  dosis text,
  frecuencia text,
  activo boolean not null default true
);

-- ==================== CONSULTA / FLUJO DE 10 PASOS ====================

create table consultas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  paciente_id uuid not null references pacientes(id),
  medico_id uuid not null references usuarios(id),
  paso_actual int not null default 1 check (paso_actual between 1 and 10),
  motivo_consulta text,
  version_reglas text not null default 'v1.0',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sintomas (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references consultas(id),
  nombre text not null,
  intensidad int not null check (intensidad between 0 and 100)
);

create table cuestionario_resp (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references consultas(id),
  sistema text not null,
  pregunta text not null,
  respuesta int not null check (respuesta in (0,1,2))
);

create table escaneo_hallazgos (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references consultas(id),
  parametro text not null,
  severidad text not null check (severidad in ('ok','med','alto')),
  archivo_url text
);

-- ==================== DIAGNÓSTICO E IPT ====================

create table alteraciones (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references consultas(id),
  nombre text not null,
  dominio text not null,
  nivel text not null check (nivel in ('primaria','secundaria','terciaria')),
  ic int not null check (ic between 0 and 5),
  is_ int not null check (is_ between 0 and 5),
  rv int not null check (rv between 0 and 5),
  ev int not null check (ev between 0 and 5),
  cb int not null check (cb between 0 and 5),
  perpetuador boolean not null default false,
  cronicidad_meses int,
  ipt_calculado int
);

create table perpetuadores (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references consultas(id),
  alteracion_id uuid references alteraciones(id),
  descripcion text not null,
  estado text not null check (estado in ('activo','en_desprescripcion','resuelto'))
);

-- ==================== FASE Y OBJETIVOS ====================

create table fase_asignaciones (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references consultas(id),
  fase text not null check (fase in ('restore','repair','reset','target','regenerate','balance')),
  sugerida_por_sistema boolean not null default true,
  confirmada boolean not null default false,
  motivo_anulacion text,
  fecha timestamptz not null default now()
);

create table objetivos_seleccion (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references consultas(id),
  objetivo text not null,
  seleccionado boolean not null default true
);

-- ==================== FORMULACIÓN ====================

create table biblioteca_activos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  version int not null default 1,
  nombre text not null,
  familia text,
  fase text not null check (fase in ('restore','repair','reset','target','regenerate','balance')),
  objetivo text,
  mecanismo text,
  dosis text,
  dosis_max text,
  evidencia int check (evidencia between 1 and 5),
  contraindicaciones text,
  interacciones text,
  referencias int default 0,
  vigente boolean not null default true
);

create table formulas (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references consultas(id),
  firmada boolean not null default false,
  firmada_por uuid references usuarios(id),
  firmada_en timestamptz,
  version_reglas text not null default 'v1.0'
);

create table formula_items (
  id uuid primary key default gen_random_uuid(),
  formula_id uuid not null references formulas(id),
  activo_id uuid not null references biblioteca_activos(id),
  nombre text not null,
  dosis_indicada text not null
);

-- ==================== NUTRICIÓN Y CONTROL ====================

create table plan_nutricional (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references consultas(id),
  priorizar text,
  evitar text,
  comidas_dia int default 4
);

create table controles (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references consultas(id),
  ciclo_num int not null default 1,
  ipt_delta numeric,
  adherencia_pct numeric,
  mejoria_pct numeric,
  decision text check (decision in ('avanzar','reformular','derivar_paso4')),
  created_at timestamptz not null default now()
);

-- ==================== OPERACIÓN ====================

create table agenda_turnos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  paciente_id uuid not null references pacientes(id),
  medico_id uuid not null references usuarios(id),
  fecha date not null,
  hora time not null,
  tipo text
);

create table casos_clinicos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  titulo text not null,
  resumen text,
  fase text,
  ipt int,
  resultado text
);

create table documentos_generados (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references consultas(id),
  tipo text not null check (tipo in ('formula_magistral','plan_paciente')),
  url text,
  generado_en timestamptz not null default now()
);

-- ==================== CONFIGURACIÓN VERSIONADA DEL ALGORITMO ====================

create table ipt_pesos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  version int not null default 1,
  ic numeric not null default 0.30,
  is_ numeric not null default 0.25,
  rv numeric not null default 0.20,
  ev numeric not null default 0.15,
  cb numeric not null default 0.10,
  vigente boolean not null default true,
  vigente_desde timestamptz not null default now()
);

create table ipt_compuertas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  version int not null default 1,
  orden int not null,
  dominio text,
  umbral int not null default 60,
  fase_resultante text
);

-- ==================== AUDITORÍA ====================

create table auditoria_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  usuario_id uuid,
  tabla text not null,
  registro_id uuid,
  accion text not null check (accion in ('insert','update','delete')),
  valores_previos jsonb,
  valores_nuevos jsonb,
  ts timestamptz not null default now()
);

create or replace function fn_auditoria() returns trigger as $$
begin
  insert into auditoria_log (tenant_id, usuario_id, tabla, registro_id, accion, valores_previos, valores_nuevos)
  values (
    coalesce(new.tenant_id, old.tenant_id),
    auth.uid(),
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op in ('update','delete') then to_jsonb(old) else null end,
    case when tg_op in ('insert','update') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

-- se instrumenta en las tablas clínicas más sensibles; extender según necesidad
create trigger trg_auditoria_formulas after insert or update or delete on formulas
  for each row execute function fn_auditoria();
create trigger trg_auditoria_fase after insert or update or delete on fase_asignaciones
  for each row execute function fn_auditoria();
create trigger trg_auditoria_pacientes after insert or update or delete on pacientes
  for each row execute function fn_auditoria();

-- ==================== ROW LEVEL SECURITY ====================

alter table pacientes enable row level security;
alter table consultas enable row level security;
alter table alteraciones enable row level security;
alter table formulas enable row level security;
alter table formula_items enable row level security;
alter table biblioteca_activos enable row level security;
alter table agenda_turnos enable row level security;
alter table ipt_pesos enable row level security;

create policy tenant_isolation_select on pacientes for select
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy tenant_isolation_all on pacientes for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy tenant_isolation_consultas on consultas for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy tenant_isolation_biblioteca on biblioteca_activos for select
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy tenant_isolation_agenda on agenda_turnos for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy tenant_isolation_pesos on ipt_pesos for select
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- solo medico_titular firma fórmulas; una vez firmada, nadie edita sus items
create policy solo_titular_firma on formulas for update
  using (
    (auth.jwt() ->> 'rol') = 'medico_titular'
  );

create policy items_bloqueados_si_firmada on formula_items for all
  using (
    not exists (
      select 1 from formulas f where f.id = formula_items.formula_id and f.firmada = true
    )
    or (select current_setting('request.method', true)) = 'GET'
  );

-- recepción no accede a la formulación clínica
create policy recepcion_sin_formulas on formulas for select
  using ((auth.jwt() ->> 'rol') != 'recepcion');
