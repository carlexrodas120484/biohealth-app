'use client';

import { useState } from 'react';
import { FASES, type Fase } from '@/lib/algoritmo/fases';

interface Paso9NutricionProps {
  fase: Fase;
  priorizar: string;
  evitar: string;
  consultaId: string;
  tieneFormula: boolean;
}

export function Paso9Nutricion({ fase, priorizar, evitar, consultaId, tieneFormula }: Paso9NutricionProps) {
  const f = FASES[fase];
  const [descargando, setDescargando] = useState<'formula' | 'plan' | null>(null);

  // llama a la API real — no genera el PDF en el cliente con datos mock,
  // como hacía el prototipo, sino contra la consulta persistida
  async function descargar(tipo: 'formula_magistral' | 'plan_paciente') {
    setDescargando(tipo === 'formula_magistral' ? 'formula' : 'plan');
    try {
      const res = await fetch('/api/documentos/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultaId, tipo }),
      });
      if (!res.ok) throw new Error('No se pudo generar el documento');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${tipo}_${consultaId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDescargando(null);
    }
  }

  return (
    <div>
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Paso 9</p>
      <h2 className="mb-1 font-serif text-2xl font-normal text-choco-deep">Nutrición</h2>
      <p className="mb-5 text-[12.5px] text-choco-soft">Plan alimentario alineado a la fase {f.nombre}.</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-card border border-linea bg-white p-5">
          <div className="mb-2.5 rounded-r-lg border-l-2 border-fase-restore px-3.5 py-2.5">
            <div className="text-[11px] text-fase-restore">Priorizar</div>
            <div className="mt-0.5 text-[13.5px]">{priorizar}</div>
          </div>
          <div className="rounded-r-lg border-l-2 border-fase-reset px-3.5 py-2.5">
            <div className="text-[11px] text-fase-reset">Evitar</div>
            <div className="mt-0.5 text-[13.5px]">{evitar}</div>
          </div>
        </div>

        <div className="rounded-card border border-linea bg-white p-5">
          <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-wider text-oro">Entregables de la consulta</p>
          <div className="flex items-center justify-between border-b border-linea py-2.5">
            <div><div className="text-[13.5px]">Fórmula magistral</div><div className="text-[11.5px] text-choco-soft">Membretada · lista para la farmacia</div></div>
            <button
              onClick={() => descargar('formula_magistral')}
              disabled={!tieneFormula || descargando !== null}
              className="rounded-md border border-linea-fuerte px-2.5 py-1.5 text-xs disabled:opacity-40"
            >
              {descargando === 'formula' ? 'Generando…' : 'Descargar PDF'}
            </button>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <div><div className="text-[13.5px]">Plan del paciente</div><div className="text-[11.5px] text-choco-soft">Para compartir por WhatsApp</div></div>
            <button
              onClick={() => descargar('plan_paciente')}
              disabled={descargando !== null}
              className="rounded-md border border-linea-fuerte px-2.5 py-1.5 text-xs disabled:opacity-40"
            >
              {descargando === 'plan' ? 'Generando…' : 'Descargar PDF'}
            </button>
          </div>
          <p className="mt-3.5 text-[11.5px] text-choco-soft">
            <span className="text-oro">▸</span> Ambos documentos se generan en el servidor a partir de la consulta persistida, no de datos simulados.
          </p>
        </div>
      </div>
    </div>
  );
}
