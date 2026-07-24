'use client';

import type { ActivoBiblioteca } from '@/types';

function evidenciaDots(n: number) {
  return '●'.repeat(n) + '○'.repeat(5 - n);
}

interface Paso8FormulacionProps {
  sugerencias: ActivoBiblioteca[];
  seleccionados: ActivoBiblioteca[];
  onToggle: (activo: ActivoBiblioteca) => void;
  medicamentosActuales: string[]; // para el chequeo visual de interacciones
  firmada: boolean;
  firmadaEn: string | null;
  onFirmar: () => void;
}

export function Paso8Formulacion({
  sugerencias, seleccionados, onToggle, medicamentosActuales, firmada, firmadaEn, onFirmar,
}: Paso8FormulacionProps) {
  const tieneInteraccion = (a: ActivoBiblioteca) =>
    medicamentosActuales.some(m => a.interacciones.toLowerCase().includes(m.toLowerCase()));

  return (
    <div>
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 8</p>
      <h2 className="mb-1 font-serif text-2xl font-normal text-choco-deep">Formulación magistral</h2>
      <p className="mb-5 text-[12.5px] text-choco-soft">El sistema sugiere. El médico decide y firma.</p>

      <div className="grid grid-cols-[1.45fr_1fr] gap-4">
        <div>
          {sugerencias.map(a => {
            const activo = seleccionados.some(s => s.id === a.id);
            const interactua = tieneInteraccion(a);
            return (
              <div key={a.id} className={['mb-2.5 rounded-lg border p-3', activo ? 'border-oro-claro bg-oro-wash' : 'border-linea bg-white'].join(' ')}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-choco-deep">{a.nombre}</div>
                    <div className="text-[11.5px] text-choco-soft">{a.familia} · {a.objetivo}</div>
                  </div>
                  {!firmada && (
                    <button
                      onClick={() => onToggle(a)}
                      className={['rounded-md px-2.5 py-1.5 text-xs', activo ? 'border border-linea-fuerte' : 'bg-choco-deep text-crema'].join(' ')}
                    >
                      {activo ? 'Quitar' : 'Agregar'}
                    </button>
                  )}
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-choco-mid">
                  <div><b className="font-normal text-choco-soft">Dosis</b> {a.dosis}</div>
                  <div><b className="font-normal text-choco-soft">Máx</b> {a.dosisMax}</div>
                  <div><b className="font-normal text-choco-soft">Evidencia</b> <span className="tracking-widest text-oro">{evidenciaDots(a.evidencia)}</span></div>
                </div>
                {interactua ? (
                  <p className="mt-2 text-[11.5px] text-fase-reset">⚠ Interacción potencial con medicación actual — revisar antes de firmar.</p>
                ) : (
                  <p className="mt-2 text-[11.5px] text-fase-restore">✓ Sin interacciones con la medicación registrada.</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="h-fit rounded-card border border-linea bg-white p-5">
          <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Fórmula en construcción</p>
          {seleccionados.length === 0 ? (
            <p className="py-3.5 text-[13px] text-choco-soft">Todavía no agregaste activos. Elegí de las sugerencias.</p>
          ) : (
            seleccionados.map(a => (
              <div key={a.id} className="flex justify-between border-t border-linea py-2.5 first:border-none">
                <div><div className="text-[13.5px]">{a.nombre}</div><div className="text-[11.5px] text-choco-soft">{a.dosis}</div></div>
                {!firmada && <button onClick={() => onToggle(a)} className="rounded-md border border-linea-fuerte px-2 py-0.5 text-xs">✕</button>}
              </div>
            ))
          )}

          {firmada ? (
            <div className="mt-4 rounded-lg bg-fase-restore/10 p-3">
              <div className="text-[12.5px] text-fase-restore">✓ Fórmula firmada</div>
              <div className="mt-0.5 text-[11px] text-choco-soft">{firmadaEn}</div>
            </div>
          ) : (
            <button
              onClick={onFirmar}
              disabled={seleccionados.length === 0}
              className="mt-4 w-full rounded-md bg-oro py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Firmar fórmula
            </button>
          )}
          <p className="mt-2.5 text-[11px] text-choco-soft">
            <span className="text-oro">▸</span> La firma exige reingresar contraseña o PIN y queda registrada con la versión de reglas vigente.
          </p>
        </div>
      </div>
    </div>
  );
}
