import { createClient } from '@/lib/supabase/server';

export default async function BibliotecaPage() {
  const supabase = await createClient();
  const { data: activos } = await supabase
    .from('biblioteca_activos').select('*').eq('vigente', true).order('nombre');

  return (
    <div>
      <h1 className="mb-5 font-serif text-3xl text-choco-deep">Biblioteca BioHealth</h1>
      <div className="rounded-card border border-linea bg-white p-5">
        {(activos ?? []).map((a: any) => (
          <div key={a.id} className="flex justify-between border-t border-linea py-2.5 text-[13.5px] first:border-none">
            <span>{a.nombre}</span>
            <span className="text-choco-soft">{a.familia} · {a.fase}</span>
          </div>
        ))}
        {(!activos || activos.length === 0) && (
          <p className="py-6 text-center text-choco-soft">
            Biblioteca vacía. Cargá los activos vía <code>supabase/seed.sql</code>.
          </p>
        )}
      </div>
    </div>
  );
}
