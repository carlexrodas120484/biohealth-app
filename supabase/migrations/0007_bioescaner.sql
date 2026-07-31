-- Bioescáner: informe privado y hallazgos estructurados por paciente.

create table if not exists bioescaneres (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  paciente_id uuid not null references pacientes(id),
  fecha date,
  equipo text,
  observaciones text,
  archivo_path text,
  hallazgos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, paciente_id)
);

create index if not exists ix_bioescaneres_tenant on bioescaneres (tenant_id);
create index if not exists ix_bioescaneres_paciente on bioescaneres (paciente_id);

drop trigger if exists trg_bioescaner_updated_at on bioescaneres;
create trigger trg_bioescaner_updated_at
  before update on bioescaneres
  for each row execute function fn_historia_updated_at();

alter table bioescaneres enable row level security;

drop policy if exists bioescaneres_select on bioescaneres;
drop policy if exists bioescaneres_insert on bioescaneres;
drop policy if exists bioescaneres_update on bioescaneres;

create policy bioescaneres_select on bioescaneres for select to authenticated
  using (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));

create policy bioescaneres_insert on bioescaneres for insert to authenticated
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id and p.tenant_id = bioescaneres.tenant_id
    )
  );

create policy bioescaneres_update on bioescaneres for update to authenticated
  using (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()))
  with check (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bioescaneres', 'bioescaneres', false, 8388608, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists bioescaner_archivos_select on storage.objects;
drop policy if exists bioescaner_archivos_insert on storage.objects;
drop policy if exists bioescaner_archivos_update on storage.objects;
drop policy if exists bioescaner_archivos_delete on storage.objects;

create policy bioescaner_archivos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'bioescaneres'
    and (storage.foldername(name))[1] = (
      select u.tenant_id::text from usuarios u where u.auth_id = auth.uid()
    )
  );

create policy bioescaner_archivos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bioescaneres'
    and (storage.foldername(name))[1] = (
      select u.tenant_id::text from usuarios u where u.auth_id = auth.uid()
    )
  );

create policy bioescaner_archivos_update on storage.objects for update to authenticated
  using (
    bucket_id = 'bioescaneres'
    and (storage.foldername(name))[1] = (
      select u.tenant_id::text from usuarios u where u.auth_id = auth.uid()
    )
  );

create policy bioescaner_archivos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'bioescaneres'
    and (storage.foldername(name))[1] = (
      select u.tenant_id::text from usuarios u where u.auth_id = auth.uid()
    )
  );
