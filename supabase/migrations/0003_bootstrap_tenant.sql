-- 0003_bootstrap_tenant.sql
-- Crea el consultorio inicial (tenant) y vincula a fernandojose120484@gmail.com
-- como médico titular. Corrige el error "Tu usuario no está vinculado a un
-- consultorio (tenant)" que aparece al intentar registrar un paciente.

-- ==================== 1) BOOTSTRAP RETROACTIVO ====================
-- Arregla la cuenta que ya existe en auth.users (porque ya podés loguearte)
-- pero que nunca tuvo fila en `usuarios`. Es idempotente: correrlo dos
-- veces no duplica nada.

do $$
declare
  v_tenant_id uuid;
  v_auth_id uuid;
begin
  select id into v_auth_id from auth.users where email = 'fernandojose120484@gmail.com';

  if v_auth_id is null then
    raise notice 'No existe todavía un usuario con ese email en auth.users. Iniciá sesión al menos una vez y volvé a correr este script.';
    return;
  end if;

  if exists (select 1 from usuarios where auth_id = v_auth_id) then
    raise notice 'Este usuario ya está vinculado a un tenant. No se modificó nada.';
    return;
  end if;

  insert into tenants (nombre) values ('BioHealth Medicina Avanzada')
  returning id into v_tenant_id;

  insert into usuarios (tenant_id, auth_id, nombre, rol, especialidad, activo)
  values (v_tenant_id, v_auth_id, 'Fernando José', 'medico_titular', 'Medicina Familiar y Funcional', true);

  raise notice 'Listo: tenant % creado y usuario vinculado como medico_titular.', v_tenant_id;
end $$;

-- ==================== 2) BOOTSTRAP AUTOMÁTICO A FUTURO ====================
-- Si alguna vez volvés a tener la tabla `usuarios` vacía (un ambiente de
-- prueba nuevo, un reset de base), el PRÓXIMO usuario que inicie sesión por
-- primera vez se convierte automáticamente en medico_titular de un tenant
-- nuevo. A partir del segundo usuario, NO se autoasigna ningún tenant —
-- queda pendiente de que vos lo vincules a mano (evita que cualquiera que
-- se registre reciba acceso solo). Esto es lo que corre solo, sin que
-- tengas que volver a ejecutar SQL a mano cada vez.

create or replace function fn_bootstrap_primer_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  if not exists (select 1 from usuarios limit 1) then
    insert into tenants (nombre) values ('Consultorio inicial')
    returning id into v_tenant_id;

    insert into usuarios (tenant_id, auth_id, nombre, rol, activo)
    values (v_tenant_id, new.id, coalesce(new.raw_user_meta_data->>'name', new.email), 'medico_titular', true);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bootstrap_primer_usuario on auth.users;
create trigger trg_bootstrap_primer_usuario
  after insert on auth.users
  for each row execute function fn_bootstrap_primer_usuario();
