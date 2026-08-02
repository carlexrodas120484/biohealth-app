'use client';

type Punto = { fecha: string; valor: number };

const ANCHO = 260;
const ALTO = 70;
const PADDING = 8;

/**
 * Gráfico de tendencia liviano en SVG puro — sin librería de gráficos.
 * La mayoría de las series clínicas de este dashboard tienen pocos
 * puntos (un puñado de controles por paciente), así que una librería
 * de gráficos de propósito general sería peso muerto: esto cubre línea
 * + puntos + rango de referencia en ~60 líneas, sin dependencias nuevas.
 */
export function GraficoTendencia({
  puntos, unidad, rangoMin, rangoMax,
}: {
  puntos: Punto[];
  unidad?: string;
  /** Banda de referencia (rango normal) a sombrear, si se conoce. */
  rangoMin?: number;
  rangoMax?: number;
}) {
  if (puntos.length === 0) {
    return <div className="flex h-[70px] items-center justify-center text-[11px] text-choco-soft">Sin datos suficientes para graficar.</div>;
  }

  const valores = puntos.map(p => p.valor);
  const min = Math.min(...valores, rangoMin ?? Infinity);
  const max = Math.max(...valores, rangoMax ?? -Infinity);
  const rango = max - min || 1;

  const x = (i: number) => PADDING + (i / Math.max(puntos.length - 1, 1)) * (ANCHO - PADDING * 2);
  const y = (v: number) => ALTO - PADDING - ((v - min) / rango) * (ALTO - PADDING * 2);

  const coords = puntos.map((p, i) => `${x(i)},${y(p.valor)}`).join(' ');
  const ultimo = puntos[puntos.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full" role="img" aria-label={`Tendencia: ${puntos.length} registros`}>
        {rangoMin != null && rangoMax != null && (
          <rect x={PADDING} y={y(rangoMax)} width={ANCHO - PADDING * 2} height={Math.max(y(rangoMin) - y(rangoMax), 1)} fill="#B08D3F" opacity={0.08} />
        )}
        {puntos.length > 1 && <polyline points={coords} fill="none" stroke="#B08D3F" strokeWidth={1.75} />}
        {puntos.map((p, i) => (
          <circle key={p.fecha + i} cx={x(i)} cy={y(p.valor)} r={2.5} fill="#3A2A1E" />
        ))}
      </svg>
      <div className="mt-1 flex items-baseline justify-between text-[11px] text-choco-soft">
        <span>{puntos.length === 1 ? 'Único registro' : `${puntos.length} registros`}</span>
        <span className="font-semibold text-choco-deep">{ultimo.valor}{unidad ? ` ${unidad}` : ''}</span>
      </div>
    </div>
  );
}
