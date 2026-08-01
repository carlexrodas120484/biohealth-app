-- Contexto clínico usado por el profesional al definir dosis.
-- No contiene un calculador automático: conserva trazabilidad para la firma.

alter table formulaciones_terapeuticas
  add column if not exists revision_clinica jsonb not null default '{
    "pesoKg":"",
    "embarazoLactancia":"no-aplica",
    "funcionRenal":"",
    "funcionHepatica":"",
    "laboratorios":"",
    "diagnosticoConfirmado":false
  }'::jsonb;

comment on column formulaciones_terapeuticas.revision_clinica is
  'Instantánea del contexto clínico revisado por el profesional antes de firmar; no es una recomendación automática.';
