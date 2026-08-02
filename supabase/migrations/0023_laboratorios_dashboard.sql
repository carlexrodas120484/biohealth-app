-- Serie temporal de mediciones clínicas/laboratorio por paciente, para
-- alimentar el Dashboard Clínico Inteligente (gráficos de tendencia +
-- semáforos). No existía ninguna tabla que guardara estos valores como
-- serie: `historias_clinicas.historia` sólo guarda una instantánea
-- (unique tenant_id+paciente_id, se sobreescribe en cada guardado) y
-- ninguna tabla tenía columnas para glucemia/HbA1c/triglicéridos/HDL/
-- LDL/vitamina D/HOMA/PCR/ferritina. Cada fila acá es una toma/control
-- puntual; todos los campos de valores son opcionales porque un control
-- puede registrar sólo un subconjunto (p.ej. sólo peso y presión).

create table if not exists laboratorios_clinicos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  paciente_id uuid not null references pacientes(id),
  fecha date not null default current_date,
  peso_kg numeric check (peso_kg between 0 and 500),
  talla_cm numeric check (talla_cm between 0 and 250),
  cintura_cm numeric check (cintura_cm between 0 and 300),
  presion_sistolica numeric check (presion_sistolica between 0 and 300),
  presion_diastolica numeric check (presion_diastolica between 0 and 200),
  glucemia_mg_dl numeric check (glucemia_mg_dl between 0 and 1000),
  hba1c_pct numeric check (hba1c_pct between 0 and 20),
  trigliceridos_mg_dl numeric check (trigliceridos_mg_dl between 0 and 2000),
  hdl_mg_dl numeric check (hdl_mg_dl between 0 and 200),
  ldl_mg_dl numeric check (ldl_mg_dl between 0 and 500),
  vitamina_d_ng_ml numeric check (vitamina_d_ng_ml between 0 and 200),
  homa_ir numeric check (homa_ir between 0 and 50),
  pcr_mg_l numeric check (pcr_mg_l between 0 and 500),
  ferritina_ng_ml numeric check (ferritina_ng_ml between 0 and 5000),
  observaciones text not null default '',
  registrado_por uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists ix_laboratorios_clinicos_paciente
  on laboratorios_clinicos (tenant_id, paciente_id, fecha desc);

alter table laboratorios_clinicos enable row level security;

drop policy if exists laboratorios_clinicos_select on laboratorios_clinicos;
drop policy if exists laboratorios_clinicos_insert on laboratorios_clinicos;

create policy laboratorios_clinicos_select on laboratorios_clinicos for select
  to authenticated
  using (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
  );

create policy laboratorios_clinicos_insert on laboratorios_clinicos for insert
  to authenticated
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and registrado_por = auth.uid()
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id
        and p.tenant_id = laboratorios_clinicos.tenant_id
        and p.deleted_at is null
    )
  );

-- No se permite UPDATE/DELETE: un registro de laboratorio es un hecho
-- histórico (qué se midió ese día); una corrección se hace agregando
-- una fila nueva, nunca reescribiendo el pasado.
