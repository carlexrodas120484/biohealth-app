-- Endurece las políticas de INSERT/UPDATE de historias_clinicas: además
-- de exigir que el paciente referenciado pertenezca al tenant (ya
-- exigido desde 0006), exige que esté activo (deleted_at is null).
--
-- La API (app/api/pacientes/[id]/historia/route.ts) ya valida esto antes
-- de tocar la tabla, pero RLS es el backstop independiente de la API:
-- si algún día una ruta nueva accede a esta tabla sin repetir ese
-- chequeo, o alguien consulta la base directamente con el JWT de un
-- usuario, la política sigue sin permitir crear o modificar la historia
-- de un paciente eliminado lógicamente. No afecta el flujo actual: la
-- app nunca intenta escribir la historia de un paciente inactivo.

drop policy if exists historias_insert on historias_clinicas;
drop policy if exists historias_update on historias_clinicas;

create policy historias_insert on historias_clinicas for insert
  to authenticated
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id
        and p.tenant_id = historias_clinicas.tenant_id
        and p.deleted_at is null
    )
  );

create policy historias_update on historias_clinicas for update
  to authenticated
  using (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
  )
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id
        and p.tenant_id = historias_clinicas.tenant_id
        and p.deleted_at is null
    )
  );
