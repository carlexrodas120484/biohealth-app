'use client';

import type { AlteracionInput } from '@/lib/algoritmo/ipt';

const NIVEL_COLOR: Record<string, string> = {
  primaria: '#A85A3C', secundaria: '#C08A2E', terciaria: '#9A8672',
};
const NIVEL_LABEL: Record<string, string> = {
  primaria: 'Alteración primaria', secundaria: 'Secundarias', terciaria: 'Terciarias',
};

interface Paso4DiagnosticoProps {
  alteraciones: AlteracionInput[];
  perpetuadores: { nombre: string; estado: string }[];
  deficits: string[];
}

export function Paso4Diagnostico({ alteraciones, perpetuadores, deficits }: Paso4DiagnosticoProps) {
  const porNivel = (nivel: string) => alteraciones.filter(a => a.nivel === nivel).map(a => a.nombre).join(' · ');

  return (
    <div>
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 4</p>
      <h2 className="mb-1 font-serif text-2xl font-normal text-choco-deep">Diagnóstico funcional</h2>
      <p className="mb-5 text-[12.5px] text-choco-soft">El médico organiza la cascada. El sistema no la impone.</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-card border border-linea bg-white p-5">
          {(['primaria', 'secundaria', 'terciaria'] as const).map(niv => (
            <div key={niv} className="mb-2 rounded-r-lg border-l-2 px-3.5 py-2.5" style={{ borderColor: NIVEL_COLOR[niv], background: `${NIVEL_COLOR[niv]}0d` }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: NIVEL_COLOR[niv] }}>{NIVEL_LABEL[niv]}</div>
              <div className="mt-0.5 text-[13.5px] text-choco-deep">{porNivel(niv) || '—'}</div>
            </div>
          ))}
          <div className="mb-2 rounded-r-lg border-l-2 border-fase-regenerate bg-fase-regenerate/5 px-3.5 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-fase-regenerate">Factores perpetuadores</div>
            <div className="mt-0.5 text-[13.5px] text-choco-deep">{perpetuadores.map(p => p.nombre).join(' · ') || '—'}</div>
          </div>
          <div className="rounded-r-lg border-l-2 border-fase-restore bg-fase-restore/5 px-3.5 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-fase-restore">Déficits probables</div>
            <div className="mt-0.5 text-[13.5px] text-choco-deep">{deficits.join(' · ') || '—'}</div>
          </div>
        </div>

        <div className="rounded-card border border-linea bg-white p-5">
          <p className="mb-3.5 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Dominio asignado</p>
          {alteraciones.map(a => (
            <div key={a.id} className="flex justify-between border-t border-linea py-2.5 first:border-none">
              <span className="text-[13.5px]">{a.nombre}</span>
              <span className="rounded-full bg-marfil px-2.5 py-1 text-xs text-choco-mid">{a.dominio}</span>
            </div>
          ))}
          <p className="mt-3.5 text-[11.5px] text-choco-soft">
            <span className="text-oro">▸</span> El dominio determina qué compuerta del algoritmo se evalúa en el paso 6.
          </p>
        </div>
      </div>
    </div>
  );
}
