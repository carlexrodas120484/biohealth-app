-- 0004_pacientes_consolidado.sql
-- Módulo Pacientes — migración única e idempotente de cierre.
--
-- Por qué existe esta migración (no alcanza con 0001-0003):
-- La base real quedó en un estado intermedio respecto de lo que 0002
-- describe: la mayoría de las columnas nuevas de `pacientes` SÍ están
-- creadas, pero `updated_at` nunca se aplicó (confirmado contra el
-- esquema real vía PostgREST: `column pacientes.updated_at does not
-- exist`) y `edad` seguía `NOT NULL`. Todo indica que en algún momento
-- se agregaron columnas sueltas a mano en vez de correr 0002 completa.
-- Esta migración es la fuente única de verdad para el estado final de
-- `pacientes`/`usuarios`: puede correrse tantas veces como haga falta,
-- en cualquier ambiente (nuevo o con drift como el de arriba), y deja
-- exactamente el mismo resultado. No reemplaza 0001-0003 (se mantienen
-- como historial), pero no depende de que se hayan aplicado tal cual.

-- ==================== 1) COLUMNAS DE `pacientes` ====================
-- Todas con IF NOT EXISTS: en un ambiente nuevo las crea, en el
-- ambiente actual sólo agrega lo que falta (updated_at) sin tocar el
-- resto.

alter table pacientes
  add column if not exists apellido text,
  add column if not exists documento text,
  add column if not exists fecha_nacimiento date,
  add column if not exists correo text,
  add column if not exists direccion text,
  add column if not exists ciudad text,
  add column if not exists ocupacion text,
  add column if not exists motivo_consulta text,
  add column if not exists antecedentes_personales text,
  add column if not exists antecedentes_familiares text,
  add column if not exists medicamentos_actuales text,
  add column if not exists alergias text,
  add column if not exists observaciones text,
  add column if not exists updated_at timestamptz not null default now();

-- `edad` y `ci` son campos legacy que usa lib/pdf/plantillas.ts. Dejan
-- de ser obligatorios porque la fuente de verdad ahora es
-- fecha_nacimiento/documento; el trigger de abajo los mantiene
-- sincronizados. DROP NOT NULL no falla si la columna ya es nullable,
-- así que es seguro repetir esto.
alter table pacientes alter column edad drop not null;
alter table pacientes alter column ci drop not null;

-- ==================== 2) SINCRONIZACIÓN LEGACY (edad/ci) ====================

create or replace function fn_sincronizar_paciente_legacy() returns trigger as $$
begin
  if new.fecha_nacimiento is not null then
    new.edad := date_part('year', age(new.fecha_nacimiento));
  end if;
  if new.documento is not null then
    new.ci := coalesce(new.ci, new.documento);
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sincronizar_paciente_legacy on pacientes;
create trigger trg_sincronizar_paciente_legacy
  before insert or update on pacientes
  for each row execute function fn_sincronizar_paciente_legacy();

-- ==================== 3) ÍNDICES ====================

-- documento único por tenant (permite null para pacientes sin documento a mano)
create unique index if not exists ux_pacientes_tenant_documento
  on pacientes (tenant_id, documento)
  where documento is not null and deleted_at is null;

-- búsqueda por nombre/apellido/documento
create index if not exists ix_pacientes_busqueda
  on pacientes using gin (
    to_tsvector('spanish', coalesce(nombre,'') || ' ' || coalesce(apellido,'') || ' ' || coalesce(documento,''))
  );

-- toda política de RLS de pacientes filtra por tenant_id: sin este
-- índice, cada SELECT/UPDATE/DELETE hace un seq scan a medida que crece
-- la tabla.
create index if not exists ix_pacientes_tenant_id on pacientes (tenant_id);

-- `usuarios.auth_id = auth.uid()` es la subconsulta que corren TODAS las
-- políticas de pacientes (ver sección 5). Un usuario autenticado debe
-- resolver a un único tenant, así que es único además de índice.
create unique index if not exists ux_usuarios_auth_id on usuarios (auth_id);

-- ==================== 4) tenant_id: NOT NULL + FK ====================
-- Ya están así desde 0001, pero se deja explícito y sin condicional
-- porque son operaciones idempotentes por naturaleza (no fallan si ya
-- están aplicadas) y esta migración es la fuente de verdad del estado
-- final de la tabla.

alter table pacientes alter column tenant_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pacientes_tenant_id_fkey'
  ) then
    alter table pacientes
      add constraint pacientes_tenant_id_fkey
      foreign key (tenant_id) references tenants(id);
  end if;
end $$;

-- ==================== 5) ROW LEVEL SECURITY ====================
-- Patrón: tenant_id de la fila = tenant_id del usuario autenticado,
-- resuelto vía usuarios.auth_id = auth.uid(). auth.uid() viene del JWT
-- de sesión validado por Supabase Auth — nunca de un valor que mande el
-- cliente — así que no hace falta (ni conviene) el service role acá.

alter table pacientes enable row level security;
alter table usuarios enable row level security;

-- limpia cualquier política previa (0001 dependía de auth.jwt() ->>
-- 'tenant_id', que nunca se pobló; 0002 ya las reemplazó, pero se
-- vuelven a soltar acá para que esta migración sea la fuente única de
-- verdad sin importar qué políticas quedaron de antes)
drop policy if exists tenant_isolation_select on pacientes;
drop policy if exists tenant_isolation_all on pacientes;
drop policy if exists pacientes_select on pacientes;
drop policy if exists pacientes_insert on pacientes;
drop policy if exists pacientes_update on pacientes;
drop policy if exists pacientes_delete on pacientes;

create policy pacientes_select on pacientes for select
  to authenticated
  using (
    deleted_at is null
    and tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
  );

create policy pacientes_insert on pacientes for insert
  to authenticated
  with check (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));

create policy pacientes_update on pacientes for update
  to authenticated
  using (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()))
  with check (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));

create policy pacientes_delete on pacientes for delete
  to authenticated
  using (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));

-- usuarios: cada quien ve únicamente su propia fila. Es lo mínimo que
-- necesitan las políticas de arriba (la subconsulta corre como el
-- usuario autenticado, no como service role) y lo que necesita la app
-- para resolver su propio tenant_id sin saltarse RLS.
drop policy if exists usuarios_self on usuarios;
create policy usuarios_self on usuarios for select
  to authenticated
  using (auth_id = auth.uid());
