'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PacienteFila {
  id: string;
  nombre: string;
  apellido: string | null;
  documento: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
}

function calcularEdad(fechaNacimiento: string | null): string {
  if (!fechaNacimiento) return '—';
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return `${edad} años`;
}

export function ListaPacientes({ pacientesIniciales }: { pacientesIniciales: PacienteFila[] }) {
  const [q, setQ] = useState('');
  const [pacientes, setPacientes] = useState(pacientesIniciales);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setCargando(true);
      try {
        const res = await fetch(`/api/pacientes?q=${encodeURIComponent(q)}`);
        const body = await res.json();
        if (res.ok) setPacientes(body.pacientes ?? []);
      } finally {
        setCargando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre, apellido o documento…"
          className="flex-1 rounded-md border border-linea px-3.5 py-2.5 text-sm focus:border-oro-claro focus:outline-none focus:ring-2 focus:ring-oro/10"
        />
      </div>

      {/* tabla en pantallas medianas+, tarjetas en celular */}
      <div className="hidden overflow-hidden rounded-card border border-linea bg-white sm:block">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-b border-linea text-left text-[10.5px] uppercase tracking-wider text-choco-soft">
              <th className="px-5 py-3 font-normal">Nombre</th>
              <th className="px-5 py-3 font-normal">Documento</th>
              <th className="px-5 py-3 font-normal">Edad</th>
              <th className="px-5 py-3 font-normal">Teléfono</th>
            </tr>
          </thead>
          <tbody>
            {pacientes.map(p => (
              <tr key={p.id} className="border-b border-linea last:border-none hover:bg-crema">
                <td className="px-5 py-3">
                  <Link href={`/pacientes/ficha/${p.id}`} className="text-choco-deep hover:text-oro">
                    {p.nombre} {p.apellido ?? ''}
                  </Link>
                </td>
                <td className="px-5 py-3 text-choco-soft">{p.documento ?? '—'}</td>
                <td className="px-5 py-3 text-choco-soft">{calcularEdad(p.fecha_nacimiento)}</td>
                <td className="px-5 py-3 text-choco-soft">{p.telefono ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pacientes.length === 0 && !cargando && (
          <p className="px-5 py-8 text-center text-[13px] text-choco-soft">
            {q ? 'No se encontraron pacientes con esa búsqueda.' : 'Sin pacientes cargados todavía.'}
          </p>
        )}
      </div>

      {/* tarjetas en celular */}
      <div className="space-y-2.5 sm:hidden">
        {pacientes.map(p => (
          <Link
            key={p.id}
            href={`/pacientes/ficha/${p.id}`}
            className="block rounded-card border border-linea bg-white p-4"
          >
            <p className="text-[14px] text-choco-deep">{p.nombre} {p.apellido ?? ''}</p>
            <p className="mt-1 text-[12px] text-choco-soft">
              {p.documento ?? 'Sin documento'} · {calcularEdad(p.fecha_nacimiento)}
            </p>
          </Link>
        ))}
        {pacientes.length === 0 && !cargando && (
          <p className="rounded-card border border-linea bg-white px-5 py-8 text-center text-[13px] text-choco-soft">
            {q ? 'No se encontraron pacientes con esa búsqueda.' : 'Sin pacientes cargados todavía.'}
          </p>
        )}
      </div>
    </div>
  );
}
