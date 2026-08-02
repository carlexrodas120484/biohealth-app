'use client';

const PASOS = [
  'Historia', 'Cuestionario', 'Bioescáner', 'Diagnóstico', 'IPT',
  'Fase', 'Objetivos', 'Fórmula', 'Nutrición', 'Control', 'Informes',
];

interface StepRailProps {
  pasoActual: number; // 1-11
  onIrAPaso: (paso: number) => void;
}

/**
 * Barra de progreso de 11 pasos. Portada del prototipo: aparece siempre
 * que hay una consulta abierta, y es el eje de navegación del Método
 * BioHealth®. El médico siempre sabe dónde está en el flujo.
 */
export function StepRail({ pasoActual, onIrAPaso }: StepRailProps) {
  const pct = ((pasoActual - 1) / (PASOS.length - 1)) * 100;

  return (
    <div className="relative pt-4 mb-8">
      <div className="absolute left-0 right-0 top-[22px] h-px bg-linea" />
      <div
        className="absolute left-0 top-[22px] h-px bg-oro transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
      <div className="relative flex justify-between">
        {PASOS.map((nombre, i) => {
          const n = i + 1;
          const done = n < pasoActual;
          const now = n === pasoActual;
          return (
            <button
              key={n}
              onClick={() => onIrAPaso(n)}
              className="flex flex-1 flex-col items-center gap-2 bg-transparent"
            >
              <span
                className={[
                  'h-[13px] w-[13px] rounded-full border transition-all',
                  done ? 'bg-choco-deep border-choco-deep' : '',
                  now ? 'bg-oro border-oro shadow-[0_0_0_4px_rgba(176,141,63,0.16)]' : '',
                  !done && !now ? 'bg-crema border-linea-fuerte' : '',
                ].join(' ')}
              />
              <span
                className={[
                  'whitespace-nowrap text-[10.5px]',
                  now ? 'font-semibold text-choco-deep' : done ? 'text-choco-mid' : 'text-choco-soft',
                ].join(' ')}
              >
                {n} · {nombre}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { PASOS };
