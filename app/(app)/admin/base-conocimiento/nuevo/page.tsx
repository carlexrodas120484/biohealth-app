import { createClient } from '@/lib/supabase/server';
import { requerirRolAdminEnPagina } from '@/lib/adminAuth';
import { PrincipioActivoForm } from '@/components/admin/PrincipioActivoForm';

const ROLES_AUTORIZADOS = ['medico_titular'] as const;

export default async function NuevoPrincipioActivoPage() {
  const supabase = await createClient();
  await requerirRolAdminEnPagina(supabase, ROLES_AUTORIZADOS);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Base de conocimiento</p>
      <h1 className="mb-1 font-serif text-3xl text-choco-deep">Nuevo principio activo</h1>
      <p className="mb-5 text-sm text-choco-soft">
        Se crea en estado <strong>borrador</strong>. Debe pasar por revisión y validación antes de que el motor de formulación pueda usarlo.
      </p>
      <PrincipioActivoForm modo="crear" />
    </div>
  );
}
