'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import { StepRail } from '@/components/flujo/StepRail';

const RUTA_POR_PASO = [
  'historia', 'cuestionario', 'bioescaner', 'diagnostico', 'ipt',
  'fase', 'objetivos', 'formulacion', 'nutricion', 'control', 'informes',
];

export default function ConsultaLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();

  const pasoActual = RUTA_POR_PASO.findIndex(r => pathname.endsWith(r)) + 1 || 1;

  return (
    <div>
      <StepRail
        pasoActual={pasoActual}
        onIrAPaso={(n) => router.push(`/pacientes/${id}/${RUTA_POR_PASO[n - 1]}`)}
      />
      {children}
    </div>
  );
}
