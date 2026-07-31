-- Permite que el borrado lógico cambie deleted_at de NULL a una fecha.
-- Es idempotente y puede ejecutarse más de una vez.

alter table pacientes enable row level security;

drop policy if exists pacientes_update on pacientes;

create policy pacientes_update on pacientes
  for update
  to authenticated
  using (
    tenant_id = (
      select u.tenant_id
      from usuarios u
      where u.auth_id = auth.uid()
    )
  )
  with check (
    tenant_id = (
      select u.tenant_id
      from usuarios u
      where u.auth_id = auth.uid()
    )
  );
