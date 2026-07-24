'use client';

interface Sintoma { id: string; nombre: string; intensidad: number }
interface Medicamento { nombre: string; frecuencia: string }

interface Paso1HistoriaProps {
  motivo: string;
  onMotivoChange: (v: string) => void;
  antecedentes: string[];
  medicacion: Medicamento[];
  sintomas: Sintoma[];
  onSintomasChange: (s: Sintoma[]) => void;
}

export function Paso1Historia({ motivo, onMotivoChange, antecedentes, medicacion, sintomas, onSintomasChange }: Paso1HistoriaProps) {
  const actualizar = (id: string, intensidad: number) =>
    onSintomasChange(sintomas.map(s => (s.id === id ? { ...s, intensidad } : s)));
  const agregar = () =>
    onSintomasChange([...sintomas, { id: crypto.randomUUID(), nombre: 'Nuevo síntoma', intensidad: 50 }]);
  const quitar = (id: string) => onSintomasChange(sintomas.filter(s => s.id !== id));

  return (
    <div>
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 1</p>
      <h2 className="mb-1 font-serif text-2xl font-normal text-choco-deep">Historia clínica</h2>
      <p className="mb-5 text-[12.5px] text-choco-soft">Datos, antecedentes, medicación, motivo y síntomas.</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-card border border-linea bg-white p-5">
          <label className="mb-4 block">
            <span className="mb-1.5 block text-[11px] text-choco-soft">Motivo de consulta</span>
            <textarea
              className="min-h-[70px] w-full rounded-md border border-linea px-3 py-2 text-[13.5px]"
              value={motivo}
              onChange={e => onMotivoChange(e.target.value)}
            />
          </label>
          <div>
            <span className="mb-1.5 block text-[11px] text-choco-soft">Antecedentes</span>
            {antecedentes.map(a => (
              <span key={a} className="mr-1.5 mb-1.5 inline-block rounded-full bg-marfil px-2.5 py-1 text-xs text-choco-mid">{a}</span>
            ))}
          </div>
        </div>

        <div className="rounded-card border border-linea bg-white p-5">
          <span className="mb-2 block text-[11px] text-choco-soft">Medicación actual</span>
          {medicacion.map(m => (
            <div key={m.nombre} className="flex justify-between border-t border-linea py-2 text-[13.5px] first:border-none">
              <span>{m.nombre}</span><span className="font-mono text-xs text-choco-soft">{m.frecuencia}</span>
            </div>
          ))}
          <p className="mt-2.5 text-[11.5px] text-choco-soft">
            <span className="text-oro">▸</span> Se cruzan automáticamente contra la biblioteca en el paso 8.
          </p>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[11px] text-choco-soft">Síntomas principales</span>
            <button onClick={agregar} className="rounded-md border border-linea-fuerte px-2.5 py-1 text-xs">+ agregar</button>
          </div>
          {sintomas.map(s => (
            <div key={s.id} className="mt-2.5 flex items-center gap-2.5">
              <span className="w-20 text-[13px]">{s.nombre}</span>
              <input
                type="range" min={0} max={100} value={s.intensidad}
                onChange={e => actualizar(s.id, +e.target.value)}
                className="flex-1 accent-oro"
              />
              <span className="w-7 text-right font-mono text-[11.5px] text-choco-soft">{s.intensidad}</span>
              <button onClick={() => quitar(s.id)} className="rounded-md border border-linea-fuerte px-2 py-0.5 text-xs">✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
