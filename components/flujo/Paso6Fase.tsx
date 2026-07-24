'use client';

import { useEffect, useState } from 'react';
import { seleccionarFase, FASES, type Fase } from '@/lib/algoritmo/fases';
import type { AlteracionInput } from '@/lib/algoritmo/ipt';

interface Paso6FaseProps {
  alteraciones: AlteracionInput[];
  banderaRoja: boolean;
  faseSeleccionada: Fase | null;
  onSeleccionarFase: (fase: Fase, motivoAnulacion: string | null) => void;
}

const COLOR_FASE: Record<Fase, string> = {
  restore: '#5C7A4A', repair: '#C08A2E', reset: '#A85A3C',
  target: '#3F5F7A', regenerate: '#6B4E7A', balance: '#8A8072',
};

export function Paso6Fase({ alteraciones, banderaRoja, faseSeleccionada, onSeleccionarFase }: Paso6FaseProps) {
  // el mismo motor que ya se probó en el prototipo — no una recreación visual
  const resultado = seleccionarFase(alteraciones, banderaRoja);
  const [animadas, setAnimadas] = useState(0);

  useEffect(() => {
    setAnimadas(0);
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setAnimadas(resultado.compuertas.length); return; }
    let i = 0;
    const t = setInterval(() => {
      i++;
      setAnimadas(i);
      if (i >= resultado.compuertas.length) clearInterval(t);
    }, 260);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alteraciones, banderaRoja]);

  return (
    <div>
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 6</p>
      <h2 className="mb-1 font-serif text-2xl font-normal text-choco-deep">Selección de fase</h2>
      <p className="mb-5 text-[12.5px] text-choco-soft">
        Las compuertas se evalúan en orden. La primera que se cumple define la fase.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          {resultado.compuertas.map((c, i) => {
            const lit = i < animadas;
            const reached = c.evaluada || (c.orden === 1);
            return (
              <div
                key={c.orden}
                className={[
                  'mb-2 flex items-center gap-3.5 rounded-lg border px-4 py-3.5 transition-all duration-500',
                  lit ? 'opacity-100 translate-x-0' : 'opacity-30 -translate-x-1.5',
                  reached && c.cumple ? 'border-fase-restore bg-fase-restore/5' : '',
                  reached && !c.cumple ? 'bg-crema border-linea' : 'border-linea bg-white',
                ].join(' ')}
              >
                <span className="w-4 font-serif text-lg text-choco-soft">{c.orden}</span>
                <div className="flex-1">
                  <div className="text-[13.5px] text-choco-deep">{c.nombre}</div>
                  <div className="text-[11.5px] text-choco-soft">
                    {c.dominio ? `IPT dominio = ${c.iptDominio ?? '—'}` : (c.orden === 1 ? 'Derivar o estabilizar primero' : 'Sin dominio activo')}
                  </div>
                </div>
                <span
                  className="ml-auto text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: c.cumple ? '#5C7A4A' : '#9A8672' }}
                >
                  {!c.evaluada && c.orden !== 1 ? '—' : (c.cumple ? 'Cumple' : 'No cumple')}
                </span>
              </div>
            );
          })}
          <p className="mt-3 text-[11.5px] text-choco-soft">
            <span className="text-oro">▸</span> Las compuertas no evaluadas ya no aplican: una anterior resolvió la fase.
          </p>
        </div>

        <div className="rounded-card border border-linea bg-white p-5">
          <p className="mb-3.5 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Fase resultante</p>
          {(Object.keys(FASES) as Fase[]).map(k => {
            const f = FASES[k];
            const sel = faseSeleccionada === k;
            const sugerida = resultado.fase === k;
            return (
              <button
                key={k}
                onClick={() => onSeleccionarFase(k, sugerida ? null : `anulada por el médico, sugerencia era ${FASES[resultado.fase].nombre}`)}
                className={[
                  'mb-2 flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                  sel ? 'bg-crema border-[1.5px]' : 'border-linea hover:border-linea-fuerte',
                ].join(' ')}
                style={sel ? { borderColor: COLOR_FASE[k] } : undefined}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_FASE[k] }} />
                <span className="flex-1 text-[13.5px] text-choco-deep">{f.nombre}</span>
                {sugerida && (
                  <span className="rounded-full px-2.5 py-1 text-[11px] text-white" style={{ background: COLOR_FASE[k] }}>
                    Sugerida
                  </span>
                )}
              </button>
            );
          })}
          <p className="mt-3 text-[11.5px] text-choco-soft">
            <span className="text-oro">▸</span> Podés anular la sugerencia. El motivo queda registrado en la auditoría.
          </p>
        </div>
      </div>
    </div>
  );
}
