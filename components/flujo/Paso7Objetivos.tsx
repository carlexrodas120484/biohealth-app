'use client';

import { FASES, type Fase } from '@/lib/algoritmo/fases';

interface Paso7ObjetivosProps {
  fase: Fase;
  seleccionados: Set<number>;
  onToggle: (index: number) => void;
}

export function Paso7Objetivos({ fase, seleccionados, onToggle }: Paso7ObjetivosProps) {
  const f = FASES[fase];

  return (
    <div>
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 7</p>
      <h2 className="mb-1 font-serif text-2xl font-normal text-choco-deep">Objetivos terapéuticos</h2>
      <p className="mb-5 text-[12.5px] text-choco-soft">Solo los objetivos de la fase {f.nombre}. Nada más.</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-card border border-linea bg-white p-5">
          {f.objetivos.map((o, i) => {
            const on = seleccionados.has(i);
            return (
              <button
                key={o}
                onClick={() => onToggle(i)}
                className={[
                  'mb-1.5 flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[13.5px]',
                  on ? 'border-oro-claro bg-oro-wash text-choco-deep' : 'border-linea text-choco-mid',
                ].join(' ')}
              >
                <span className={['flex h-[17px] w-[17px] items-center justify-center rounded-[5px] text-[10px] text-white', on ? 'bg-oro' : 'border border-linea-fuerte'].join(' ')}>
                  {on && '✓'}
                </span>
                {o}
              </button>
            );
          })}
          <p className="mt-3.5 text-[11.5px] text-choco-soft">
            <span className="text-oro">▸</span> {seleccionados.size} objetivo{seleccionados.size === 1 ? '' : 's'} seleccionado{seleccionados.size === 1 ? '' : 's'} · duración prevista {f.semanasMinimas} semanas
          </p>
        </div>

        <div className="rounded-card border border-linea bg-white p-5">
          <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Por qué esta restricción</p>
          <p className="text-[13.5px] leading-7 text-choco-mid">
            Una fase con ocho objetivos no es una fase: es una lista de deseos. El Método limita cada ciclo a los
            objetivos que la fase puede realmente resolver, para que el control del paso 10 mida algo concreto.
          </p>
          <p className="mt-3 text-[13.5px] leading-7 text-choco-mid">
            Los objetivos que quedan afuera no se pierden. Vuelven a competir en el IPT del próximo ciclo.
          </p>
        </div>
      </div>
    </div>
  );
}
