-- Motor de patrones funcionales sobre diagnosticos_funcionales.
--
-- No destructiva: agrega una columna nueva con default, no toca
-- `alteraciones`/`perpetuadores`/`deficits`/`impresion`/`estudios`/
-- `confirmado` (esos campos alimentan IPT y Fase Terapéutica tal como
-- están: `app/api/pacientes/[id]/ipt/route.ts` y
-- .../[id]/fase/route.ts leen `alteraciones` con su forma actual, así
-- que no se modifica). No cambia la unique constraint
-- (tenant_id, paciente_id): sigue habiendo un único diagnóstico activo
-- por paciente.
--
-- `patrones`: snapshot de los patrones funcionales de la última vez que
-- el médico guardó (sugeridos por el motor determinista de
-- lib/clinica/patrones.ts, mezclados con las decisiones del médico:
-- confirmado/descartado/prioridad/observaciones). No es un historial
-- por versión — cada guardado reemplaza el snapshot anterior, igual que
-- el resto de las tablas clínicas de este proyecto.
--
-- Cómo ejecutarla: igual que el resto (supabase db push o pegarla en el
-- SQL editor del proyecto). Idempotente: correrla dos veces no falla.

alter table diagnosticos_funcionales
  add column if not exists patrones jsonb not null default '[]'::jsonb;

-- Endurece INSERT/UPDATE para exigir que el paciente esté activo,
-- mismo backstop de defensa en profundidad ya aplicado en
-- historias_clinicas (0016): la API ya lo valida, esto es el respaldo
-- independiente de la API a nivel de política.

drop policy if exists diagnosticos_insert on diagnosticos_funcionales;
drop policy if exists diagnosticos_update on diagnosticos_funcionales;

create policy diagnosticos_insert on diagnosticos_funcionales for insert
  to authenticated
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id
        and p.tenant_id = diagnosticos_funcionales.tenant_id
        and p.deleted_at is null
    )
  );

create policy diagnosticos_update on diagnosticos_funcionales for update
  to authenticated
  using (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
  )
  with check (
    tenant_id = (select u.tenant_id from usuarios u where u.auth_id = auth.uid())
    and exists (
      select 1 from pacientes p
      where p.id = paciente_id
        and p.tenant_id = diagnosticos_funcionales.tenant_id
        and p.deleted_at is null
    )
  );
