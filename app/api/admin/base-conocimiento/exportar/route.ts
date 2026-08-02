import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolverUsuarioAutorizado } from '@/lib/adminAuth';
import { generarCSVExportacion, type FilaExportacion } from '@/lib/clinica/baseConocimiento';

const ROLES_AUTORIZADOS = ['medico_titular'] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  const usuario = await resolverUsuarioAutorizado(supabase, user.id, ROLES_AUTORIZADOS);
  if ('error' in usuario) return usuario.error;

  const { data: principios, error } = await supabase
    .from('principios_activos')
    .select('id, nombre_canonico, nombre_comercial, descripcion')
    .or(`tenant_id.is.null,tenant_id.eq.${usuario.tenantId}`)
    .order('nombre_canonico', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filas = (principios ?? []) as Array<{ id: string; nombre_canonico: string; nombre_comercial: string | null; descripcion: string | null }>;
  const ids = filas.map(f => f.id);

  const [sinonimos, dosis, presentaciones, propiedades, contraindicaciones, evidencia] = ids.length === 0
    ? [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }]
    : await Promise.all([
        supabase.from('sinonimos_principios').select('principio_id, sinonimo').in('principio_id', ids),
        supabase.from('dosis_principios').select('principio_id, tipo, valor, unidad, frecuencia').in('principio_id', ids),
        supabase.from('presentaciones_farmaceuticas').select('principio_id, forma, capacidad_capsula_mg, preferida').in('principio_id', ids),
        supabase.from('propiedades_organolepticas').select('principio_id, sabor, intensidad_sabor, solubilidad').in('principio_id', ids),
        supabase.from('contraindicaciones_principios').select('principio_id, contraindicacion').in('principio_id', ids),
        supabase.from('evidencia_cientifica').select('principio_id, nivel_evidencia').in('principio_id', ids),
      ]);

  const porPrincipio = <T extends { principio_id: string }>(filas: T[] | null) => {
    const mapa = new Map<string, T[]>();
    for (const f of filas ?? []) {
      if (!mapa.has(f.principio_id)) mapa.set(f.principio_id, []);
      mapa.get(f.principio_id)!.push(f);
    }
    return mapa;
  };

  const sinonimosPorId = porPrincipio(sinonimos.data as Array<{ principio_id: string; sinonimo: string }> | null);
  const dosisPorId = porPrincipio(dosis.data as Array<{ principio_id: string; tipo: string; valor: number; unidad: string; frecuencia: string | null }> | null);
  const presentacionesPorId = porPrincipio(presentaciones.data as Array<{ principio_id: string; forma: string; capacidad_capsula_mg: number | null; preferida: boolean }> | null);
  const propiedadesPorId = porPrincipio(propiedades.data as Array<{ principio_id: string; sabor: string | null; intensidad_sabor: number | null; solubilidad: string | null }> | null);
  const contraindicacionesPorId = porPrincipio(contraindicaciones.data as Array<{ principio_id: string; contraindicacion: string }> | null);
  const evidenciaPorId = porPrincipio(evidencia.data as Array<{ principio_id: string; nivel_evidencia: string }> | null);

  const exportacion: FilaExportacion[] = filas.map(p => {
    const dosisDelPrincipio = dosisPorId.get(p.id) ?? [];
    const usual = dosisDelPrincipio.find(d => d.tipo === 'usual') ?? dosisDelPrincipio[0];
    const minima = dosisDelPrincipio.find(d => d.tipo === 'minima');
    const maxima = dosisDelPrincipio.find(d => d.tipo === 'maxima');
    const presentacionPreferida = (presentacionesPorId.get(p.id) ?? []).find(pf => pf.preferida) ?? (presentacionesPorId.get(p.id) ?? [])[0];
    const props = (propiedadesPorId.get(p.id) ?? [])[0];
    const evid = (evidenciaPorId.get(p.id) ?? [])[0];

    return {
      nombreCanonico: p.nombre_canonico,
      nombreComercial: p.nombre_comercial ?? '',
      sinonimos: (sinonimosPorId.get(p.id) ?? []).map(s => s.sinonimo),
      descripcion: p.descripcion ?? '',
      dosisMinima: minima?.valor ?? null,
      dosisUsual: usual?.valor ?? null,
      dosisMaxima: maxima?.valor ?? null,
      dosisUnidad: usual?.unidad ?? '',
      dosisFrecuencia: usual?.frecuencia ?? '',
      formaFarmaceutica: presentacionPreferida?.forma ?? '',
      capacidadCapsulaMg: presentacionPreferida?.capacidad_capsula_mg ?? null,
      sabor: props?.sabor ?? '',
      intensidadSabor: props?.intensidad_sabor ?? null,
      solubilidad: props?.solubilidad ?? '',
      contraindicaciones: (contraindicacionesPorId.get(p.id) ?? []).map(c => c.contraindicacion),
      evidenciaNivel: evid?.nivel_evidencia ?? '',
    };
  });

  const csv = generarCSVExportacion(exportacion);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="principios_activos.csv"',
    },
  });
}
