import { createClient } from '@/lib/supabase/server';

export default async function AgendaPage() {
  const supabase = await createClient();
  const { data: turnos } = await supabase
    .from('agenda_turnos').select('*, pacientes(nombre)').order('fecha').order('hora');

  return (
    <div>
      <h1 className="mb-5 font-serif text-3xl text-choco-deep">Agenda</h1>
      <div className="rounded-card border border-linea bg-white p-5">
        {(turnos ?? []).map((t: any) => (
          <div key={t.id} className="flex gap-3 border-t border-linea py-2.5 text-[13.5px] first:border-none">
            <span className="w-24 text-choco-soft">{t.fecha}</span>
            <span className="w-14 font-mono text-choco-soft">{t.hora}</span>
            <span>{t.pacientes?.nombre}</span>
            <span className="ml-auto text-choco-soft">{t.tipo}</span>
          </div>
        ))}
        {(!turnos || turnos.length === 0) && <p className="py-6 text-center text-choco-soft">Sin turnos agendados.</p>}
      </div>
    </div>
  );
}
