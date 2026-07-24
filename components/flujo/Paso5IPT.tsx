'use client';

import { useMemo, useState } from 'react';
import { calcularRankingIPT, bandaDe, PESOS_DEFAULT, JERARQUIA_DEFAULT, type AlteracionInput } from '@/lib/algoritmo/ipt';

const BANDA_COLOR: Record<string, string> = {
  critica: '#A85A3C',
  alta: '#C08A2E',
  media: '#6B5544',
  diferida: '#9A8672',
};

interface Paso5IPTProps {
  alteraciones: AlteracionInput[];
  /** pesos vigentes para este tenant — vienen de la tabla `ipt_pesos`, no hardcodeados */
  pesos?: typeof PESOS_DEFAULT;
  jerarquia?: typeof JERARQUIA_DEFAULT;
}

export function Paso5IPT({ alteraciones, pesos = PESOS_DEFAULT, jerarquia = JERARQUIA_DEFAULT }: Paso5IPTProps) {
  const [abierto, setAbierto] = useState<string | null>(null);

  // el cálculo real, no un mock — mismo motor que ya se validó en el prototipo
  const ranking = useMemo(
    () => calcularRankingIPT(alteraciones, pesos, jerarquia),
    [alteraciones, pesos, jerarquia]
  );

  return (
    <div>
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 5</p>
      <h2 className="mb-1 font-serif text-2xl font-normal text-choco-deep">Índice de prioridad terapéutica</h2>
      <p className="mb-5 text-[12.5px] text-choco-soft">
        Impacto · influencia · reversibilidad · evidencia · costo-beneficio. Tocá una alteración para ver el cálculo.
      </p>

      <div className="rounded-card border border-linea bg-white p-5">
        {ranking.map((r, i) => {
          const alteracion = alteraciones.find(a => a.id === r.alteracionId)!;
          const banda = bandaDe(r.final);
          const abiertoAqui = abierto === r.alteracionId;
          const color = BANDA_COLOR[banda.banda];

          return (
            <div key={r.alteracionId} className={i > 0 ? 'border-t border-linea pt-3.5 mt-3.5' : ''}>
              <button
                className="flex w-full items-center gap-3 text-left"
                onClick={() => setAbierto(abiertoAqui ? null : r.alteracionId)}
              >
                <span className="w-6 font-serif text-lg text-choco-soft">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-choco-deep">{alteracion.nombre}</span>
                    {alteracion.perpetuadorActivo && (
                      <span className="rounded-full bg-oro-wash px-2 py-0.5 text-[10px] text-oro">
                        perpetuador +8
                      </span>
                    )}
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-marfil">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${r.final}%`, background: color }}
                    />
                  </div>
                </div>
                <div className="w-20 text-right">
                  <div className="font-serif text-3xl font-normal leading-none" style={{ color }}>{r.final}</div>
                  <div className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-wider" style={{ color }}>
                    {banda.etiqueta}
                  </div>
                </div>
              </button>

              {abiertoAqui && (
                <div className="mt-3 rounded-lg bg-crema p-4 text-xs">
                  <div className="grid grid-cols-[1fr_40px_46px_62px] gap-x-3 gap-y-1.5">
                    <span className="text-[9.5px] uppercase tracking-wider text-choco-soft">Criterio</span>
                    <span className="text-right text-[9.5px] uppercase tracking-wider text-choco-soft">Valor</span>
                    <span className="text-right text-[9.5px] uppercase tracking-wider text-choco-soft">Peso</span>
                    <span className="text-right text-[9.5px] uppercase tracking-wider text-choco-soft">Aporte</span>
                    {([
                      ['Impacto clínico', 'IC'], ['Influencia sistémica', 'IS'], ['Reversibilidad', 'RV'],
                      ['Evidencia', 'EV'], ['Costo-beneficio', 'CB'],
                    ] as const).map(([nombre, k]) => (
                      <>
                        <span key={`${k}-n`}>{nombre}</span>
                        <span key={`${k}-v`} className="text-right font-mono tabular-nums">{alteracion[k]}</span>
                        <span key={`${k}-w`} className="text-right font-mono tabular-nums">{pesos[k].toFixed(2)}</span>
                        <span key={`${k}-a`} className="text-right font-mono tabular-nums">
                          {(pesos[k] * alteracion[k] * 20).toFixed(1)}
                        </span>
                      </>
                    ))}
                  </div>
                  <div className="mt-2.5 flex justify-between border-t border-linea pt-2.5 text-choco-mid">
                    <span>Base</span><span className="font-mono">{r.base}</span>
                  </div>
                  <div className="flex justify-between pt-1 text-choco-mid">
                    <span>× jerarquía {alteracion.nivel} ({jerarquia[alteracion.nivel].toFixed(2)})</span>
                    <span className="font-mono">{r.jerarquico}</span>
                  </div>
                  {alteracion.perpetuadorActivo && (
                    <div className="flex justify-between pt-1 text-choco-mid">
                      <span>+ perpetuador activo</span><span className="font-mono">+8</span>
                    </div>
                  )}
                  <div className="mt-2 flex justify-between border-t border-linea pt-2 font-medium">
                    <span className="text-choco-deep">IPT final</span>
                    <span className="font-mono" style={{ color }}>{r.final}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <p className="mt-4 border-t border-linea pt-3.5 text-[11.5px] text-choco-soft">
          <span className="text-oro">▸</span> El IPT organiza prioridades según criterio experto. No sustituye el
          juicio clínico ni reemplaza la evaluación de banderas rojas.
        </p>
      </div>
    </div>
  );
}
