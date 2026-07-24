'use client';

import { evaluarControl, type CicloControl } from '@/lib/algoritmo/criterios-avance';
import { FASES, type Fase } from '@/lib/algoritmo/fases';

interface Paso10ControlProps {
  fase: Fase;
  ciclo: CicloControl;
  reformulacionesPrevias: number;
  onDecision: (decision: ReturnType<typeof evaluarControl>['decision']) => void;
}

export function Paso10Control({ fase, ciclo, reformulacionesPrevias, onDecision }: Paso10ControlProps) {
  const f = FASES[fase];
  // el mismo motor validado, no un semáforo hardcodeado
  const resultado = evaluarControl(ciclo, fase, f.semanasMinimas, reformulacionesPrevias);

  const colorDecision = resultado.decision === 'avanzar' ? '#5C7A4A' : resultado.decision === 'derivar_paso4' ? '#A85A3C' : '#C08A2E';

  return (
    <div>
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 10</p>
      <h2 className="mb-1 font-serif text-2xl font-normal text-choco-deep">Control de evolución</h2>
      <p className="mb-5 text-[12.5px] text-choco-soft">¿Mejoró? ¿Empeoró? ¿Puede pasar a la siguiente fase?</p>

      <div className="rounded-card border border-linea bg-white p-5">
        {resultado.criterios.map(c => (
          <div key={c.nombre} className="flex justify-between border-t border-linea py-2.5 first:border-none text-[13px]">
            <span className="flex-1">{c.nombre}</span>
            <span className="font-mono text-[11.5px] text-choco-soft">{c.umbral}</span>
            <span className="w-16 text-right font-mono text-xs" style={{ color: c.cumple ? '#5C7A4A' : '#A85A3C' }}>
              {typeof c.valor === 'boolean' ? (c.valor ? 'sí' : 'no') : c.valor}
            </span>
          </div>
        ))}

        <div className="mt-4 rounded-lg p-3.5" style={{ background: `${colorDecision}14` }}>
          <p className="mb-2.5 text-[13px]" style={{ color: colorDecision }}>{resultado.motivo}</p>
          <div className="flex gap-2">
            {resultado.decision === 'avanzar' && (
              <button onClick={() => onDecision('avanzar')} className="flex-1 rounded-md py-2 text-sm text-white" style={{ background: colorDecision }}>
                Avanzar de fase
              </button>
            )}
            {resultado.decision === 'reformular' && (
              <button onClick={() => onDecision('reformular')} className="flex-1 rounded-md border border-linea-fuerte py-2 text-sm">
                Reformular
              </button>
            )}
            {resultado.decision === 'derivar_paso4' && (
              <button onClick={() => onDecision('derivar_paso4')} className="flex-1 rounded-md py-2 text-sm text-white" style={{ background: colorDecision }}>
                Volver al paso 4 · reevaluar diagnóstico
              </button>
            )}
          </div>
        </div>

        {reformulacionesPrevias > 0 && resultado.decision !== 'derivar_paso4' && (
          <p className="mt-3 text-[11.5px] text-choco-soft">
            <span className="text-oro">▸</span> Reformulación {reformulacionesPrevias} de 3 antes de forzar el retorno al diagnóstico.
          </p>
        )}
      </div>
    </div>
  );
}
