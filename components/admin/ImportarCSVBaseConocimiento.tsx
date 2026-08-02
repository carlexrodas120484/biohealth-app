'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ErrorFila = { columna: string | null; valor: string | null; mensaje: string };
type FilaPrevia = {
  numeroFila: number; datos: Record<string, string>; errores: ErrorFila[];
  duplicadoEnArchivo: boolean; duplicadoExistente: boolean; valida: boolean;
};
type Previsualizacion = { previsualizacion: true; filasTotales: number; filasValidas: number; filasRechazadas: number; filas: FilaPrevia[] };
type ResultadoImportacion = { previsualizacion: false; creadas: number; editadas: number; filasRechazadas: number; importacionId: string | null };

export function ImportarCSVBaseConocimiento() {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [sobrescribirValidados, setSobrescribirValidados] = useState(false);
  const [previa, setPrevia] = useState<Previsualizacion | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [esError, setEsError] = useState(false);

  async function enviar(confirmar: boolean) {
    if (!archivo) return;
    setCargando(true); setMensaje(''); setEsError(false);
    try {
      const form = new FormData();
      form.set('archivo', archivo);
      form.set('confirmar', String(confirmar));
      form.set('sobrescribirValidados', String(sobrescribirValidados));
      const res = await fetch('/api/admin/base-conocimiento/importar', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'No se pudo procesar el archivo.');
      if (confirmar) {
        setResultado(body as ResultadoImportacion);
        setPrevia(null);
        router.refresh();
      } else {
        setPrevia(body as Previsualizacion);
        setResultado(null);
      }
    } catch (err) {
      setEsError(true);
      setMensaje(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-card border border-linea bg-white p-5">
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Archivo CSV</p>
        <input
          type="file" accept=".csv,text/csv"
          onChange={e => { setArchivo(e.target.files?.[0] ?? null); setPrevia(null); setResultado(null); }}
          className="block w-full text-[13px]"
        />
        <label className="mt-3 flex items-center gap-1.5 text-[13px] text-choco-deep">
          <input type="checkbox" checked={sobrescribirValidados} onChange={e => setSobrescribirValidados(e.target.checked)} />
          Autorizo sobrescribir principios ya validados que coincidan por nombre
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={!archivo || cargando} onClick={() => enviar(false)}
            className="rounded-md border border-linea bg-white px-3.5 py-2 text-[13px] font-medium text-choco-deep hover:bg-crema disabled:opacity-50">
            {cargando ? 'Procesando...' : 'Previsualizar'}
          </button>
          {previa && previa.filasValidas > 0 && (
            <button type="button" disabled={cargando} onClick={() => enviar(true)}
              className="rounded-md bg-choco-deep px-3.5 py-2 text-[13px] font-medium text-white hover:bg-choco-mid disabled:opacity-50">
              Confirmar importación ({previa.filasValidas} fila{previa.filasValidas === 1 ? '' : 's'} válida{previa.filasValidas === 1 ? '' : 's'})
            </button>
          )}
        </div>
        {mensaje && <p className={`mt-3 text-[13px] ${esError ? 'text-fase-reset' : 'text-fase-restore'}`}>{mensaje}</p>}
      </section>

      {resultado && (
        <section className="rounded-card border border-fase-restore/30 bg-fase-restore/5 p-5 text-[13px] text-choco-deep">
          Importación completada: {resultado.creadas} creado(s), {resultado.editadas} editado(s), {resultado.filasRechazadas} rechazada(s).
        </section>
      )}

      {previa && (
        <section className="rounded-card border border-linea bg-white p-5">
          <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">
            Previsualización — {previa.filasValidas} de {previa.filasTotales} filas válidas
          </p>
          {previa.filasRechazadas > 0 && !sobrescribirValidados && (
            <p className="mb-3 text-[12.5px] text-fase-target">
              La importación parcial es posible: se pueden importar sólo las filas válidas confirmando explícitamente, sin esperar a corregir el resto.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead className="border-b border-linea text-[10px] uppercase tracking-wider text-choco-soft">
                <tr><th className="pb-2">Fila</th><th className="pb-2">Nombre</th><th className="pb-2">Estado</th><th className="pb-2">Errores</th></tr>
              </thead>
              <tbody>
                {previa.filas.map(f => (
                  <tr key={f.numeroFila} className="border-b border-linea last:border-0">
                    <td className="py-2 pr-4 text-choco-soft">{f.numeroFila}</td>
                    <td className="py-2 pr-4 text-choco-deep">{f.datos.nombre_canonico || '—'}</td>
                    <td className="py-2 pr-4">
                      {f.valida
                        ? <span className="text-fase-restore">Válida{f.duplicadoExistente ? ' (actualiza existente)' : ''}</span>
                        : <span className="text-fase-reset">Rechazada</span>}
                    </td>
                    <td className="py-2 text-choco-soft">{f.errores.map(e => e.mensaje).join('; ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
