import { createClient } from '@/lib/supabase/server';
import { requerirRolAdminEnPagina } from '@/lib/adminAuth';
import { ImportarCSVBaseConocimiento } from '@/components/admin/ImportarCSVBaseConocimiento';

const ROLES_AUTORIZADOS = ['medico_titular'] as const;

export default async function ImportarBaseConocimientoPage() {
  const supabase = await createClient();
  await requerirRolAdminEnPagina(supabase, ROLES_AUTORIZADOS);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Base de conocimiento</p>
      <h1 className="mb-1 font-serif text-3xl text-choco-deep">Importación masiva por CSV</h1>
      <p className="mb-5 max-w-2xl text-sm text-choco-soft">
        Descargue la <a href="/api/admin/base-conocimiento/plantilla" className="underline">plantilla</a> antes de cargar su archivo.
        Toda dosis importada queda marcada "sin evidencia cargada" hasta vincular una referencia bibliográfica.
        Los principios ya validados nunca se sobrescriben sin autorización explícita.
      </p>
      <ImportarCSVBaseConocimiento />
    </div>
  );
}
