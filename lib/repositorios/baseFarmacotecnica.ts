/**
 * lib/repositorios/baseFarmacotecnica.ts
 *
 * Capa de repositorio del Motor Inteligente de Formulación (MIF):
 * funciones de acceso a datos puras (reciben el cliente Supabase ya
 * autenticado y el tenant ya resuelto, igual que el resto de las
 * rutas del proyecto — ver lib/tenant.ts / lib/adminAuth.ts).
 *
 * Todo lo que lee de las tablas del flujo clínico existente
 * (diagnosticos_funcionales, ipt_evaluaciones, fases_terapeuticas,
 * objetivos_terapeuticos) es de SÓLO LECTURA: este archivo nunca
 * inserta, actualiza ni borra nada en esas tablas — sólo en las
 * nuevas de la Base Farmacotécnica (preferencias del paciente y,
 * indirectamente a través de la Base de Conocimiento, principios
 * activos administrados desde su propio panel).
 */

import type { createClient } from '@/lib/supabase/server';
import type { Sabor } from '@/lib/validation/baseFarmacotecnica';
import type { PreferenciasPacienteInput } from '@/lib/validation/baseFarmacotecnica';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// ==================== Contexto clínico (lectura) ====================

export type ContextoClinicoPaciente = {
  diagnostico: { impresion: string | null; confirmado: boolean } | null;
  ipt: { confirmado: boolean } | null;
  fase: { faseSeleccionada: string; confirmado: boolean } | null;
  objetivos: { fase: string; objetivos: string[]; confirmado: boolean } | null;
};

/**
 * Lee, en paralelo, el estado de las cuatro etapas previas del flujo
 * clínico (diagnóstico → IPT → fase → objetivos) para un paciente.
 * No exige que estén confirmadas — eso lo decide quien llama (el
 * servicio del MIF), esta función sólo informa el estado tal cual
 * está guardado.
 */
export async function obtenerContextoClinicoPaciente(
  supabase: SupabaseServerClient,
  tenantId: string,
  pacienteId: string
): Promise<ContextoClinicoPaciente> {
  const [diagnostico, ipt, fase, objetivos] = await Promise.all([
    supabase.from('diagnosticos_funcionales').select('impresion, confirmado')
      .eq('tenant_id', tenantId).eq('paciente_id', pacienteId).maybeSingle(),
    supabase.from('ipt_evaluaciones').select('confirmado')
      .eq('tenant_id', tenantId).eq('paciente_id', pacienteId).maybeSingle(),
    supabase.from('fases_terapeuticas').select('fase_seleccionada, confirmado')
      .eq('tenant_id', tenantId).eq('paciente_id', pacienteId).maybeSingle(),
    supabase.from('objetivos_terapeuticos').select('fase, objetivos, confirmado')
      .eq('tenant_id', tenantId).eq('paciente_id', pacienteId).maybeSingle(),
  ]);

  const d = diagnostico.data as { impresion: string | null; confirmado: boolean } | null;
  const i = ipt.data as { confirmado: boolean } | null;
  const f = fase.data as { fase_seleccionada: string; confirmado: boolean } | null;
  const o = objetivos.data as { fase: string; objetivos: string[]; confirmado: boolean } | null;

  return {
    diagnostico: d ? { impresion: d.impresion, confirmado: Boolean(d.confirmado) } : null,
    ipt: i ? { confirmado: Boolean(i.confirmado) } : null,
    fase: f ? { faseSeleccionada: f.fase_seleccionada, confirmado: Boolean(f.confirmado) } : null,
    objetivos: o ? { fase: o.fase, objetivos: o.objetivos ?? [], confirmado: Boolean(o.confirmado) } : null,
  };
}

// ==================== Base Farmacotécnica: principios completos ====================

export type UnidadDosisPrincipio = 'mg' | 'g' | 'mcg' | 'ui' | 'ml';
export type DosisPrincipio = { valor: number; unidad: UnidadDosisPrincipio };

export type PrincipioFarmacotecnico = {
  id: string;
  nombreCanonico: string;
  nombreCientifico: string | null;
  sinonimos: string[];
  categorias: string[];
  // Valor CRUDO, en la unidad tal cual está cargada (mg/g/mcg/ui/ml) —
  // nunca asumida en mg: convertir de unidad es responsabilidad
  // explícita del motor de reglas (lib/clinica/mif.ts), no de este
  // repositorio, precisamente para que una dosis en gramos (ej.
  // "Glutamina 5 g") nunca se trate por accidente como "5 mg".
  dosisMinima: DosisPrincipio | null;
  dosisUsual: DosisPrincipio | null;
  dosisMaxima: DosisPrincipio | null;
  capacidadCapsulaMg: number | null;
  tamanoCapsula: string | null;
  maxCapsulasPorToma: number | null;
  presentacionIdeal: string | null;
  farmacotecnia: {
    compatibleSobres: boolean | null;
    compatibleLiquidos: boolean | null;
    compatibleCapsulas: boolean | null;
    higroscopico: boolean | null;
    fotosensible: boolean | null;
    sensibleCalor: boolean | null;
  };
  perfilOrganoleptico: {
    tipoSabor: string | null;
    intensidad: string | null;
    facilidadEnmascarar: string | null;
    intensidadNumerica: number | null;
    estabilidad: string | null;
  };
  saboresCompatibles: Array<{ sabor: Sabor; nivelAceptacion: number }>;
  incompatibilidadesNombres: string[];
  compatibilidadesNombres: string[];
};

function aDosisPrincipio(fila: { valor: number; unidad: UnidadDosisPrincipio } | undefined): DosisPrincipio | null {
  if (!fila) return null;
  return { valor: fila.valor, unidad: fila.unidad };
}

/** Sólo principios en estado 'validado' — igual que el resto del sistema (ver lib/clinica/baseConocimiento.ts). */
export async function listarPrincipiosValidadosCompletos(
  supabase: SupabaseServerClient,
  tenantId: string
): Promise<PrincipioFarmacotecnico[]> {
  const { data: principios } = await supabase
    .from('principios_activos')
    .select('id, nombre_canonico, nombre_cientifico, estado')
    .eq('estado', 'validado')
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);

  const filas = (principios ?? []) as Array<{ id: string; nombre_canonico: string; nombre_cientifico: string | null; estado: string }>;
  if (filas.length === 0) return [];
  const ids = filas.map(f => f.id);

  const [sinonimos, categorias, dosis, presentaciones, propiedades, farmacotecnia, sabores, incompatibilidades, compatibilidades] = await Promise.all([
    supabase.from('sinonimos_principios').select('principio_id, sinonimo').in('principio_id', ids),
    supabase.from('principio_categoria').select('principio_id, categoria:categorias_clinicas(nombre)').in('principio_id', ids),
    supabase.from('dosis_principios').select('principio_id, tipo, valor, unidad').in('principio_id', ids),
    supabase.from('presentaciones_farmaceuticas').select('principio_id, forma, capacidad_capsula_mg, tamano_capsula, max_capsulas_por_toma, preferida').in('principio_id', ids),
    supabase.from('propiedades_organolepticas').select('principio_id, tipo_sabor, intensidad_categoria, intensidad_sabor, facilidad_enmascarar, estabilidad').in('principio_id', ids),
    supabase.from('farmacotecnia_principios').select('principio_id, compatible_sobres, compatible_liquidos, compatible_capsulas, higroscopico, fotosensible, sensible_calor').in('principio_id', ids),
    supabase.from('sabores_principios').select('principio_id, sabor, nivel_aceptacion').in('principio_id', ids),
    supabase.from('incompatibilidades_formulacion').select('principio_id, principio_incompatible:principios_activos!incompatibilidades_formulacion_principio_incompatible_id_fkey(nombre_canonico)').in('principio_id', ids),
    supabase.from('compatibilidades_formulacion').select('principio_id, principio_compatible:principios_activos!compatibilidades_formulacion_principio_compatible_id_fkey(nombre_canonico)').in('principio_id', ids),
  ]);

  const agrupar = <T extends { principio_id: string }>(filas: T[] | null | undefined) => {
    const mapa = new Map<string, T[]>();
    for (const f of filas ?? []) { if (!mapa.has(f.principio_id)) mapa.set(f.principio_id, []); mapa.get(f.principio_id)!.push(f); }
    return mapa;
  };

  const sinonimosPorId = agrupar(sinonimos.data as Array<{ principio_id: string; sinonimo: string }> | null);
  const categoriasPorId = agrupar(categorias.data as unknown as Array<{ principio_id: string; categoria: { nombre: string } | null }> | null);
  const dosisPorId = agrupar(dosis.data as Array<{ principio_id: string; tipo: string; valor: number; unidad: UnidadDosisPrincipio }> | null);
  const presentacionesPorId = agrupar(presentaciones.data as Array<{ principio_id: string; forma: string; capacidad_capsula_mg: number | null; tamano_capsula: string | null; max_capsulas_por_toma: number | null; preferida: boolean }> | null);
  const propiedadesPorId = agrupar(propiedades.data as Array<{ principio_id: string; tipo_sabor: string | null; intensidad_categoria: string | null; intensidad_sabor: number | null; facilidad_enmascarar: string | null; estabilidad: string | null }> | null);
  const farmacotecniaPorId = agrupar(farmacotecnia.data as Array<{ principio_id: string; compatible_sobres: boolean | null; compatible_liquidos: boolean | null; compatible_capsulas: boolean | null; higroscopico: boolean | null; fotosensible: boolean | null; sensible_calor: boolean | null }> | null);
  const saboresPorId = agrupar(sabores.data as Array<{ principio_id: string; sabor: string; nivel_aceptacion: number }> | null);
  const incompatibilidadesPorId = agrupar(incompatibilidades.data as unknown as Array<{ principio_id: string; principio_incompatible: { nombre_canonico: string } | null }> | null);
  const compatibilidadesPorId = agrupar(compatibilidades.data as unknown as Array<{ principio_id: string; principio_compatible: { nombre_canonico: string } | null }> | null);

  return filas.map(p => {
    const dosisDelPrincipio = dosisPorId.get(p.id) ?? [];
    const presentacionPreferida = (presentacionesPorId.get(p.id) ?? []).find(pf => pf.preferida) ?? (presentacionesPorId.get(p.id) ?? [])[0];
    const props = (propiedadesPorId.get(p.id) ?? [])[0];
    const farma = (farmacotecniaPorId.get(p.id) ?? [])[0];

    return {
      id: p.id,
      nombreCanonico: p.nombre_canonico,
      nombreCientifico: p.nombre_cientifico,
      sinonimos: (sinonimosPorId.get(p.id) ?? []).map(s => s.sinonimo),
      categorias: (categoriasPorId.get(p.id) ?? []).map(c => c.categoria?.nombre).filter((n): n is string => Boolean(n)),
      dosisMinima: aDosisPrincipio(dosisDelPrincipio.find(d => d.tipo === 'minima')),
      dosisUsual: aDosisPrincipio(dosisDelPrincipio.find(d => d.tipo === 'usual')),
      dosisMaxima: aDosisPrincipio(dosisDelPrincipio.find(d => d.tipo === 'maxima')),
      capacidadCapsulaMg: presentacionPreferida?.capacidad_capsula_mg ?? null,
      tamanoCapsula: presentacionPreferida?.tamano_capsula ?? null,
      maxCapsulasPorToma: presentacionPreferida?.max_capsulas_por_toma ?? null,
      presentacionIdeal: presentacionPreferida?.forma ?? null,
      farmacotecnia: {
        compatibleSobres: farma?.compatible_sobres ?? null,
        compatibleLiquidos: farma?.compatible_liquidos ?? null,
        compatibleCapsulas: farma?.compatible_capsulas ?? null,
        higroscopico: farma?.higroscopico ?? null,
        fotosensible: farma?.fotosensible ?? null,
        sensibleCalor: farma?.sensible_calor ?? null,
      },
      perfilOrganoleptico: {
        tipoSabor: props?.tipo_sabor ?? null,
        intensidad: props?.intensidad_categoria ?? null,
        facilidadEnmascarar: props?.facilidad_enmascarar ?? null,
        intensidadNumerica: props?.intensidad_sabor ?? null,
        estabilidad: props?.estabilidad ?? null,
      },
      saboresCompatibles: (saboresPorId.get(p.id) ?? []).map(s => ({ sabor: s.sabor as Sabor, nivelAceptacion: s.nivel_aceptacion })),
      incompatibilidadesNombres: (incompatibilidadesPorId.get(p.id) ?? []).map(i => i.principio_incompatible?.nombre_canonico).filter((n): n is string => Boolean(n)),
      compatibilidadesNombres: (compatibilidadesPorId.get(p.id) ?? []).map(c => c.principio_compatible?.nombre_canonico).filter((n): n is string => Boolean(n)),
    };
  });
}

// ==================== Preferencias del paciente ====================

export type PreferenciasPaciente = {
  saborFavorito: Sabor | null;
  saboresRechazados: Sabor[];
  dificultadTragarCapsulas: 'si' | 'no' | 'parcial' | null;
  preferenciaForma: 'capsula' | 'sobre' | 'liquido' | null;
  notas: string | null;
};

export async function obtenerPreferenciasPaciente(
  supabase: SupabaseServerClient,
  tenantId: string,
  pacienteId: string
): Promise<PreferenciasPaciente | null> {
  const { data } = await supabase
    .from('preferencias_formulacion_paciente')
    .select('sabor_favorito, sabores_rechazados, dificultad_tragar_capsulas, preferencia_forma, notas')
    .eq('tenant_id', tenantId).eq('paciente_id', pacienteId).maybeSingle();

  if (!data) return null;
  const fila = data as {
    sabor_favorito: string | null; sabores_rechazados: string[] | null;
    dificultad_tragar_capsulas: string | null; preferencia_forma: string | null; notas: string | null;
  };
  return {
    saborFavorito: (fila.sabor_favorito as Sabor | null) ?? null,
    saboresRechazados: (fila.sabores_rechazados as Sabor[] | null) ?? [],
    dificultadTragarCapsulas: fila.dificultad_tragar_capsulas as PreferenciasPaciente['dificultadTragarCapsulas'],
    preferenciaForma: fila.preferencia_forma as PreferenciasPaciente['preferenciaForma'],
    notas: fila.notas,
  };
}

/**
 * Crea o actualiza las preferencias de formulación de un paciente.
 * RLS exige paciente activo del mismo tenant en el INSERT (igual que
 * diagnosticos_funcionales/objetivos_terapeuticos); esta función no
 * repite esa verificación porque, como el resto del proyecto, confía
 * en la política de base de datos como segunda capa (ver ADR-0001 en
 * BIOHEALTH_DECISIONS.md) — quien llame desde una ruta debe seguir
 * resolviendo tenantId con lib/tenant.ts antes de invocar esto.
 */
export async function guardarPreferenciasPaciente(
  supabase: SupabaseServerClient,
  tenantId: string,
  pacienteId: string,
  userId: string,
  datos: PreferenciasPacienteInput
): Promise<{ error: string } | { ok: true }> {
  const { error } = await (supabase.from('preferencias_formulacion_paciente') as any).upsert({
    tenant_id: tenantId,
    paciente_id: pacienteId,
    sabor_favorito: datos.saborFavorito ?? null,
    sabores_rechazados: datos.saboresRechazados,
    dificultad_tragar_capsulas: datos.dificultadTragarCapsulas ?? null,
    preferencia_forma: datos.preferenciaForma ?? null,
    notas: datos.notas ?? null,
    actualizado_por: userId,
  }, { onConflict: 'tenant_id,paciente_id' });

  if (error) return { error: error.message };
  return { ok: true };
}
