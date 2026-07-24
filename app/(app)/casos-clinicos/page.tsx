import { createClient } from '@/lib/supabase/server';

export default async function CasosClinicosPage() {
  const supabase = await createClient();
  const { data: casos } = await supabase.from('casos_clinicos').select('*').order('ipt', { ascending: false });

  return (
    <div>
      <h1 className="mb-5 font-serif text-3xl text-choco-deep">Casos clínicos</h1>
      <div className="rounded-card border border-linea bg-white p-5">
        {(casos ?? []).map((c: any) => (
          <div key={c.id} className="border-t border-linea py-3.5 first:border-none">
            <p className="text-[14px] text-choco-deep">{c.titulo}</p>
            <p className="mt-1 text-[12.5px] text-choco-soft">{c.resumen}</p>
          </div>
        ))}
        {(!casos || casos.length === 0) && <p className="py-6 text-center text-choco-soft">Sin casos documentados todavía.</p>}
      </div>
    </div>
  );
}
