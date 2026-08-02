'use client';

type Semaforo = 'verde' | 'amarillo' | 'rojo' | 'sin_datos';

const ESTILO: Record<Semaforo, { punto: string; texto: string; etiqueta: string }> = {
  verde: { punto: 'bg-fase-restore', texto: 'text-fase-restore', etiqueta: 'Normal' },
  amarillo: { punto: 'bg-fase-repair', texto: 'text-fase-repair', etiqueta: 'Atención' },
  rojo: { punto: 'bg-fase-reset', texto: 'text-fase-reset', etiqueta: 'Alerta' },
  sin_datos: { punto: 'bg-choco-soft/40', texto: 'text-choco-soft', etiqueta: 'Sin datos' },
};

export function PuntoSemaforo({ semaforo }: { semaforo: Semaforo }) {
  const e = ESTILO[semaforo];
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${e.punto}`} aria-label={e.etiqueta} />;
}

export function EtiquetaSemaforo({ semaforo, texto }: { semaforo: Semaforo; texto?: string }) {
  const e = ESTILO[semaforo];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${e.texto}`}>
      <PuntoSemaforo semaforo={semaforo} />
      {texto ?? e.etiqueta}
    </span>
  );
}

export type { Semaforo };
