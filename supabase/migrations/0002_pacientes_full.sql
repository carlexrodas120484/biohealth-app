-- 0002_pacientes_full.sql
-- Módulo Pacientes — esquema completo + corrección de seguridad.
--
-- CORRECCIÓN IMPORTANTE: las políticas RLS de 0001_init.sql comparaban
-- tenant_id contra `auth.jwt() ->> 'tenant_id'`. Supabase no agrega ese
-- claim al JWT automáticamente — hace falta configurar un Auth Hook para
-- eso, y nunca se hizo. Tal como estaba, la comparación siempre daba
-- null y el RLS bloqueaba el acceso a TODO el mundo, incluido el dueño
-- de los datos. Esta migración reemplaza esa comparación por una
-- subconsulta contra `usuarios` (auth.uid() → tenant_id), que es el
-- patrón estándar de Supabase para multi-tenant con tabla de perfiles
-- y no depende de configurar nada adicional en el dashboard.

-- ==================== NUEVOS CAMPOS ====================

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

-- `edad` y `ci` ya existían y las usa el módulo de PDF (fuera de
-- alcance de este trabajo). Se mantienen, pero dejan de ser obligatorias
-- porque este módulo captura fecha_nacimiento y documento como fuente
-- de verdad — un trigger las mantiene sincronizadas automáticamente.
alter table pacientes alter column edad drop not null;
alter table pacientes alter column ci drop not null;

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

-- evita pacientes duplicados por documento dentro del mismo tenant,
-- sin exigir el campo (permite null para casos sin documento a mano)
create unique index if not exists ux_pacientes_tenant_documento
  on pacientes (tenant_id, documento)
  where documento is not null and deleted_at is null;

-- búsqueda por nombre/apellido/documento sin escanear toda la tabla
create index if not exists ix_pacientes_busqueda
  on pacientes using gin (
    to_tsvector('spanish', coalesce(nombre,'') || ' ' || coalesce(apellido,'') || ' ' || coalesce(documento,''))
  );

-- ==================== CORRECCIÓN DE RLS ====================

-- RLS en `usuarios` estaba deshabilitado en 0001 — sin esto, la
-- subconsulta de las políticas de abajo no tiene permiso para leer ni
-- siquiera la fila propia del usuario autenticado.
alter table usuarios enable row level security;

drop policy if exists usuarios_self on usuarios;
create policy usuarios_self on usuarios for select
  to authenticated
  using (auth_id = auth.uid());

-- se reemplazan las políticas de pacientes de 0001 (dependían del JWT)
drop policy if exists tenant_isolation_select on pacientes;
drop policy if exists tenant_isolation_all on pacientes;

create policy pacientes_select on pacientes for select
  to authenticated
  using (tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid()));

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

-- nota para cuando se aborden los otros módulos (consultas, formulas,
-- biblioteca_activos, agenda_turnos, ipt_pesos): tienen el mismo problema
-- de auth.jwt() ->> 'tenant_id' y van a necesitar esta misma corrección.
