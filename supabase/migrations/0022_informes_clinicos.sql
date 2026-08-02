-- Amplía documentos_clinicos_generados para el módulo de Informe
-- Clínico y PDF: además de los 3 documentos ligados a una formulación
-- firmada (receta_botica/informe_medico/informe_paciente, sin cambios),
-- ahora se registran 6 tipos de informe nuevos que pueden depender de
-- historia clínica, diagnóstico, plan terapéutico y/o plan nutricional
-- — ninguno de los cuales requiere una formulación existente.
--
-- No destructiva: sólo agrega columnas con default y amplía el check
-- de `tipo` (se dropea y se vuelve a crear con la lista ampliada, lo
-- que no borra ninguna fila existente). formulacion_id pasa a ser
-- nullable porque los tipos nuevos no siempre tienen una formulación
-- asociada.

alter table documentos_clinicos_generados
  alter column formulacion_id drop not null;

alter table documentos_clinicos_generados
  add column if not exists version integer not null default 1,
  add column if not exists contenido_hash text,
  add column if not exists estado text not null default 'generado'
    check (estado in ('generado', 'anulado'));

alter table documentos_clinicos_generados drop constraint if exists documentos_clinicos_generados_tipo_check;
alter table documentos_clinicos_generados add constraint documentos_clinicos_generados_tipo_check
  check (tipo in (
    'receta_botica', 'informe_medico', 'informe_paciente',
    'informe_clinico_completo', 'resumen_diagnostico', 'plan_terapeutico',
    'receta_ortomolecular', 'plan_nutricional', 'informe_integrado'
  ));

create index if not exists ix_documentos_clinicos_paciente_tipo
  on documentos_clinicos_generados (tenant_id, paciente_id, tipo, generado_en desc);
