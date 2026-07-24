import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calcularRankingIPT, PESOS_DEFAULT, JERARQUIA_DEFAULT, type AlteracionInput } from '@/lib/algoritmo/ipt';
import { z } from 'zod';

const BodySchema = z.object({ consultaId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });

  const supabase = await createClient();
  const { data: alteraciones, error } = await supabase
    .from('alteraciones')
    .select('*')
    .eq('consulta_id', parsed.data.consultaId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // pesos vigentes del tenant — si no hay versión configurada, usa la
  // rúbrica de consenso experto v1.0 documentada en lib/algoritmo/ipt.ts
  const { data: pesosRow } = await (supabase
    .from('ipt_pesos') as any)
    .select('*')
    .eq('vigente', true)
    .single();

  const pesos = pesosRow
    ? { IC: pesosRow.ic, IS: pesosRow.is_, RV: pesosRow.rv, EV: pesosRow.ev, CB: pesosRow.cb }
    : PESOS_DEFAULT;

  const input: AlteracionInput[] = (alteraciones ?? []).map((a: any) => ({
    id: a.id, nombre: a.nombre, dominio: a.dominio, nivel: a.nivel,
    perpetuadorActivo: a.perpetuador, cronicidadMeses: a.cronicidad_meses,
    IC: a.ic, IS: a.is_, RV: a.rv, EV: a.ev, CB: a.cb,
  }));

  const ranking = calcularRankingIPT(input, pesos, JERARQUIA_DEFAULT);

  // persiste el IPT calculado en cada alteración — es lo que después
  // alimenta las compuertas de fase y la curva de evolución en el tiempo
  await Promise.all(
    ranking.map(r => (supabase.from('alteraciones') as any).update({ ipt_calculado: r.final }).eq('id', r.alteracionId))
  );

  return NextResponse.json({ ranking });
}
