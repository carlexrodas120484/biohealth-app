'use client';

import { useState } from 'react';
import { Paso1Historia } from '@/components/flujo/Paso1Historia';

/**
 * Página de ejemplo: trae los síntomas/medicación reales por consultaId
 * (via una carga inicial server-side que se puede agregar como
 * Server Component padre) y los pasa al componente de paso ya construido.
 * Las páginas de los pasos 2 a 10 siguen exactamente este mismo patrón:
 * server component que trae datos + client component de components/flujo.
 */
export default function PasoHistoriaPage() {
  const [motivo, setMotivo] = useState('');
  const [sintomas, setSintomas] = useState<{ id: string; nombre: string; intensidad: number }[]>([]);

  return (
    <Paso1Historia
      motivo={motivo}
      onMotivoChange={setMotivo}
      antecedentes={[]}
      medicacion={[]}
      sintomas={sintomas}
      onSintomasChange={setSintomas}
    />
  );
}
