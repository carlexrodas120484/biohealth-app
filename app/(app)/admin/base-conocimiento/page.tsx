import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requerirRolAdminEnPagina } from '@/lib/adminAuth';
import { ESTADOS_PRINCIPIO } from '@/lib/validation/baseConocimiento';

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

export default async function BaseConocimientoPage({ searchParams }: { searchParams: { q?: string; estado?: string } }) {
  const supabase = await createClient();
  const { tenantId } = await requerirRolAdminEnPagina(supabase, ROLES_AUTORIZADOS);

  const q = (searchParams.q ?? '').trim();
  const estado = searchParams.estado ?? '';

  let query = supabase
    .from('principios_activos')
    .select('id, nombre_canonico, nombre_comercial, estado, version, updated_at')
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .order('nombre_canonico', { ascending: true });

  if (q) query = query.ilike('nombre_canonico', `%${q}%`);
  if (estado && (ESTADOS_PRINCIPIO as readonly string[]).includes(estado)) query = query.eq('estado', estado);

  const { data: principios } = await query;

  return (
    <div className="mx-auto max-w-6xl">
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Evidencia y seguridad</p>
      <h1 className="font-serif text-3xl text-choco-deep">Base de conocimiento clínica</h1>
      <p className="mb-5 mt-1 max-w-3xl text-sm text-choco-soft">
        Principios activos, dosis, evidencia e interacciones. Ningún registro habilita diagnóstico ni prescripción automática:
        el motor de formulación sólo lee principios en estado <strong>validado</strong>.
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href="/admin/base-conocimiento/nuevo" className="rounded-md bg-choco-deep px-3.5 py-2 text-[13px] font-medium text-white hover:bg-choco-mid">
          + Nuevo principio activo
        </Link>
        <Link href="/admin/base-conocimiento/importar" className="rounded-md border border-linea bg-white px-3.5 py-2 text-[13px] font-medium text-choco-deep hover:bg-crema">
          Importar CSV
        </Link>
        <a href="/api/admin/base-conocimiento/plantilla" className="rounded-md border border-linea bg-white px-3.5 py-2 text-[13px] font-medium text-choco-deep hover:bg-crema">
          Descargar plantilla
        </a>
        <a href="/api/admin/base-conocimiento/exportar" className="rounded-md border border-linea bg-white px-3.5 py-2 text-[13px] font-medium text-choco-deep hover:bg-crema">
          Exportar CSV
        </a>
      </div>

      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input
          type="text" name="q" defaultValue={q} placeholder="Buscar por nombre..."
          className="w-64 rounded-md border border-linea bg-white px-3 py-2 text-sm focus:border-oro-claro focus:outline-none focus:ring-2 focus:ring-oro/10"
        />
        <select name="estado" defaultValue={estado} className="rounded-md border border-linea bg-white px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          {ESTADOS_PRINCIPIO.map(e => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
        </select>
        <button type="submit" className="rounded-md border border-linea bg-white px-3.5 py-2 text-[13px] font-medium text-choco-deep hover:bg-crema">
          Filtrar
        </button>
      </form>

      <section className="rounded-card border border-linea bg-white p-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-linea text-[10px] uppercase tracking-wider text-choco-soft">
              <tr>
                <th className="pb-2">Nombre canónico</th>
                <th className="pb-2">Nombre comercial</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2">Versión</th>
                <th className="pb-2">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {(principios ?? []).map((p: any) => (
                <tr key={p.id} className="border-b border-linea last:border-0">
                  <td className="py-3 pr-4 font-medium text-choco-deep">
                    <Link href={`/admin/base-conocimiento/${p.id}`} className="hover:underline">{p.nombre_canonico}</Link>
                  </td>
                  <td className="py-3 pr-4 text-choco-mid">{p.nombre_comercial ?? '—'}</td>
                  <td className="py-3 pr-4">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${COLOR_ESTADO[p.estado] ?? ''}`}>
                      {ETIQUETA_ESTADO[p.estado] ?? p.estado}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-choco-mid">v{p.version ?? 1}</td>
                  <td className="py-3 text-choco-soft">{p.updated_at ? new Date(p.updated_at).toLocaleDateString('es') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!principios || principios.length === 0) && (
          <p className="py-6 text-center text-choco-soft">No hay principios activos que coincidan con la búsqueda.</p>
        )}
      </section>
    </div>
  );
}
