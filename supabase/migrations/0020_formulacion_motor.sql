-- Motor de formulación ortomolecular sobre formulaciones_terapeuticas.
--
-- No destructiva: agrega columnas nuevas con default y hace un backfill
-- de datos existentes; no toca `items`/`fase`/`objetivos`/
-- `seguridad_revisada`/`firmada`/`firmada_por`/`firmada_en`/
-- `version_reglas`, que sigue leyendo intacto
-- app/api/pacientes/[id]/documentos/route.ts y lib/pdf/documentos-clinicos.ts
-- (generación de PDF, fuera de alcance de este cambio). No cambia la
-- unique constraint (tenant_id, paciente_id): sigue habiendo una única
-- formulación activa por paciente.
--
-- Cómo ejecutarla: igual que el resto (supabase db push o pegarla en el
-- SQL editor del proyecto). Idempotente: correrla dos veces no falla ni
-- duplica columnas ni políticas.

-- `ingredientes`: entrada estructurada nueva (dosis por toma en mg,
-- veces por día, horario, presentación) que alimenta el motor de
-- reglas. Es un modelo aparte de `items` (texto libre que ya usa la
-- firma y el PDF) — no lo reemplaza, para no tener que tocar la
-- generación de PDF.
alter table formulaciones_terapeuticas
  add column if not exists estado text not null default 'borrador'
    check (estado in ('borrador', 'sugerida', 'revisada', 'aprobada', 'archivada')),
  add column if not exists ingredientes jsonb not null default '[]'::jsonb,
  add column if not exists preparaciones jsonb not null default '[]'::jsonb,
  add column if not exists alertas jsonb not null default '[]'::jsonb;

-- Backfill: las formulaciones ya firmadas quedan como 'aprobada', el
-- resto como 'borrador' (ambos ya eran su default explícito o implícito
-- antes de esta migración, así que esto no cambia ningún dato clínico,
-- sólo lo hace explícito en la columna nueva).
update formulaciones_terapeuticas
  set estado = case when firmada then 'aprobada' else 'borrador' end
  where estado = 'borrador';

create index if not exists ix_formulaciones_terapeuticas_estado
  on formulaciones_terapeuticas (estado);

create index if not exists ix_catalogo_formulacion_objetivos
  on catalogo_formulacion using gin (objetivos);

create index if not exists ix_catalogo_formulacion_sinonimos
  on catalogo_formulacion using gin (sinonimos);

-- Relaja la política de UPDATE: antes bloqueaba cualquier edición una
-- vez `firmada = true`, lo que impedía el flujo pedido de "devolver a
-- borrador" una fórmula aprobada para revisarla de nuevo. La
-- inmutabilidad de una fórmula ya aprobada pasa a resolverla la propia
-- API (decide qué transiciones de estado permite), no un bloqueo duro
-- de RLS; tenant_id y paciente activo se siguen exigiendo igual que en
-- el resto de las tablas clínicas (mismo patrón que 0016/0018/0019).
drop policy if exists formulaciones_terapeuticas_update on formulaciones_terapeuticas;

create policy formulaciones_terapeuticas_update on formulaciones_terapeuticas for update
  to authenticated
  using (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
  )
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id
        and p.tenant_id = formulaciones_terapeuticas.tenant_id
        and p.deleted_at is null
    )
  );
