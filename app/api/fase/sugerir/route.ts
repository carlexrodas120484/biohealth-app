import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { seleccionarFase } from '@/lib/algoritmo/fases';
import type { AlteracionInput } from '@/lib/algoritmo/ipt';
import { z } from 'zod';

const BodySchema = z.object({ consultaId: z.string().uuid(), banderaRoja: z.boolean().default(false) });

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });

  const supabase = await createClient();
  const { data: alteraciones, error } = await supabase
    .from('alteraciones').select('*').eq('consulta_id', parsed.data.consultaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const input: AlteracionInput[] = (alteraciones ?? []).map((a: any) => ({
    id: a.id, nombre: a.nombre, dominio: a.dominio, nivel: a.nivel,
    perpetuadorActivo: a.perpetuador, IC: a.ic, IS: a.is_, RV: a.rv, EV: a.ev, CB: a.cb,
  }));

  const resultado = seleccionarFase(input, parsed.data.banderaRoja);

  // se guarda como sugerencia, no confirmada — el médico confirma o
  // anula explícitamente desde el paso 6, y ese gesto queda auditado
  await (supabase.from('fase_asignaciones') as any).insert({
    consulta_id: parsed.data.consultaId,
    fase: resultado.fase,
    sugerida_por_sistema: true,
    confirmada: false,
  });

  return NextResponse.json(resultado);
}
