'use client';

import { useEffect, useState } from 'react';

type TipoInforme =
  | 'informe_clinico_completo'
  | 'resumen_diagnostico'
  | 'plan_terapeutico'
  | 'receta_ortomolecular'
  | 'plan_nutricional'
  | 'informe_integrado';

const TIPOS: Array<{ tipo: TipoInforme; etiqueta: string; descripcion: string }> = [
  { tipo: 'informe_clinico_completo', etiqueta: 'Informe clínico completo', descripcion: 'Historia clínica, cuestionario funcional y diagnóstico confirmado.' },
  { tipo: 'resumen_diagnostico', etiqueta: 'Resumen diagnóstico funcional', descripcion: 'Patrones funcionales confirmados por el profesional.' },
  { tipo: 'plan_terapeutico', etiqueta: 'Plan terapéutico', descripcion: 'Fases activas o completadas del plan.' },
  { tipo: 'receta_ortomolecular', etiqueta: 'Receta ortomolecular', descripcion: 'Formulación aprobada, tal como fue firmada.' },
  { tipo: 'plan_nutricional', etiqueta: 'Plan nutricional', descripcion: 'Plan nutricional aprobado.' },
  { tipo: 'informe_integrado', etiqueta: 'Informe integrado completo', descripcion: 'Combina todo lo aprobado/confirmado en un único documento.' },
];

type RegistroHistorial = {
  id: string; tipo: string; version: number; estado: string; generado_en: string; contenido_hash: string | null;
};

export function InformesClinicos({ pacienteId }: { pacienteId: string }) {
  const [historial, setHistorial] = useState<RegistroHistorial[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [generando, setGenerando] = useState<TipoInforme | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [esError, setEsError] = useState(false);

  async function cargarHistorial() {
    setCargandoHistorial(true);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/documentos`);
      if (res.ok) {
        const b = await res.json();
        setHistorial(b.historial ?? []);
      }
    } finally {
      setCargandoHistorial(false);
    }
  }

  useEffect(() => {
    cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  function nombreDesdeDisposition(disposition: string | null, tipo: TipoInforme): string {
    const m = disposition?.match(/filename="([^"]+)"/);
    return m?.[1] ?? `${tipo}.pdf`;
  }

  async function generar(tipo: TipoInforme, accion: 'descargar' | 'vista_previa' | 'imprimir') {
    setGenerando(tipo);
    setMensaje('');
    setEsError(false);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/documentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? 'No se pudo generar el documento.');
      }
      const nombre = nombreDesdeDisposition(res.headers.get('Content-Disposition'), tipo);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (accion === 'descargar') {
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombre;
        enlace.click();
      } else if (accion === 'vista_previa') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const ventana = window.open(url, '_blank', 'noopener,noreferrer');
        ventana?.addEventListener('load', () => ventana.print());
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMensaje('Documento generado.');
      await cargarHistorial();
    } catch (e) {
      setEsError(true);
      setMensaje(e instanceof Error ? e.message : 'No se pudo generar el documento.');
    } finally {
      setGenerando(null);
    }
  }

  return (
    <div className="space-y-5">
      {mensaje && (
        <div className={`rounded-md border px-3 py-2 text-[13px] ${esError ? 'border-red-200 bg-red-50 text-red-700' : 'border-linea bg-crema text-choco-mid'}`}>
          {mensaje}
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TIPOS.map(t => (
          <div key={t.tipo} className="rounded-card border border-linea bg-white p-4">
            <p className="text-[13.5px] font-semibold text-choco-deep">{t.etiqueta}</p>
            <p className="mt-1 text-[12px] text-choco-soft">{t.descripcion}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => generar(t.tipo, 'vista_previa')}
                disabled={generando === t.tipo}
                className="rounded-md border border-linea-fuerte px-3 py-1.5 text-[12px] text-choco-deep hover:bg-crema disabled:opacity-50"
              >
                {generando === t.tipo ? 'Generando…' : 'Vista previa'}
              </button>
              <button
                onClick={() => generar(t.tipo, 'descargar')}
                disabled={generando === t.tipo}
                className="rounded-md bg-choco-deep px-3 py-1.5 text-[12px] text-crema hover:bg-choco disabled:opacity-50"
              >
                Descargar
              </button>
              <button
                onClick={() => generar(t.tipo, 'imprimir')}
                disabled={generando === t.tipo}
                className="rounded-md border border-linea-fuerte px-3 py-1.5 text-[12px] text-choco-deep hover:bg-crema disabled:opacity-50"
              >
                Imprimir
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-card border border-linea bg-white p-5">
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Historial de documentos generados</p>
        {cargandoHistorial ? (
          <p className="text-sm text-choco-soft">Cargando historial…</p>
        ) : historial.length === 0 ? (
          <p className="text-sm text-choco-soft">Todavía no se generó ningún documento para este paciente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-choco-soft">
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2">Versión</th>
                  <th className="pb-2">Estado</th>
                  <th className="pb-2">Generado</th>
                </tr>
              </thead>
              <tbody>
                {historial.map(h => (
                  <tr key={h.id} className="border-t border-linea">
                    <td className="py-2">{TIPOS.find(t => t.tipo === h.tipo)?.etiqueta ?? h.tipo}</td>
                    <td className="py-2">v{h.version}</td>
                    <td className="py-2">{h.estado}</td>
                    <td className="py-2 text-choco-soft">{new Date(h.generado_en).toLocaleString('es-PY')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
