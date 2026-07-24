/**
 * Tipos generados por Supabase a partir del esquema real:
 *   npx supabase gen types typescript --project-id <id> > types/database.ts
 *
 * Este archivo es un stub mínimo para que el proyecto compile antes del
 * primer `supabase gen types`. Se sobrescribe automáticamente y no debe
 * editarse a mano una vez conectado al proyecto real.
 */
export type Database = {
  public: {
    Tables: Record<string, { Row: Record<string, any>; Insert: Record<string, any>; Update: Record<string, any> }>;
  };
};
