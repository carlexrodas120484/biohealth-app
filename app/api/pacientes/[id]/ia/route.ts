import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolverTenantId } from '@/lib/tenant';
import { esUuidValido } from '@/lib/validation/id';
import { construirResumenClinico } from '@/lib/clinica/cuestionario';
import { construirIndicadores } from '@/lib/clinica/dashboard';
import { generarInformeIA, type ContextoMotorIA } from '@/lib/clinica/motorIA';
import type { PatronFuncional } from '@/lib/clinica/patrones';
import type { FaseTerapeutica } from '@/lib/clinica/planTerapeutico';
import type { Alerta } from '@/lib/clinica/formulacion';
import type { Sexo } from '@/lib/clinica/dashboard';
import type { LaboratorioEntrada } from '@/lib/clinica/dashboard';

type PacienteRow = {
  id: string; nombre: string; apellido: string | null; fecha_nacimiento: string | null;
  sexo: Sexo | null; motivo_consulta: string | null; alergias: string | null;
  medicamentos_actuales: string | null; antecedentes_personales: string | null; antecedentes_familiares: string | null;
};

async function contexto(pacienteId: string) {
  if (!esUuidValido(pacienteId)) return { error: NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 }) };

  // Sólo lectura: el motor de IA nunca modifica datos, así que esta
  // ruta no expone ningún método más que GET.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };

  const tenant = await resolverTenantId(supabase, user.id);
  if ('error' in tenant) return { error: tenant.error };

  const { data: paciente, error } = await supabase
    .from('pacientes')
    .select('id, nombre, apellido, fecha_nacimiento, sexo, motivo_consulta, alergias, medicamentos_actuales, antecedentes_personales, antecedentes_familiares')
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

  // Una única tanda de consultas en paralelo, igual que el dashboard —
  // el motor de IA cruza 6 módulos y no puede pagar 6+ round-trips
  // secuenciales a la base para armar un solo informe de lectura.
  const [
    { data: historia },
    { data: diagnostico },
    { data: plan },
    { data: formulacion },
    { data: nutricion },
    { data: objetivos },
    { data: controles },
    { data: laboratorios },
  ] = await Promise.all([
    ctx.supabase.from('historias_clinicas').select('respuestas, completado').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('diagnosticos_funcionales').select('confirmado, patrones, impresion').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('planes_terapeuticos').select('fases').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('formulaciones_terapeuticas').select('estado, ingredientes, alertas').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('planes_nutricionales_clinicos').select('estado, objetivo_clinico').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('objetivos_terapeuticos').select('objetivos, confirmado').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('controles_clinicos').select('decision, bandera_roja_nueva, created_at').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ctx.supabase.from('laboratorios_clinicos').select('fecha, peso_kg, talla_cm, cintura_cm, presion_sistolica, presion_diastolica, glucemia_mg_dl, hba1c_pct, trigliceridos_mg_dl, hdl_mg_dl, ldl_mg_dl, vitamina_d_ng_ml, homa_ir, pcr_mg_l, ferritina_ng_ml').eq('paciente_id', id).eq('tenant_id', ctx.tenantId).order('fecha', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const historiaRow = historia as { respuestas?: Record<string, number>; completado?: boolean } | null;
  const diagnosticoRow = diagnostico as { confirmado?: boolean; patrones?: PatronFuncional[]; impresion?: string } | null;
  const planRow = plan as { fases?: FaseTerapeutica[] } | null;
  const formulacionRow = formulacion as { estado?: string; ingredientes?: Array<{ nombre: string }>; alertas?: Alerta[] } | null;
  const nutricionRow = nutricion as { estado?: string; objetivo_clinico?: string } | null;
  const objetivosRow = objetivos as { objetivos?: string[]; confirmado?: boolean } | null;
  const controlRow = controles as { decision?: string; bandera_roja_nueva?: boolean } | null;
  const laboratorioRow = laboratorios as {
    fecha: string; peso_kg: number | null; talla_cm: number | null; cintura_cm: number | null;
    presion_sistolica: number | null; presion_diastolica: number | null; glucemia_mg_dl: number | null;
    hba1c_pct: number | null; trigliceridos_mg_dl: number | null; hdl_mg_dl: number | null; ldl_mg_dl: number | null;
    vitamina_d_ng_ml: number | null; homa_ir: number | null; pcr_mg_l: number | null; ferritina_ng_ml: number | null;
  } | null;

  const ultimoLaboratorio: LaboratorioEntrada | null = laboratorioRow
    ? {
        fecha: laboratorioRow.fecha, pesoKg: laboratorioRow.peso_kg, tallaCm: laboratorioRow.talla_cm, cinturaCm: laboratorioRow.cintura_cm,
        presionSistolica: laboratorioRow.presion_sistolica, presionDiastolica: laboratorioRow.presion_diastolica,
        glucemiaMgDl: laboratorioRow.glucemia_mg_dl, hba1cPct: laboratorioRow.hba1c_pct, trigliceridosMgDl: laboratorioRow.trigliceridos_mg_dl,
        hdlMgDl: laboratorioRow.hdl_mg_dl, ldlMgDl: laboratorioRow.ldl_mg_dl, vitaminaDNgMl: laboratorioRow.vitamina_d_ng_ml,
        homaIr: laboratorioRow.homa_ir, pcrMgL: laboratorioRow.pcr_mg_l, ferritinaNgMl: laboratorioRow.ferritina_ng_ml,
      }
    : null;

  const respuestas = historiaRow?.respuestas ?? {};
  const resumenCuestionario = Object.keys(respuestas).length > 0
    ? (() => {
        const r = construirResumenClinico(respuestas, ctx.paciente.sexo ? { sexo: ctx.paciente.sexo } : undefined);
        return {
          sistemasAlterados: r.sistemas.filter(s => s.severidad !== 'sin_alteracion').slice(0, 5).map(s => s.sistema),
          topSintomas: r.topSintomas.map(s => s.texto),
        };
      })()
    : null;

  const contextoMotorIA: ContextoMotorIA = {
    paciente: {
      nombreCompleto: [ctx.paciente.nombre, ctx.paciente.apellido].filter(Boolean).join(' '),
      edad: calcularEdad(ctx.paciente.fecha_nacimiento), sexo: ctx.paciente.sexo,
      motivoConsulta: ctx.paciente.motivo_consulta, alergias: ctx.paciente.alergias,
      medicamentosActuales: ctx.paciente.medicamentos_actuales, antecedentesPersonales: ctx.paciente.antecedentes_personales,
      antecedentesFamiliares: ctx.paciente.antecedentes_familiares,
    },
    historiaCompletada: Boolean(historiaRow?.completado),
    resumenCuestionario,
    diagnosticoConfirmado: Boolean(diagnosticoRow?.confirmado),
    impresionDiagnostica: diagnosticoRow?.impresion ?? '',
    patrones: diagnosticoRow?.patrones ?? [],
    objetivosConfirmados: objetivosRow?.confirmado ? (objetivosRow.objetivos ?? []) : [],
    fases: (planRow?.fases ?? []).map(f => ({ nombre: f.nombre, estado: f.estado, objetivo: f.objetivo })),
    formulacion: formulacionRow ? {
      estado: formulacionRow.estado ?? null,
      ingredientesNombres: (formulacionRow.ingredientes ?? []).map(i => i.nombre),
      alertasMotor: formulacionRow.alertas ?? [],
    } : null,
    nutricion: nutricionRow ? { estado: nutricionRow.estado ?? null, objetivoClinico: nutricionRow.objetivo_clinico ?? null } : null,
    indicadores: construirIndicadores(ultimoLaboratorio, ctx.paciente.sexo),
    ultimoControl: controlRow ? { decision: controlRow.decision ?? '', banderaRojaNueva: Boolean(controlRow.bandera_roja_nueva) } : null,
  };

  return NextResponse.json(generarInformeIA(contextoMotorIA));
}
