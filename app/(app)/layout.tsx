import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const NAV = [
  { href: '/dashboard', label: 'Panel' },
  { href: '/agenda', label: 'Agenda' },
  { href: '/pacientes', label: 'Pacientes' },
  { href: '/biblioteca', label: 'Biblioteca' },
  { href: '/casos-clinicos', label: 'Casos clínicos' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: usuario } = await supabase
    .from('usuarios').select('nombre').eq('auth_id', user.id).single();

  return (
    <div className="flex min-h-screen bg-crema">
      <nav className="w-[212px] shrink-0 border-r border-linea bg-white p-3.5">
        <div className="mb-6 px-2 pt-0.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-oro">Método</p>
          <p className="font-serif text-2xl text-choco-deep">BioHealth</p>
        </div>
        {NAV.map(item => (
          <Link key={item.href} href={item.href} className="mb-0.5 block rounded-md px-2.5 py-2 text-[13.5px] text-choco-mid hover:bg-crema">
            {item.label}
          </Link>
        ))}
        <div className="mt-auto pt-8 text-[11px] leading-relaxed text-choco-soft">
          {(usuario as any)?.nombre ?? user.email}
        </div>
      </nav>
      <main className="flex-1 px-8 py-7">{children}</main>
    </div>
  );
}
