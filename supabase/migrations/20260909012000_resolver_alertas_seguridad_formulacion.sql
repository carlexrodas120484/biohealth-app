alter table public.evaluaciones_seguridad_formulacion
  add column if not exists estado_resolucion text not null default 'pendiente',
  add column if not exists resolucion_tipo text,
  add column if not exists resolucion_detalle jsonb not null default '{}'::jsonb;

alter table public.evaluaciones_seguridad_formulacion
  drop constraint if exists evaluaciones_seguridad_formulacion_estado_resolucion_check;

alter table public.evaluaciones_seguridad_formulacion
  add constraint evaluaciones_seguridad_formulacion_estado_resolucion_check
  check (estado_resolucion in ('pendiente','resuelta'));

alter table public.evaluaciones_seguridad_formulacion
  drop constraint if exists evaluaciones_seguridad_formulacion_resolucion_tipo_check;

alter table public.evaluaciones_seguridad_formulacion
  add constraint evaluaciones_seguridad_formulacion_resolucion_tipo_check
  check (resolucion_tipo is null or resolucion_tipo in ('aceptada_justificada','descartada'));

create index if not exists idx_eval_seguridad_consulta_resolucion
  on public.evaluaciones_seguridad_formulacion (consulta_id, estado_resolucion, created_at desc);

create or replace function public.resolver_alerta_seguridad_formulacion(
  p_consulta_id uuid,
  p_principio_id uuid,
  p_resolucion_tipo text,
  p_justificacion text,
  p_usuario_id uuid
)
returns public.evaluaciones_seguridad_formulacion
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eval public.evaluaciones_seguridad_formulacion;
  v_tenant uuid;
begin
  if p_resolucion_tipo not in ('aceptada_justificada','descartada') then
    raise exception 'Tipo de resolución inválido';
  end if;

  if p_justificacion is null or length(trim(p_justificacion)) < 5 then
    raise exception 'La justificación clínica es obligatoria';
  end if;

  select tenant_id into v_tenant
  from consultas
  where id = p_consulta_id and deleted_at is null;

  if v_tenant is null then raise exception 'Consulta no encontrada'; end if;

  select * into v_eval
  from public.evaluaciones_seguridad_formulacion
  where consulta_id = p_consulta_id
    and principio_id = p_principio_id
    and estado_resolucion = 'pendiente'
  order by created_at desc
  limit 1;

  if not found then
    insert into public.evaluaciones_seguridad_formulacion(
      tenant_id, consulta_id, principio_id, nivel, motivo, datos_disparadores
    )
    select v_tenant, p_consulta_id, p_principio_id, e.nivel, e.motivo, e.datos_disparadores
    from public.evaluar_seguridad_contextual(p_consulta_id, p_principio_id) e
    limit 1
    returning * into v_eval;
  end if;

  update public.evaluaciones_seguridad_formulacion
  set resuelto = true,
      estado_resolucion = 'resuelta',
      resolucion_tipo = p_resolucion_tipo,
      justificacion_resolucion = trim(p_justificacion),
      resuelto_por = p_usuario_id,
      resolved_at = now(),
      resolucion_detalle = jsonb_build_object('resuelto_en', now())
  where id = v_eval.id
  returning * into v_eval;

  return v_eval;
end;
$$;