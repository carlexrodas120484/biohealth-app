'use client';

import { useState } from 'react';

export interface PreguntaCuestionario { sistema: string; pregunta: string; respuesta: 0 | 1 | 2 }

const OPCIONES = ['Nunca', 'A veces', 'Frecuente'];

interface Paso2CuestionarioProps {
  preguntas: PreguntaCuestionario[];
  onResponder: (index: number, valor: 0 | 1 | 2) => void;
}

export function Paso2Cuestionario({ preguntas, onResponder }: Paso2CuestionarioProps) {
  const sistemas = Array.from(new Set(preguntas.map(p => p.sistema)));
  const [sistema, setSistema] = useState(sistemas[0]);
  const delSistema = preguntas.filter(p => p.sistema === sistema);
  const respondidas = delSistema.filter(p => p.respuesta !== null).length;

  return (
    <div>
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 2</p>
      <h2 className="mb-1 font-serif text-2xl font-normal text-choco-deep">Cuestionario funcional</h2>
      <p className="mb-5 text-[12.5px] text-choco-soft">Organizado por órganos y sistemas.</p>

      <div className="rounded-card border border-linea bg-white p-5">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {sistemas.map(s => (
            <button
              key={s}
              onClick={() => setSistema(s)}
              className={[
                'rounded-full px-3 py-1.5 text-xs',
                s === sistema ? 'bg-oro text-white' : 'border border-linea text-choco-soft',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
        </div>

        {delSistema.map((p) => {
          const globalIndex = preguntas.indexOf(p);
          return (
            <div key={globalIndex} className="mb-4">
              <p className="mb-1.5 text-[13.5px]">{p.pregunta}</p>
              <div className="flex gap-1.5">
                {OPCIONES.map((o, j) => (
                  <button
                    key={o}
                    onClick={() => onResponder(globalIndex, j as 0 | 1 | 2)}
                    className={[
                      'flex-1 rounded-md border py-1.5 text-xs',
                      j === p.respuesta ? 'border-oro-claro bg-oro-wash text-choco-deep' : 'border-linea text-choco-soft',
                    ].join(' ')}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <p className="border-t border-linea pt-3.5 text-[11.5px] text-choco-soft">
          <span className="text-oro">▸</span> Sistema {sistema.toLowerCase()} · {respondidas} de {delSistema.length} respondidas
        </p>
      </div>
    </div>
  );
}
