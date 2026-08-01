-- Trazabilidad de recetas e informes generados desde una formulación firmada.
create table if not exists documentos_clinicos_generados (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  paciente_id uuid not null references pacientes(id),
  formulacion_id uuid not null references formulaciones_terapeuticas(id),
  tipo text not null check (tipo in ('receta_botica','informe_medico','informe_paciente')),
  generado_por uuid not null,
  generado_en timestamptz not null default now()
);

create index if not exists ix_documentos_clinicos_paciente on documentos_clinicos_generados (tenant_id, paciente_id, generado_en desc);
alter table documentos_clinicos_generados enable row level security;

drop policy if exists documentos_clinicos_select on documentos_clinicos_generados;
drop policy if exists documentos_clinicos_insert on documentos_clinicos_generados;
create policy documentos_clinicos_select on documentos_clinicos_generados for select to authenticated
  using (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));
create policy documentos_clinicos_insert on documentos_clinicos_generados for insert to authenticated
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and generado_por = auth.uid()
  );
