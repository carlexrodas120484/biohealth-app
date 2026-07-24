'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError('Email o contraseña incorrectos.'); return; }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-crema px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-card border border-linea bg-white p-8">
        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-oro">Método</p>
        <h1 className="mb-6 font-serif text-3xl text-choco-deep">BioHealth</h1>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-[11px] text-choco-soft">Email</span>
          <input
            type="email" required value={email} onChange={e => setEmail(e.target.value)}
            className="w-full rounded-md border border-linea px-3 py-2 text-sm"
          />
        </label>
        <label className="mb-5 block">
          <span className="mb-1.5 block text-[11px] text-choco-soft">Contraseña</span>
          <input
            type="password" required value={password} onChange={e => setPassword(e.target.value)}
            className="w-full rounded-md border border-linea px-3 py-2 text-sm"
          />
        </label>

        {error && <p className="mb-4 text-[12.5px] text-fase-reset">{error}</p>}

        <button type="submit" disabled={loading} className="w-full rounded-md bg-choco-deep py-2.5 text-sm text-crema disabled:opacity-50">
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
