import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolverTenantId } from '@/lib/tenant';
import { esUuidValido } from '@/lib/validation/id';
import {
  construirIndicadores, calcularRiesgoCardiovascular, calcularRiesgoMetabolico, calcularInflamacion,
  calcularEstadoIntestinal, calcularEstadoHormonal, calcularEstadoMitocondrial,
  priorizarProblemas, generarAlertasClinicas, generarRecordatorios, sugerirProximoControl,
  type ContextoDashboard, type Sexo, type LaboratorioEntrada,
} from '@/lib/clinica/dashboard';
import type { PatronFuncional } from '@/lib/clinica/patrones';
import type { FaseTerapeutica } from '@/lib/clinica/planTerapeutico';

type PacienteRow = {
  id: string; nombre: string; apellido: string | null; fecha_nacimiento: string | null;
  sexo: Sexo | null; motivo_consulta: string | null; observaciones: string | null;
};

async function contexto(pacienteId: string) {
  if (!esUuidValido(pacienteId)) return { error: NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 }) };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };

  const tenant = await resolverTenantId(supabase, user.id);
  if ('error' in tenant) return { error: tenant.error };

  const { data: paciente, error } = await supabase
    .from('pacientes')
    .select('id, nombre, apellido, fecha_nacimiento, sexo, motivo_consulta, observaciones')
    .eq('id', pacienteId)
    .eq('tenant_id', tenant.tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  if (!paciente) return { error: NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 }) };

  return { supabase, tenantId: tenant.tenantId, paciente: paciente as PacienteRow };
}

function calcularEdad(fechaNacimiento: string | null): number | null {
  if (!fechaNacimiento) return null;
  const nac = new Date(fechaNacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(id);
  if ('error' in ctx) return ctx.error;

  // Una única tanda de consultas en paralelo — el dashboard agrega 8
  // módulos y no puede pagar 8 round-trips secuenciales a la base.
  const [
    { data: historia },
    { data: diagnostico },
    { data: plan },
    { data: formulacion },
    { data: nutricion },
    { data: fase },
    { data: controles },
    { data: laboratorios },
  ] = await Promise.all([
    ctx.supabase.from('historias_clinicas').select('historia, completado').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('diagnosticos_funcionales').select('confirmado, patrones, impresion').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('planes_terapeuticos').select('fases').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('formulaciones_terapeuticas').select('estado, fase, items, firmada_en').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('planes_nutricionales_clinicos').select('estado, objetivo_clinico, aprobado_en').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('fases_terapeuticas').select('fase_seleccionada, confirmado').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('controles_clinicos').select('fase, ciclo_num, reduccion_ipt_pct, mejoria_objetivos_pct, adherencia_pct, decision, created_at').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).order('created_at', { ascending: true }).limit(50),
    ctx.supabase.from('laboratorios_clinicos').select('fecha, peso_kg, talla_cm, cintura_cm, presion_sistolica, presion_diastolica, glucemia_mg_dl, hba1c_pct, trigliceridos_mg_dl, hdl_mg_dl, ldl_mg_dl, vitamina_d_ng_ml, homa_ir, pcr_mg_l, ferritina_ng_ml').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).order('fecha', { ascending: true }).limit(50),
  ]);

  const historiaRow = historia as { historia?: Record<string, unknown>; completado?: boolean } | null;
  const diagnosticoRow = diagnostico as { confirmado?: boolean; patrones?: PatronFuncional[]; impresion?: string } | null;
  const planRow = plan as { fases?: FaseTerapeutica[] } | null;
  const formulacionRow = formulacion as { estado?: string; fase?: string; items?: unknown[]; firmada_en?: string | null } | null;
  const nutricionRow = nutricion as { estado?: string; objetivo_clinico?: string; aprobado_en?: string | null } | null;
  const faseRow = fase as { fase_seleccionada?: string; confirmado?: boolean } | null;
  const controlesRows = (controles ?? []) as Array<{ fase: string; ciclo_num: number; reduccion_ipt_pct: number; mejoria_objetivos_pct: number; adherencia_pct: number; decision: string; created_at: string }>;
  const laboratoriosRows = (laboratorios ?? []) as Array<{
    fecha: string; peso_kg: number | null; talla_cm: number | null; cintura_cm: number | null;
    presion_sistolica: number | null; presion_diastolica: number | null; glucemia_mg_dl: number | null;
    hba1c_pct: number | null; trigliceridos_mg_dl: number | null; hdl_mg_dl: number | null; ldl_mg_dl: number | null;
    vitamina_d_ng_ml: number | null; homa_ir: number | null; pcr_mg_l: number | null; ferritina_ng_ml: number | null;
  }>;

  const patrones = diagnosticoRow?.patrones ?? [];
  const patronesConfirmados = patrones.filter(p => p.estado === 'confirmado');
  const fases = planRow?.fases ?? [];
  const fasesActivas = fases.filter(f => f.estado === 'activa');
  const fasesSugeridas = fases.filter(f => f.estado === 'sugerida');

  const ultimoLaboratorio: LaboratorioEntrada | null = laboratoriosRows.length > 0
    ? (() => {
        const u = laboratoriosRows[laboratoriosRows.length - 1];
        return {
          fecha: u.fecha, pesoKg: u.peso_kg, tallaCm: u.talla_cm, cinturaCm: u.cintura_cm,
          presionSistolica: u.presion_sistolica, presionDiastolica: u.presion_diastolica,
          glucemiaMgDl: u.glucemia_mg_dl, hba1cPct: u.hba1c_pct, trigliceridosMgDl: u.trigliceridos_mg_dl,
          hdlMgDl: u.hdl_mg_dl, ldlMgDl: u.ldl_mg_dl, vitaminaDNgMl: u.vitamina_d_ng_ml,
          homaIr: u.homa_ir, pcrMgL: u.pcr_mg_l, ferritinaNgMl: u.ferritina_ng_ml,
        };
      })()
    : null;

  const indicadores = construirIndicadores(ultimoLaboratorio, ctx.paciente.sexo);

  const contextoDashboard: ContextoDashboard = {
    paciente: { sexo: ctx.paciente.sexo },
    historiaCompletada: Boolean(historiaRow?.completado),
    diagnosticoConfirmado: Boolean(diagnosticoRow?.confirmado),
    patrones,
    fasesActivas: fasesActivas.length,
    fasesSugeridas: fasesSugeridas.length,
    formulacionEstado: formulacionRow?.estado ?? null,
    nutricionEstado: nutricionRow?.estado ?? null,
    indicadores,
  };

  const CODIGOS_SERIE = ['peso_kg', 'cintura_cm', 'glucemia_mg_dl', 'hba1c_pct', 'trigliceridos_mg_dl', 'hdl_mg_dl', 'ldl_mg_dl', 'vitamina_d_ng_ml', 'homa_ir', 'pcr_mg_l', 'ferritina_ng_ml'] as const;
  const series: Record<string, Array<{ fecha: string; valor: number }>> = {};
  for (const campo of CODIGOS_SERIE) {
    series[campo] = laboratoriosRows.filter(r => r[campo] != null).map(r => ({ fecha: r.fecha, valor: r[campo] as number }));
  }
  series.imc = laboratoriosRows
    .filter(r => r.peso_kg != null && r.talla_cm != null && r.talla_cm > 0)
    .map(r => ({ fecha: r.fecha, valor: Math.round((r.peso_kg! / ((r.talla_cm! / 100) ** 2)) * 10) / 10 }));
  series.presion_sistolica = laboratoriosRows.filter(r => r.presion_sistolica != null).map(r => ({ fecha: r.fecha, valor: r.presion_sistolica as number }));
  series.presion_diastolica = laboratoriosRows.filter(r => r.presion_diastolica != null).map(r => ({ fecha: r.fecha, valor: r.presion_diastolica as number }));

  const proximoControl = sugerirProximoControl(fases.map(f => ({ estado: f.estado, duracionEstimadaSemanas: f.duracionEstimadaSemanas })));

  return NextResponse.json({
    paciente: {
      nombre: ctx.paciente.nombre, apellido: ctx.paciente.apellido,
      edad: calcularEdad(ctx.paciente.fecha_nacimiento), sexo: ctx.paciente.sexo,
      motivoConsulta: ctx.paciente.motivo_consulta, observaciones: ctx.paciente.observaciones,
    },
    alertas: generarAlertasClinicas(contextoDashboard),
    problemasPriorizados: priorizarProblemas(contextoDashboard),
    diagnostico: {
      confirmado: Boolean(diagnosticoRow?.confirmado),
      impresion: diagnosticoRow?.impresion ?? '',
      patronesConfirmados,
    },
    riesgoCardiovascular: calcularRiesgoCardiovascular(indicadores, patrones),
    riesgoMetabolico: calcularRiesgoMetabolico(indicadores, patrones),
    inflamacion: calcularInflamacion(indicadores, patrones),
    estadoIntestinal: calcularEstadoIntestinal(patrones),
    estadoHormonal: calcularEstadoHormonal(patrones),
    estadoMitocondrial: calcularEstadoMitocondrial(patrones),
    evolucionClinica: controlesRows.map(c => ({
      fecha: c.created_at, fase: c.fase, cicloNum: c.ciclo_num,
      reduccionIptPct: c.reduccion_ipt_pct, mejoriaObjetivosPct: c.mejoria_objetivos_pct,
      adherenciaPct: c.adherencia_pct, decision: c.decision,
    })),
    laboratorios: { indicadoresActuales: indicadores, series, ultimaFecha: ultimoLaboratorio?.fecha ?? null },
    formulacionActiva: formulacionRow ? {
      estado: formulacionRow.estado ?? 'borrador', fase: formulacionRow.fase ?? null,
      cantidadItems: Array.isArray(formulacionRow.items) ? formulacionRow.items.length : 0,
      firmadaEn: formulacionRow.firmada_en ?? null,
    } : null,
    nutricionActiva: nutricionRow ? {
      estado: nutricionRow.estado ?? 'borrador', objetivoClinico: nutricionRow.objetivo_clinico ?? null,
      aprobadoEn: nutricionRow.aprobado_en ?? null,
    } : null,
    proximoControl,
    recordatorios: generarRecordatorios(contextoDashboard),
    estadoTratamiento: {
      faseSeleccionada: faseRow?.fase_seleccionada ?? null, faseConfirmada: Boolean(faseRow?.confirmado),
      fasesActivas: fasesActivas.length, fasesTotal: fases.length,
      formulacionEstado: formulacionRow?.estado ?? null, nutricionEstado: nutricionRow?.estado ?? null,
    },
  });
}
