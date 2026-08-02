import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requerirRolAdminEnPagina } from '@/lib/adminAuth';
import { esUuidValido } from '@/lib/validation/id';
import { PrincipioAcciones } from '@/components/admin/PrincipioAcciones';

const ROLES_AUTORIZADOS = ['medico_titular'] as const;

const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: 'Borrador', en_revision: 'En revisión', validado: 'Validado', archivado: 'Archivado',
};
const COLOR_ESTADO: Record<string, string> = {
  borrador: 'bg-choco-soft/10 text-choco-soft',
  en_revision: 'bg-fase-target/10 text-fase-target',
  validado: 'bg-fase-restore/10 text-fase-restore',
  archivado: 'bg-fase-reset/10 text-fase-reset',
};

export default async function DetallePrincipioActivoPage({ params }: { params: { id: string } }) {
  if (!esUuidValido(params.id)) notFound();

  const supabase = await createClient();
  const { tenantId } = await requerirRolAdminEnPagina(supabase, ROLES_AUTORIZADOS);

  const { data: principio } = await supabase
    .from('principios_activos').select('*').eq('id', params.id)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`).maybeSingle();
  if (!principio) notFound();

  const p = principio as any;

  const [sinonimos, dosis, contraindicaciones, interacciones, incompatibilidades, evidencia] = await Promise.all([
    supabase.from('sinonimos_principios').select('*').eq('principio_id', params.id),
    supabase.from('dosis_principios').select('*').eq('principio_id', params.id),
    supabase.from('contraindicaciones_principios').select('*').eq('principio_id', params.id),
    supabase.from('interacciones_principios').select('*').eq('principio_id', params.id),
    supabase.from('incompatibilidades_formulacion').select('*, principio_incompatible:principios_activos!incompatibilidades_formulacion_principio_incompatible_id_fkey(nombre_canonico)').eq('principio_id', params.id),
    supabase.from('evidencia_cientifica').select('*, referencia:referencias_bibliograficas(*)').eq('principio_id', params.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/base-conocimiento" className="mb-3 inline-block text-[12.5px] text-choco-soft hover:underline">← Base de conocimiento</Link>

      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className="font-serif text-3xl text-choco-deep">{p.nombre_canonico}</h1>
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${COLOR_ESTADO[p.estado] ?? ''}`}>{ETIQUETA_ESTADO[p.estado] ?? p.estado}</span>
      </div>
      <p className="mb-4 text-[12.5px] text-choco-soft">Versión {p.version ?? 1} · Actualizado {p.updated_at ? new Date(p.updated_at).toLocaleString('es') : '—'}</p>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <PrincipioAcciones principioId={p.id} estado={p.estado} />
        <Link href={`/admin/base-conocimiento/${p.id}/editar`} className="rounded-md border border-linea bg-white px-3 py-1.5 text-[12.5px] font-medium text-choco-deep hover:bg-crema">Editar</Link>
        <Link href={`/admin/base-conocimiento/${p.id}/historial`} className="rounded-md border border-linea bg-white px-3 py-1.5 text-[12.5px] font-medium text-choco-deep hover:bg-crema">Ver historial</Link>
      </div>

      {p.estado !== 'validado' && (
        <div className="mb-5 rounded-card border border-fase-target/30 bg-fase-target/5 p-3 text-[12.5px] text-choco-deep">
          Este principio todavía no está validado: el motor de formulación no lo usa como sugerencia clínica hasta que pase a estado "Validado".
        </div>
      )}

      <section className="mb-4 rounded-card border border-linea bg-white p-5">
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Identificación</p>
        <dl className="grid gap-3 text-[13px] md:grid-cols-2">
          <div><dt className="text-choco-soft">Nombre comercial</dt><dd className="text-choco-deep">{p.nombre_comercial ?? '—'}</dd></div>
          <div><dt className="text-choco-soft">Sinónimos</dt><dd className="text-choco-deep">{(sinonimos.data ?? []).map((s: any) => s.sinonimo).join(', ') || '—'}</dd></div>
        </dl>
        {p.descripcion && <p className="mt-3 text-[13px] text-choco-deep">{p.descripcion}</p>}
        {p.mecanismo_accion && <p className="mt-2 text-[13px] text-choco-soft">{p.mecanismo_accion}</p>}
      </section>

      <section className="mb-4 rounded-card border border-linea bg-white p-5">
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Dosis</p>
        {(dosis.data ?? []).length === 0 && <p className="text-[13px] text-choco-soft">Sin dosis cargadas.</p>}
        {(dosis.data ?? []).map((d: any) => (
          <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-linea py-2 text-[13px] first:border-none">
            <span className="text-choco-deep">{d.tipo}: {d.valor} {d.unidad}{d.frecuencia ? ` · ${d.frecuencia}` : ''}</span>
            <span className={`text-[11.5px] ${d.sin_evidencia ? 'text-fase-reset' : 'text-fase-restore'}`}>
              {d.sin_evidencia ? 'Sin evidencia cargada' : 'Con referencia bibliográfica'}
            </span>
          </div>
        ))}
      </section>

      <section className="mb-4 rounded-card border border-linea bg-white p-5">
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Contraindicaciones</p>
        {(contraindicaciones.data ?? []).length === 0 && <p className="text-[13px] text-choco-soft">Ninguna cargada.</p>}
        {(contraindicaciones.data ?? []).map((c: any) => (
          <div key={c.id} className="border-t border-linea py-2 text-[13px] text-choco-deep first:border-none">{c.contraindicacion} <span className="text-choco-soft">({c.severidad})</span></div>
        ))}
      </section>

      <section className="mb-4 rounded-card border border-linea bg-white p-5">
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Interacciones e incompatibilidades</p>
        {(interacciones.data ?? []).length === 0 && (incompatibilidades.data ?? []).length === 0 && <p className="text-[13px] text-choco-soft">Ninguna cargada.</p>}
        {(interacciones.data ?? []).map((i: any) => (
          <div key={i.id} className="border-t border-linea py-2 text-[13px] text-choco-deep first:border-none">{i.descripcion} <span className="text-choco-soft">({i.severidad})</span></div>
        ))}
        {(incompatibilidades.data ?? []).map((i: any) => (
          <div key={i.id} className="border-t border-linea py-2 text-[13px] text-choco-deep first:border-none">
            Incompatible con {i.principio_incompatible?.nombre_canonico ?? '—'}{i.motivo ? ` — ${i.motivo}` : ''}
          </div>
        ))}
      </section>

      <section className="rounded-card border border-linea bg-white p-5">
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Evidencia y referencias</p>
        {(evidencia.data ?? []).length === 0 && <p className="text-[13px] text-choco-soft">Sin evidencia cargada.</p>}
        {(evidencia.data ?? []).map((e: any) => (
          <div key={e.id} className="border-t border-linea py-2 text-[13px] text-choco-deep first:border-none">
            Nivel {e.nivel_evidencia}{e.resumen ? ` — ${e.resumen}` : ''}
            {e.referencia?.fuente && <p className="text-[12px] text-choco-soft">{e.referencia.fuente}</p>}
          </div>
        ))}
      </section>
    </div>
  );
}
