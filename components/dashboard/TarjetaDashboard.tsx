'use client';

import type { ReactNode } from 'react';

export function TarjetaDashboard({
  titulo, acciones, children, className = '',
}: {
  titulo: string;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-card border border-linea bg-white p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[9.5px] font-semibold uppercase tracking-wider text-oro">{titulo}</p>
        {acciones}
      </div>
      {children}
    </section>
  );
}
