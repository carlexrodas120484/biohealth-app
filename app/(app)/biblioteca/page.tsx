import { createClient } from '@/lib/supabase/server';
import { FUENTES_CLINICAS, NIVELES_EVIDENCIA, resumenFuentes, type NivelEvidencia } from '@/lib/clinica/evidencia';

export default async function BibliotecaPage() {
  const supabase = await createClient();
  const { data: activos } = await supabase
    .from('biblioteca_activos').select('*').eq('vigente', true).order('nombre');

  const colores: Record<NivelEvidencia, string> = {
    A: 'bg-fase-restore/10 text-fase-restore', B: 'bg-fase-target/10 text-fase-target',
    C: 'bg-fase-repair/10 text-fase-repair', D: 'bg-fase-reset/10 text-fase-reset',
  };

  return (
    <div className="mx-auto max-w-6xl">
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Evidencia y seguridad</p>
      <h1 className="font-serif text-3xl text-choco-deep">Biblioteca BioHealth</h1>
      <p className="mb-5 mt-1 max-w-3xl text-sm text-choco-soft">Los documentos apoyan la decisión médica. Ninguna fuente genera diagnósticos, dosis o prescripciones automáticas.</p>

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        {resumenFuentes().map(r => <article key={r.nivel} className="rounded-card border border-linea bg-white p-4">
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${colores[r.nivel]}`}>{r.nivel}</span>
          <p className="mt-3 text-sm font-medium text-choco-deep">{r.nombre}</p>
          <p className="mt-1 text-xs leading-relaxed text-choco-soft">{r.descripcion}</p>
          <p className="mt-2 text-[11px] text-choco-mid">{r.cantidad} fuentes clasificadas</p>
        </article>)}
      </div>

      <section className="mb-5 rounded-card border border-linea bg-white p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div><p className="text-[9.5px] font-semibold uppercase tracking-wider text-oro">Catálogo editorial inicial</p>
          <p className="mt-1 text-xs text-choco-soft">Clasificación clínica del material aportado; pendiente de extracción documental completa y control de vigencia.</p></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[13px]">
          <thead className="border-b border-linea text-[10px] uppercase tracking-wider text-choco-soft"><tr><th className="pb-2">Fuente</th><th className="pb-2">Tema</th><th className="pb-2">Nivel</th><th className="pb-2">Uso permitido</th><th className="pb-2">Estado</th></tr></thead>
          <tbody>{FUENTES_CLINICAS.map(f => <tr key={f.id} className="border-b border-linea last:border-0">
            <td className="py-3 pr-4 font-medium text-choco-deep">{f.titulo}{f.advertencia && <p className="mt-1 text-[11px] font-normal text-fase-reset">{f.advertencia}</p>}</td>
            <td className="py-3 pr-4 text-choco-mid">{f.tema}</td>
            <td className="py-3 pr-4"><span className={`rounded-full px-2 py-1 font-semibold ${colores[f.nivel]}`}>{f.nivel}</span></td>
            <td className="py-3 pr-4 text-choco-mid">{f.uso}</td><td className="py-3 text-choco-soft">{f.estado}</td>
          </tr>)}</tbody>
        </table></div>
      </section>

      <div className="rounded-card border border-linea bg-white p-5">
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Activos clínicos validados</p>
        {(activos ?? []).map((a: any) => (
          <div key={a.id} className="flex justify-between border-t border-linea py-2.5 text-[13.5px] first:border-none">
            <span>{a.nombre}</span>
            <span className="text-choco-soft">{a.familia} · {a.fase}</span>
          </div>
        ))}
        {(!activos || activos.length === 0) && (
          <p className="py-6 text-center text-choco-soft">
            Todavía no hay activos validados para prescripción. La clasificación documental anterior no los habilita automáticamente.
          </p>
        )}
      </div>
    </div>
  );
}
