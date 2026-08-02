export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { resolverTenantId } from '@/lib/tenant';
import { esUuidValido } from '@/lib/validation/id';
import { renderPdf } from '@/lib/pdf/render';
import { informeMedico, informePaciente, recetaBotica } from '@/lib/pdf/documentos-clinicos';
import {
  TIPOS_INFORME, generarInformeHtml, tieneContenido, nombreArchivo, nombreArchivoConEtiqueta, piePaginaHtml,
  type TipoInforme, type ContextoInforme, type HistoriaInforme, type DiagnosticoInforme,
  type PlanTerapeuticoInforme, type FormulacionInforme, type NutricionInforme,
} from '@/lib/pdf/informes';
import { construirResumenClinico, type Sexo } from '@/lib/clinica/cuestionario';
import type { Fase } from '@/lib/algoritmo/fases';

const TIPOS_LEGACY = ['receta_botica', 'informe_medico', 'informe_paciente'] as const;
type TipoLegacy = (typeof TIPOS_LEGACY)[number];
const ETIQUETA_TIPO_LEGACY: Record<TipoLegacy, string> = {
  receta_botica: 'Receta para botica',
  informe_medico: 'Informe medico',
  informe_paciente: 'Indicaciones para el paciente',
};

const TODOS_LOS_TIPOS = [...TIPOS_LEGACY, ...TIPOS_INFORME] as [string, ...string[]];
const Schema = z.object({ tipo: z.enum(TODOS_LOS_TIPOS) });

function esLegacy(tipo: string): tipo is TipoLegacy {
  return (TIPOS_LEGACY as readonly string[]).includes(tipo);
}

type PacienteRow = {
  id: string;
  nombre: string;
  apellido: string | null;
  documento: string | null;
  fecha_nacimiento: string | null;
  sexo: Sexo | null;
  telefono: string | null;
  motivo_consulta: string | null;
  antecedentes_personales: string | null;
  medicamentos_actuales: string | null;
  alergias: string | null;
};

async function contexto(id: string) {
  if (!esUuidValido(id)) return { error: NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 }) };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };

  const tenant = await resolverTenantId(supabase, user.id);
  if ('error' in tenant) return { error: tenant.error };

  const { data: paciente, error } = await supabase
    .from('pacientes')
    .select('id, nombre, apellido, documento, fecha_nacimiento, sexo, telefono, motivo_consulta, antecedentes_personales, medicamentos_actuales, alergias')
    .eq('id', id)
    .eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  if (!paciente) return { error: NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 }) };

  return { supabase, tenantId: tenant.tenantId, user, paciente: paciente as PacienteRow };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;

  const { data, error } = await ctx.supabase
    .from('documentos_clinicos_generados')
    .select('id, tipo, version, estado, generado_en, generado_por, contenido_hash')
    .eq('paciente_id', id)
    .eq('tenant_id', ctx.tenantId)
    .order('generado_en', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ historial: data ?? [] });
}

// ---- Fuentes de datos para los 6 tipos de informe nuevos: cada
// función devuelve `null` si el módulo no tiene datos aprobados/
// confirmados que se puedan mostrar como definitivos. ----

function extraerCamposNarrativos(historia: Record<string, unknown>): Array<{ etiqueta: string; valor: string }> {
  const campos: Array<[string, string]> = [
    ['enfermedadActual', 'Enfermedad actual'],
    ['impresionClinica', 'Impresión clínica inicial'],
    ['planInicial', 'Plan inicial'],
  ];
  return campos
    .map(([clave, etiqueta]) => ({ etiqueta, valor: typeof historia[clave] === 'string' ? (historia[clave] as string).trim() : '' }))
    .filter(c => c.valor.length > 0);
}

async function obtenerHistoria(supabase: Awaited<ReturnType<typeof createClient>>, pacienteId: string, tenantId: string, sexo: Sexo | null): Promise<HistoriaInforme> {
  const { data } = await supabase.from('historias_clinicas').select('historia, respuestas, completado').eq('paciente_id', pacienteId).eq('tenant_id', tenantId).maybeSingle();
  const d = data as { historia?: Record<string, unknown>; respuestas?: Record<string, number>; completado?: boolean } | null;
  if (!d) return null;
  const camposNarrativos = extraerCamposNarrativos(d.historia ?? {});
  const resumenCuestionario = d.respuestas && Object.keys(d.respuestas).length > 0
    ? construirResumenClinico(d.respuestas, sexo ? { sexo } : undefined)
    : null;
  if (camposNarrativos.length === 0 && !resumenCuestionario) return null;
  return { camposNarrativos, resumenCuestionario };
}

async function obtenerDiagnostico(supabase: Awaited<ReturnType<typeof createClient>>, pacienteId: string, tenantId: string): Promise<DiagnosticoInforme> {
  const { data } = await supabase.from('diagnosticos_funcionales').select('confirmado, patrones, impresion, estudios').eq('paciente_id', pacienteId).eq('tenant_id', tenantId).maybeSingle();
  const d = data as { confirmado?: boolean; patrones?: Array<{ nombre: string; nivel: string; prioridad: string; estado: string }>; impresion?: string; estudios?: string } | null;
  if (!d || !d.confirmado) return null;
  const patrones = (d.patrones ?? []).filter(p => p.estado === 'confirmado').map(p => ({ nombre: p.nombre, nivel: p.nivel, prioridad: p.prioridad }));
  return { patrones, impresion: d.impresion ?? '', estudios: d.estudios ?? '' };
}

async function obtenerPlanTerapeutico(supabase: Awaited<ReturnType<typeof createClient>>, pacienteId: string, tenantId: string): Promise<PlanTerapeuticoInforme> {
  const { data } = await supabase.from('planes_terapeuticos').select('fases').eq('paciente_id', pacienteId).eq('tenant_id', tenantId).maybeSingle();
  const fases = ((data as { fases?: Array<{ nombre: string; objetivo: string; estado: string; prioridad: string; duracionEstimadaSemanas: number; observacionesMedico: string }> } | null)?.fases ?? [])
    .filter(f => f.estado === 'activa' || f.estado === 'completada')
    .map(f => ({ nombre: f.nombre, objetivo: f.objetivo, estado: f.estado, prioridad: f.prioridad, duracionEstimadaSemanas: f.duracionEstimadaSemanas, observacionesMedico: f.observacionesMedico }));
  if (fases.length === 0) return null;
  return { fases };
}

async function obtenerFormulacion(supabase: Awaited<ReturnType<typeof createClient>>, pacienteId: string, tenantId: string): Promise<{ informe: FormulacionInforme; id: string | null }> {
  const { data } = await supabase.from('formulaciones_terapeuticas').select('id, fase, objetivos, items, ingredientes, estado, firmada_en, version_reglas').eq('paciente_id', pacienteId).eq('tenant_id', tenantId).maybeSingle();
  const f = data as {
    id?: string; fase?: string; objetivos?: string[];
    items?: Array<{ nombre: string; dosis: string; presentacion?: string; cantidad?: string; indicacion: string; observaciones?: string }>;
    ingredientes?: Array<{ nombre: string; dosisPorTomaMg: number; vecesPorDia: number; horario: string }>;
    estado?: string; firmada_en?: string | null; version_reglas?: string | null;
  } | null;
  if (!f || f.estado !== 'aprobada' || !Array.isArray(f.items) || f.items.length === 0) return { informe: null, id: null };
  return {
    informe: {
      fase: f.fase ?? '', objetivos: f.objetivos ?? [], items: f.items,
      ingredientes: f.ingredientes ?? [], firmadaEn: f.firmada_en ?? null, versionReglas: f.version_reglas ?? null,
    },
    id: f.id ?? null,
  };
}

async function obtenerNutricion(supabase: Awaited<ReturnType<typeof createClient>>, pacienteId: string, tenantId: string): Promise<NutricionInforme> {
  const { data } = await supabase.from('planes_nutricionales_clinicos').select('objetivo_clinico, calculos, plan, restricciones, advertencias, estado').eq('paciente_id', pacienteId).eq('tenant_id', tenantId).maybeSingle();
  const n = data as {
    objetivo_clinico?: string; calculos?: NonNullable<NutricionInforme>['calculos'];
    plan?: NonNullable<NutricionInforme>['plan']; restricciones?: NonNullable<NutricionInforme>['restricciones'];
    advertencias?: string[]; estado?: string;
  } | null;
  if (!n || n.estado !== 'aprobado' || !n.plan) return null;
  return {
    objetivoClinico: n.objetivo_clinico ?? '',
    calculos: n.calculos ?? {},
    plan: n.plan,
    restricciones: n.restricciones ?? { alergiasAlimentarias: [], celiaquia: false, vegetarianismo: false, veganismo: false },
    advertencias: n.advertencias ?? [],
  };
}

async function construirContexto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paciente: PacienteRow,
  tenantId: string,
  tipo: TipoInforme
): Promise<{ ctx: ContextoInforme; formulacionId: string | null }> {
  const pacienteInforme = {
    nombre: paciente.nombre, apellido: paciente.apellido, documento: paciente.documento,
    fechaNacimiento: paciente.fecha_nacimiento, sexo: paciente.sexo, telefono: paciente.telefono,
    motivoConsulta: paciente.motivo_consulta,
  };
  const generadoEn = new Date().toISOString();

  const necesita = {
    historia: tipo === 'informe_clinico_completo' || tipo === 'informe_integrado',
    diagnostico: tipo === 'informe_clinico_completo' || tipo === 'resumen_diagnostico' || tipo === 'informe_integrado',
    plan: tipo === 'plan_terapeutico' || tipo === 'informe_integrado',
    formulacion: tipo === 'receta_ortomolecular' || tipo === 'informe_integrado',
    nutricion: tipo === 'plan_nutricional' || tipo === 'informe_integrado',
  };

  const [historia, diagnostico, planTerapeutico, formulacionResultado, nutricion] = await Promise.all([
    necesita.historia ? obtenerHistoria(supabase, paciente.id, tenantId, paciente.sexo) : Promise.resolve(null),
    necesita.diagnostico ? obtenerDiagnostico(supabase, paciente.id, tenantId) : Promise.resolve(null),
    necesita.plan ? obtenerPlanTerapeutico(supabase, paciente.id, tenantId) : Promise.resolve(null),
    necesita.formulacion ? obtenerFormulacion(supabase, paciente.id, tenantId) : Promise.resolve({ informe: null, id: null }),
    necesita.nutricion ? obtenerNutricion(supabase, paciente.id, tenantId) : Promise.resolve(null),
  ]);

  return {
    ctx: {
      paciente: pacienteInforme, historia, diagnostico, planTerapeutico,
      formulacion: formulacionResultado.informe, nutricion, generadoEn, version: 1,
    },
    formulacionId: formulacionResultado.id,
  };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 422 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Tipo de documento inválido.' }, { status: 422 });
  const tipo = parsed.data.tipo;

  try {
    let html: string;
    let formulacionId: string | null = null;
    let nombre: string;

    // Versión: siguiente número para este paciente+tipo, para que el
    // historial refleje cuántas veces se regeneró cada documento.
    const { data: previaVersion } = await ctx.supabase
      .from('documentos_clinicos_generados')
      .select('version')
      .eq('paciente_id', id).eq('tenant_id', ctx.tenantId).eq('tipo', tipo)
      .order('version', { ascending: false }).limit(1).maybeSingle();
    const version = ((previaVersion as { version?: number } | null)?.version ?? 0) + 1;

    if (esLegacy(tipo)) {
      const { data: formulacion, error: errorFormulacion } = await ctx.supabase
        .from('formulaciones_terapeuticas')
        .select('*')
        .eq('paciente_id', id)
        .eq('tenant_id', ctx.tenantId)
        .maybeSingle();
      if (errorFormulacion) return NextResponse.json({ error: errorFormulacion.message }, { status: 500 });
      if (!formulacion) return NextResponse.json({ error: 'La formulación no existe.' }, { status: 404 });

      const f = formulacion as unknown as {
        id: string; fase: Fase; objetivos: string[];
        items: Array<{ nombre: string; dosis: string; presentacion?: string; cantidad?: string; indicacion: string; observaciones?: string; evidencia?: string; fuente?: string }>;
        revision_clinica?: Record<string, string>; estado?: string; firmada_en?: string | null; version_reglas?: string;
      };
      if (f.estado !== 'aprobada') return NextResponse.json({ error: 'Primero debe aprobar y firmar la formulación.' }, { status: 409 });
      if (!Array.isArray(f.items) || f.items.length === 0) return NextResponse.json({ error: 'La formulación no tiene componentes.' }, { status: 422 });

      const generadores = { receta_botica: recetaBotica, informe_medico: informeMedico, informe_paciente: informePaciente };
      const pacienteDoc = {
        nombre: ctx.paciente.nombre, apellido: ctx.paciente.apellido, documento: ctx.paciente.documento,
        fecha_nacimiento: ctx.paciente.fecha_nacimiento, sexo: ctx.paciente.sexo, telefono: ctx.paciente.telefono,
        motivo_consulta: ctx.paciente.motivo_consulta, antecedentes_personales: ctx.paciente.antecedentes_personales,
        medicamentos_actuales: ctx.paciente.medicamentos_actuales, alergias: ctx.paciente.alergias,
      };
      html = generadores[tipo](pacienteDoc, f);
      formulacionId = f.id;
      nombre = nombreArchivoConEtiqueta(
        { nombre: ctx.paciente.nombre, apellido: ctx.paciente.apellido },
        ETIQUETA_TIPO_LEGACY[tipo],
        new Date().toISOString()
      );
    } else {
      const tipoInforme = tipo as TipoInforme;
      const { ctx: contextoInforme, formulacionId: idFormulacion } = await construirContexto(ctx.supabase, ctx.paciente, ctx.tenantId, tipoInforme);

      if (!tieneContenido(tipoInforme, contextoInforme)) {
        return NextResponse.json({ error: 'No hay datos aprobados o confirmados para generar este informe.' }, { status: 422 });
      }
      contextoInforme.version = version;

      html = generarInformeHtml(tipoInforme, contextoInforme);
      formulacionId = tipoInforme === 'receta_ortomolecular' ? idFormulacion : null;
      nombre = nombreArchivo(contextoInforme.paciente, tipoInforme, contextoInforme.generadoEn);
    }

    const pdf = await renderPdf(html, { footerTemplate: piePaginaHtml() });
    const contenidoHash = crypto.createHash('sha256').update(html).digest('hex');

    await (ctx.supabase.from('documentos_clinicos_generados') as any).insert({
      tenant_id: ctx.tenantId, paciente_id: id, formulacion_id: formulacionId, tipo,
      generado_por: ctx.user.id, contenido_hash: contenidoHash, version,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nombre}"` },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo generar el documento.' }, { status: 500 });
  }
}
