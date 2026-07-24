import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { count: pacientesActivos } = await supabase
    .from('pacientes').select('*', { count: 'exact', head: true }).is('deleted_at', null);

  const { data: turnosHoy } = await supabase
    .from('agenda_turnos').select('*, pacientes(nombre)').eq('fecha', new Date().toISOString().slice(0, 10));

  return (
    <div>
      <h1 className="mb-1 font-serif text-3xl text-choco-deep">
        Buenos días{user?.email ? `, ${user.email.split('@')[0]}` : ''}
      </h1>
      <p className="mb-6 text-[12.5px] text-choco-soft">
        {new Date().toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      <div className="grid grid-cols-4 gap-3.5">
        <div className="rounded-card border border-linea bg-white p-4">
          <p className="text-[11px] text-choco-soft">Pacientes activos</p>
          <p className="mt-1 font-serif text-4xl text-choco-deep">{pacientesActivos ?? 0}</p>
        </div>
        <div className="rounded-card border border-linea bg-white p-4">
          <p className="text-[11px] text-choco-soft">Turnos hoy</p>
          <p className="mt-1 font-serif text-4xl text-choco-deep">{turnosHoy?.length ?? 0}</p>
        </div>
      </div>

      {turnosHoy && turnosHoy.length > 0 && (
        <div className="mt-5 rounded-card border border-linea bg-white p-5">
          <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Agenda de hoy</p>
          {turnosHoy.map((t: any) => (
            <div key={t.id} className="flex gap-3 border-t border-linea py-2.5 text-[13.5px] first:border-none">
              <span className="w-14 font-mono text-choco-soft">{t.hora}</span>
              <span>{t.pacientes?.nombre}</span>
              <span className="ml-auto text-choco-soft">{t.tipo}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
