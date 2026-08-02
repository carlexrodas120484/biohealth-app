-- Agrega el número de versión del cuestionario funcional a
-- historias_clinicas. No destructiva: sólo agrega una columna con
-- default, no toca datos existentes ni cambia la unique constraint
-- (tenant_id, paciente_id) — sigue habiendo un único registro de
-- cuestionario activo por paciente.
--
-- `version` identifica con qué versión del *contenido* del cuestionario
-- (conjunto de preguntas, lib/clinica/cuestionario.ts) se guardó ese
-- registro — no es un historial de versiones por paciente. Sirve para
-- detectar más adelante que un cuestionario fue respondido con una
-- versión anterior de las preguntas y ofrecer actualizarlo.
--
-- Cómo ejecutarla: se aplica igual que el resto de las migraciones del
-- proyecto (supabase db push, o pegándola en el SQL editor del proyecto
-- Supabase). Es idempotente: correrla dos veces no falla ni duplica la
-- columna.

alter table historias_clinicas
  add column if not exists version integer not null default 1;
