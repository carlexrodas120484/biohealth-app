'use client';

export interface Hallazgo { id: string; parametro: string; severidad: 'ok' | 'med' | 'alto' }

const COLOR: Record<Hallazgo['severidad'], string> = { ok: '#5C7A4A', med: '#C08A2E', alto: '#A85A3C' };
const LABEL: Record<Hallazgo['severidad'], string> = { ok: 'Normal', med: 'Medio', alto: 'Alto' };

interface Paso3BioescanerProps {
  hallazgos: Hallazgo[];
  onHallazgosChange: (h: Hallazgo[]) => void;
  onArchivoSubido: (archivo: File) => void;
  nombreArchivo: string | null;
}

export function Paso3Bioescaner({ hallazgos, onHallazgosChange, onArchivoSubido, nombreArchivo }: Paso3BioescanerProps) {
  const setSeveridad = (id: string, s: Hallazgo['severidad']) =>
    onHallazgosChange(hallazgos.map(h => (h.id === id ? { ...h, severidad: s } : h)));
  const agregar = () =>
    onHallazgosChange([...hallazgos, { id: crypto.randomUUID(), parametro: 'Nuevo parámetro', severidad: 'med' }]);
  const quitar = (id: string) => onHallazgosChange(hallazgos.filter(h => h.id !== id));

  return (
    <div>
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 3</p>
      <h2 className="mb-1 font-serif text-2xl font-normal text-choco-deep">Bioescáner</h2>
      <p className="mb-5 text-[12.5px] text-choco-soft">No diagnostica. Solo muestra las alteraciones detectadas.</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-card border border-linea bg-white p-5">
          <label className="block cursor-pointer rounded-lg border border-dashed border-linea-fuerte p-7 text-center text-choco-soft">
            <input type="file" className="hidden" onChange={e => e.target.files?.[0] && onArchivoSubido(e.target.files[0])} />
            <div className="text-xl text-oro">⬒</div>
            <div className="mt-2 text-[13px]">{nombreArchivo ?? 'Click para cargar el archivo del escaneo'}</div>
            <div className="text-[11.5px]">{hallazgos.length} parámetros</div>
          </label>
          <p className="mt-4 text-[11.5px] text-choco-soft">
            <span className="text-oro">▸</span> El bioescáner aporta señales, no diagnósticos. La interpretación es del médico en el paso 4.
          </p>
        </div>

        <div className="rounded-card border border-linea bg-white p-5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] text-choco-soft">Hallazgos</span>
            <button onClick={agregar} className="rounded-md border border-linea-fuerte px-2.5 py-1 text-xs">+ agregar</button>
          </div>
          {hallazgos.map(h => (
            <div key={h.id} className="flex items-center gap-2.5 border-t border-linea py-2.5 first:border-none">
              <span className="flex-1 text-[13.5px]">{h.parametro}</span>
              <div className="flex w-[150px] gap-1.5">
                {(['ok', 'med', 'alto'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSeveridad(h.id, s)}
                    className={['flex-1 rounded-md border py-1.5 text-[11.5px]', s === h.severidad ? 'border-oro-claro bg-oro-wash' : 'border-linea'].join(' ')}
                    style={{ color: COLOR[s] }}
                  >
                    {LABEL[s]}
                  </button>
                ))}
              </div>
              <button onClick={() => quitar(h.id)} className="rounded-md border border-linea-fuerte px-2 py-0.5 text-xs">✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
