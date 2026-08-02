import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requerirRolAdminEnPagina } from '@/lib/adminAuth';
import { esUuidValido } from '@/lib/validation/id';

const ROLES_AUTORIZADOS = ['medico_titular'] as const;

export default async function HistorialPrincipioActivoPage({ params }: { params: { id: string } }) {
  if (!esUuidValido(params.id)) notFound();

  const supabase = await createClient();
  const { tenantId } = await requerirRolAdminEnPagina(supabase, ROLES_AUTORIZADOS);

  const { data: principio } = await supabase
    .from('principios_activos').select('id, nombre_canonico').eq('id', params.id)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`).maybeSingle();
  if (!principio) notFound();

  const { data: historial } = await supabase
    .from('historial_principios_activos').select('*').eq('principio_id', params.id)
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/admin/base-conocimiento/${params.id}`} className="mb-3 inline-block text-[12.5px] text-choco-soft hover:underline">← {(principio as any).nombre_canonico}</Link>
      <h1 className="mb-1 font-serif text-3xl text-choco-deep">Historial de cambios</h1>
      <p className="mb-5 text-sm text-choco-soft">Registro de auditoría de sólo lectura: nunca se sobrescribe ni se borra.</p>

      <section className="rounded-card border border-linea bg-white p-5">
        {(historial ?? []).length === 0 && <p className="text-[13px] text-choco-soft">Sin movimientos registrados.</p>}
        {(historial ?? []).map((h: any) => (
          <div key={h.id} className="border-t border-linea py-3 text-[13px] first:border-none">
            <div className="flex items-center justify-between">
              <span className="font-medium text-choco-deep">{h.accion}</span>
              <span className="text-choco-soft">{h.created_at ? new Date(h.created_at).toLocaleString('es') : ''}</span>
            </div>
            {h.campo_modificado && (
              <p className="mt-1 text-[12px] text-choco-soft">{h.campo_modificado}: {h.valor_anterior ?? '—'} → {h.valor_nuevo ?? '—'}</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
