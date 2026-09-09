create or replace function public.alertas_seguridad_contextual(p_consulta_id uuid)
returns table(
  principio_id uuid,
  nombre text,
  nivel text,
  motivo text,
  datos_disparadores jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  r record;
  e record;
begin
  select tenant_id into v_tenant
  from consultas
  where id = p_consulta_id and deleted_at is null;

  if v_tenant is null then
    return;
  end if;

  for r in
    select id, nombre_canonico
    from principios_activos
    where coalesce(estado, '') <> 'archivado'
      and (tenant_id is null or tenant_id = v_tenant)
  loop
    select * into e
    from public.evaluar_seguridad_contextual(p_consulta_id, r.id)
    limit 1;

    if e.nivel = 'bloqueado'
       or coalesce(e.datos_disparadores, '{}'::jsonb) ?| array[
         'coincidencias', 'embarazo', 'lactancia', 'deterioro_renal', 'deterioro_hepatico'
       ]
    then
      principio_id := r.id;
      nombre := r.nombre_canonico;
      nivel := e.nivel;
      motivo := e.motivo;
      datos_disparadores := e.datos_disparadores;
      return next;
    end if;
  end loop;
end;
$$;