/**
 * lib/pdf/informes.ts
 *
 * Motor de armado del Informe Clínico y PDF. Igual que el resto de los
 * motores clínicos de este proyecto (lib/clinica/*.ts): funciones puras,
 * sin acceso a Supabase — reciben datos ya resueltos, filtrados y
 * aprobados por la ruta que los llama, y arman el HTML que luego
 * lib/pdf/render.ts convierte en PDF. Nunca recalculan una dosis, un
 * puntaje ni una decisión clínica; sólo maquetan lo que ya fue guardado.
 *
 * Cada sección se omite por completo si no hay datos —no se imprime un
 * placeholder vacío—, y ninguna función incluye acá el filtrado por
 * estado 'aprobado'/'confirmado'/'activa': ese criterio de negocio vive
 * en la ruta (app/api/pacientes/[id]/documentos/route.ts), que es quien
 * decide qué le puede pasar a estas plantillas.
 */

import { PROFESIONAL, e, fecha, edad } from './documentos-clinicos';
import type { ResumenClinico } from '@/lib/clinica/cuestionario';

export const TIPOS_INFORME = [
  'informe_clinico_completo',
  'resumen_diagnostico',
  'plan_terapeutico',
  'receta_ortomolecular',
  'plan_nutricional',
  'informe_integrado',
] as const;
export type TipoInforme = (typeof TIPOS_INFORME)[number];

export const ETIQUETA_TIPO_INFORME: Record<TipoInforme, string> = {
  informe_clinico_completo: 'Informe clínico completo',
  resumen_diagnostico: 'Resumen diagnóstico funcional',
  plan_terapeutico: 'Plan terapéutico',
  receta_ortomolecular: 'Receta ortomolecular',
  plan_nutricional: 'Plan nutricional',
  informe_integrado: 'Informe integrado completo',
};

export type PacienteInforme = {
  nombre: string;
  apellido?: string | null;
  documento?: string | null;
  fechaNacimiento?: string | null;
  sexo?: string | null;
  telefono?: string | null;
  motivoConsulta?: string | null;
};

export type PatronResumen = { nombre: string; nivel: string; prioridad: string };

export type DiagnosticoInforme = {
  patrones: PatronResumen[];
  impresion: string;
  estudios: string;
} | null;

export type FaseResumen = {
  nombre: string;
  objetivo: string;
  estado: string;
  prioridad: string;
  duracionEstimadaSemanas: number;
  observacionesMedico: string;
};
export type PlanTerapeuticoInforme = { fases: FaseResumen[] } | null;

export type ItemFormulacion = {
  nombre: string;
  dosis: string;
  presentacion?: string;
  cantidad?: string;
  indicacion: string;
  observaciones?: string;
};
export type IngredienteResumen = {
  nombre: string;
  dosisPorTomaMg: number;
  vecesPorDia: number;
  horario: string;
};
export type FormulacionInforme = {
  fase: string;
  objetivos: string[];
  items: ItemFormulacion[];
  ingredientes: IngredienteResumen[];
  firmadaEn: string | null;
  versionReglas: string | null;
} | null;

export type NutricionInforme = {
  objetivoClinico: string;
  calculos: {
    objetivoCaloricoKcal?: number;
    proteinaG?: number;
    carbohidratosG?: number;
    grasasG?: number;
    fibraG?: number;
    aguaMl?: number;
  };
  plan: {
    numeroComidas: number;
    menuDiario: Array<{ horario: string; descripcion: string; alternativas: string[] }>;
    alimentosRecomendados: string[];
    alimentosALimitar: string[];
    alimentosAEvitar: string[];
    listaCompras: string[];
    observaciones: string;
    duracionDias: number;
  };
  restricciones: {
    alergiasAlimentarias: string[];
    celiaquia: boolean;
    vegetarianismo: boolean;
    veganismo: boolean;
  };
  advertencias: string[];
} | null;

export type HistoriaInforme = {
  resumenCuestionario: ResumenClinico | null;
  camposNarrativos: Array<{ etiqueta: string; valor: string }>;
} | null;

export type ContextoInforme = {
  paciente: PacienteInforme;
  historia?: HistoriaInforme;
  diagnostico?: DiagnosticoInforme;
  planTerapeutico?: PlanTerapeuticoInforme;
  formulacion?: FormulacionInforme;
  nutricion?: NutricionInforme;
  generadoEn: string;
  version: number;
};

const CSS = `<style>
  * { box-sizing: border-box; }
  body { margin: 0; color: #32251d; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.45; }
  h1,h2,h3 { font-family: Georgia, serif; font-weight: 400; color: #241812; }
  h1 { font-size: 22px; margin: 3px 0 10px; } h2 { font-size: 14.5px; margin: 18px 0 7px; } h3 { font-size: 12.5px; margin: 12px 0 5px; }
  .marca { color: #a27d2f; font-size: 9px; font-weight: 700; letter-spacing: .17em; text-transform: uppercase; }
  .cabecera { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid #d9cfb8; padding-bottom: 10px; }
  .datos { color: #6b5544; font-size: 10px; text-align: right; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 22px; margin: 12px 0; padding: 10px; background: #faf8f2; break-inside: avoid; }
  .seccion { break-inside: avoid-page; }
  .seccion-nueva { break-before: page; }
  .bloque { break-inside: avoid; border-bottom: 1px solid #e6dfce; padding: 8px 0; }
  .fila { display: flex; justify-content: space-between; gap: 16px; }
  .dosis { font-weight: 700; white-space: nowrap; }
  .suave { color: #746253; } .nota { color: #806d5b; font-size: 9.5px; margin-top: 3px; }
  ul { margin: 5px 0 0 18px; padding: 0; } li { margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; break-inside: avoid; }
  th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #e6dfce; font-size: 10.5px; vertical-align: top; }
  th { color: #6b5544; font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; }
  .alerta { margin-top: 14px; padding: 9px 11px; border-left: 3px solid #a27d2f; background: #faf8f2; break-inside: avoid; }
  .firma { margin-top: 30px; width: 270px; border-top: 1px solid #32251d; padding-top: 6px; break-inside: avoid; }
  .confidencial { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e6dfce; color: #8c7968; font-size: 8.5px; break-inside: avoid; }
  .vacio { color: #9a8672; font-style: italic; }
</style>`;

function nombrePaciente(p: PacienteInforme) {
  return [p.nombre, p.apellido].filter(Boolean).join(' ');
}

function cabecera(titulo: string) {
  return `<div class="cabecera"><div><div class="marca">Método BioHealth®</div><h1>${e(titulo)}</h1></div><div class="datos"><b>${e(PROFESIONAL.consultorio)}</b><br>${e(PROFESIONAL.direccion)}<br>${e(PROFESIONAL.telefono)}</div></div>`;
}

function metaPaciente(p: PacienteInforme, generadoEn: string) {
  return `<div class="meta">
    <div><b>Paciente:</b> ${e(nombrePaciente(p))}</div>
    <div><b>Fecha de emisión:</b> ${fecha(generadoEn)}</div>
    <div><b>Documento:</b> ${e(p.documento || '—')}</div>
    <div><b>Edad:</b> ${edad(p.fechaNacimiento)} · ${e(p.sexo || '—')}</div>
  </div>`;
}

function firma(version: number) {
  return `<div class="firma"><b>${e(PROFESIONAL.nombre)}</b><br>${e(PROFESIONAL.especialidad)}<br>Registro profesional: ${e(PROFESIONAL.registro)}</div>
  <div class="confidencial">Documento confidencial de uso clínico · versión ${version} · generado por Método BioHealth®. Contiene datos de salud protegidos: no compartir fuera del ámbito de atención del paciente.</div>`;
}

function seccionHistoria(h: HistoriaInforme, conSaltoDePagina = false): string {
  if (!h) return '';
  const tieneNarrativos = h.camposNarrativos.length > 0;
  const tieneCuestionario = h.resumenCuestionario && h.resumenCuestionario.sistemas.some(s => s.maximo > 0);
  if (!tieneNarrativos && !tieneCuestionario) return '';

  let html = `<div class="seccion${conSaltoDePagina ? ' seccion-nueva' : ''}"><h2>Historia clínica y cuestionario funcional</h2>`;
  if (tieneNarrativos) {
    html += h.camposNarrativos.map(c => `<p><b>${e(c.etiqueta)}:</b> ${e(c.valor)}</p>`).join('');
  }
  if (tieneCuestionario && h.resumenCuestionario) {
    const sistemas = h.resumenCuestionario.sistemas.filter(s => s.maximo > 0);
    html += `<h3>Principales hallazgos por sistema</h3><table><thead><tr><th>Sistema</th><th>Severidad</th><th>Puntaje</th></tr></thead><tbody>
      ${sistemas.map(s => `<tr><td>${e(s.sistema)}</td><td>${e(s.severidad)}</td><td>${s.porcentaje}%</td></tr>`).join('')}
    </tbody></table>`;
    if (h.resumenCuestionario.topSintomas.length > 0) {
      html += `<h3>Síntomas destacados</h3><ul>${h.resumenCuestionario.topSintomas.map(s => `<li>${e(s.texto)} (${e(s.sistema)})</li>`).join('')}</ul>`;
    }
  }
  html += `</div>`;
  return html;
}

function seccionDiagnostico(d: DiagnosticoInforme, conSaltoDePagina = false): string {
  if (!d) return '';
  const tienePatrones = d.patrones.length > 0;
  const tieneTexto = Boolean(d.impresion.trim() || d.estudios.trim());
  if (!tienePatrones && !tieneTexto) return '';

  let html = `<div class="seccion${conSaltoDePagina ? ' seccion-nueva' : ''}"><h2>Diagnóstico funcional confirmado</h2>`;
  if (tienePatrones) {
    html += `<h3>Patrones funcionales confirmados</h3><table><thead><tr><th>Patrón</th><th>Nivel</th><th>Prioridad terapéutica</th></tr></thead><tbody>
      ${d.patrones.map(p => `<tr><td>${e(p.nombre)}</td><td>${e(p.nivel)}</td><td>${e(p.prioridad)}</td></tr>`).join('')}
    </tbody></table>`;
  }
  if (d.impresion.trim()) html += `<h3>Impresión diagnóstica</h3><p>${e(d.impresion)}</p>`;
  if (d.estudios.trim()) html += `<h3>Estudios complementarios</h3><p>${e(d.estudios)}</p>`;
  html += `</div>`;
  return html;
}

function seccionPlanTerapeutico(p: PlanTerapeuticoInforme, conSaltoDePagina = false): string {
  if (!p || p.fases.length === 0) return '';
  return `<div class="seccion${conSaltoDePagina ? ' seccion-nueva' : ''}"><h2>Plan terapéutico</h2>
    ${p.fases.map(f => `<div class="bloque">
      <div class="fila"><b>${e(f.nombre)}</b><span class="suave">${e(f.estado)}</span></div>
      <div>${e(f.objetivo)}</div>
      <div class="nota">Prioridad ${e(f.prioridad)} · duración estimada ${f.duracionEstimadaSemanas} semanas</div>
      ${f.observacionesMedico.trim() ? `<div class="nota">${e(f.observacionesMedico)}</div>` : ''}
    </div>`).join('')}
  </div>`;
}

function tablaIngredientes(ingredientes: IngredienteResumen[]): string {
  if (ingredientes.length === 0) return '';
  return `<h3>Horarios (detalle por principio activo)</h3><table><thead><tr><th>Principio activo</th><th>Dosis por toma</th><th>Veces al día</th><th>Horario</th></tr></thead><tbody>
    ${ingredientes.map(i => `<tr><td>${e(i.nombre)}</td><td>${i.dosisPorTomaMg} mg</td><td>${i.vecesPorDia}</td><td>${e(i.horario)}</td></tr>`).join('')}
  </tbody></table>`;
}

function seccionFormulacion(f: FormulacionInforme, conSaltoDePagina = false): string {
  if (!f || f.items.length === 0) return '';
  return `<div class="seccion${conSaltoDePagina ? ' seccion-nueva' : ''}"><h2>Formulación ortomolecular aprobada</h2>
    <p class="nota">Fase: ${e(f.fase)} · aprobada ${fecha(f.firmadaEn)} · reglas ${e(f.versionReglas || 'v1.0')}</p>
    ${f.items.map((i, n) => `<div class="bloque"><div class="fila"><b>${n + 1}. ${e(i.nombre)}</b><span class="dosis">${e(i.dosis)}</span></div>
      ${i.presentacion ? `<div><b>Presentación:</b> ${e(i.presentacion)}</div>` : ''}
      ${i.cantidad ? `<div><b>Cantidad total:</b> ${e(i.cantidad)}</div>` : ''}
      <div><b>Indicación:</b> ${e(i.indicacion)}</div>
      ${i.observaciones ? `<div class="nota">${e(i.observaciones)}</div>` : ''}
    </div>`).join('')}
    ${tablaIngredientes(f.ingredientes)}
    <div class="alerta">Formulación individualizada y aprobada por el profesional. No cambie las dosis ni suspenda productos sin indicación médica.</div>
  </div>`;
}

function seccionNutricion(nut: NutricionInforme, conSaltoDePagina = false): string {
  if (!nut) return '';
  return `<div class="seccion${conSaltoDePagina ? ' seccion-nueva' : ''}"><h2>Plan nutricional aprobado</h2>
    <p class="nota">Objetivo: ${e(nut.objetivoClinico)}</p>
    <table><thead><tr><th>Calorías</th><th>Proteína</th><th>Carbohidratos</th><th>Grasas</th><th>Fibra</th><th>Agua</th></tr></thead><tbody>
      <tr>
        <td>${nut.calculos.objetivoCaloricoKcal ?? '—'} kcal</td>
        <td>${nut.calculos.proteinaG ?? '—'} g</td>
        <td>${nut.calculos.carbohidratosG ?? '—'} g</td>
        <td>${nut.calculos.grasasG ?? '—'} g</td>
        <td>${nut.calculos.fibraG ?? '—'} g</td>
        <td>${nut.calculos.aguaMl ?? '—'} ml</td>
      </tr>
    </tbody></table>
    ${nut.plan.menuDiario.length > 0 ? `<h3>Comidas del día (${nut.plan.numeroComidas})</h3><table><thead><tr><th>Horario</th><th>Menú</th><th>Alternativas</th></tr></thead><tbody>
      ${nut.plan.menuDiario.map(m => `<tr><td>${e(m.horario)}</td><td>${e(m.descripcion)}</td><td>${e(m.alternativas.join(', ') || '—')}</td></tr>`).join('')}
    </tbody></table>` : ''}
    ${nut.plan.alimentosRecomendados.length > 0 ? `<h3>Alimentos a priorizar</h3><ul>${nut.plan.alimentosRecomendados.map(a => `<li>${e(a)}</li>`).join('')}</ul>` : ''}
    ${nut.plan.alimentosALimitar.length > 0 ? `<h3>Alimentos a limitar</h3><ul>${nut.plan.alimentosALimitar.map(a => `<li>${e(a)}</li>`).join('')}</ul>` : ''}
    ${nut.plan.alimentosAEvitar.length > 0 ? `<h3>Alimentos a evitar</h3><ul>${nut.plan.alimentosAEvitar.map(a => `<li>${e(a)}</li>`).join('')}</ul>` : ''}
    ${nut.plan.listaCompras.length > 0 ? `<h3>Lista de compras</h3><ul>${nut.plan.listaCompras.map(a => `<li>${e(a)}</li>`).join('')}</ul>` : ''}
    ${(nut.restricciones.alergiasAlimentarias.length > 0 || nut.restricciones.celiaquia || nut.restricciones.vegetarianismo || nut.restricciones.veganismo)
      ? `<h3>Restricciones consideradas</h3><p>${[
          nut.restricciones.celiaquia ? 'Celiaquía' : '',
          nut.restricciones.vegetarianismo ? 'Vegetarianismo' : '',
          nut.restricciones.veganismo ? 'Veganismo' : '',
          ...nut.restricciones.alergiasAlimentarias,
        ].filter(Boolean).map(e2 => e(e2)).join(', ')}</p>` : ''}
    ${nut.plan.observaciones.trim() ? `<h3>Observaciones</h3><p>${e(nut.plan.observaciones)}</p>` : ''}
    ${nut.advertencias.length > 0 ? `<div class="alerta"><b>Advertencias:</b><ul>${nut.advertencias.map(a => `<li>${e(a)}</li>`).join('')}</ul></div>` : ''}
    <p class="nota">Duración sugerida: ${nut.plan.duracionDias} días. No modifique el plan por fuera de la consulta profesional.</p>
  </div>`;
}

function envolver(titulo: string, cuerpo: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${e(titulo)}</title>${CSS}</head><body>${cuerpo}</body></html>`;
}

/** Tipo 1: historia clínica + cuestionario + diagnóstico confirmado (sin plan/formulación/nutrición). */
export function informeClinicoCompleto(ctx: ContextoInforme): string {
  const cuerpo = `${cabecera('Informe clínico completo')}${metaPaciente(ctx.paciente, ctx.generadoEn)}
    ${ctx.paciente.motivoConsulta ? `<p><b>Motivo de consulta:</b> ${e(ctx.paciente.motivoConsulta)}</p>` : ''}
    ${seccionHistoria(ctx.historia ?? null)}
    ${seccionDiagnostico(ctx.diagnostico ?? null)}
    ${firma(ctx.version)}`;
  return envolver('Informe clínico completo', cuerpo);
}

/** Tipo 2: sólo diagnóstico funcional confirmado. */
export function resumenDiagnosticoFuncional(ctx: ContextoInforme): string {
  const cuerpo = `${cabecera('Resumen diagnóstico funcional')}${metaPaciente(ctx.paciente, ctx.generadoEn)}
    ${seccionDiagnostico(ctx.diagnostico ?? null)}
    ${firma(ctx.version)}`;
  return envolver('Resumen diagnóstico funcional', cuerpo);
}

/** Tipo 3: sólo fases del plan terapéutico activas/aprobadas. */
export function informePlanTerapeutico(ctx: ContextoInforme): string {
  const cuerpo = `${cabecera('Plan terapéutico')}${metaPaciente(ctx.paciente, ctx.generadoEn)}
    ${seccionPlanTerapeutico(ctx.planTerapeutico ?? null)}
    ${firma(ctx.version)}`;
  return envolver('Plan terapéutico', cuerpo);
}

/** Tipo 4: receta ortomolecular — usa exactamente la formulación aprobada, sin recalcular dosis. */
export function recetaOrtomolecular(ctx: ContextoInforme): string {
  const cuerpo = `${cabecera('Receta ortomolecular')}${metaPaciente(ctx.paciente, ctx.generadoEn)}
    ${seccionFormulacion(ctx.formulacion ?? null)}
    <p class="nota">Preparar y dispensar conforme a la composición y posología indicadas. Ante cualquier duda, confirmar con el profesional.</p>
    ${firma(ctx.version)}`;
  return envolver('Receta ortomolecular', cuerpo);
}

/** Tipo 5: sólo plan nutricional aprobado. */
export function informePlanNutricional(ctx: ContextoInforme): string {
  const cuerpo = `${cabecera('Plan nutricional')}${metaPaciente(ctx.paciente, ctx.generadoEn)}
    ${seccionNutricion(ctx.nutricion ?? null)}
    ${firma(ctx.version)}`;
  return envolver('Plan nutricional', cuerpo);
}

/** Tipo 6: todo lo aprobado, combinado, con salto de página entre secciones mayores. */
export function informeIntegrado(ctx: ContextoInforme): string {
  const secciones = [
    ctx.paciente.motivoConsulta ? `<p><b>Motivo de consulta:</b> ${e(ctx.paciente.motivoConsulta)}</p>` : '',
    seccionHistoria(ctx.historia ?? null),
    seccionDiagnostico(ctx.diagnostico ?? null, true),
    seccionPlanTerapeutico(ctx.planTerapeutico ?? null, true),
    seccionFormulacion(ctx.formulacion ?? null, true),
    seccionNutricion(ctx.nutricion ?? null, true),
  ].filter(Boolean);

  const cuerpo = `${cabecera('Informe integrado completo')}${metaPaciente(ctx.paciente, ctx.generadoEn)}
    ${secciones.join('')}
    ${firma(ctx.version)}`;
  return envolver('Informe integrado completo', cuerpo);
}

const GENERADORES: Record<TipoInforme, (ctx: ContextoInforme) => string> = {
  informe_clinico_completo: informeClinicoCompleto,
  resumen_diagnostico: resumenDiagnosticoFuncional,
  plan_terapeutico: informePlanTerapeutico,
  receta_ortomolecular: recetaOrtomolecular,
  plan_nutricional: informePlanNutricional,
  informe_integrado: informeIntegrado,
};

export function generarInformeHtml(tipo: TipoInforme, ctx: ContextoInforme): string {
  return GENERADORES[tipo](ctx);
}

/**
 * ¿Hay al menos un dato aprobado/confirmado para este tipo de informe?
 * La ruta usa esto para devolver 422 antes de gastar un render de
 * Puppeteer en un documento que saldría prácticamente vacío.
 */
export function tieneContenido(tipo: TipoInforme, ctx: ContextoInforme): boolean {
  switch (tipo) {
    case 'informe_clinico_completo':
      return Boolean(
        ctx.paciente.motivoConsulta?.trim() ||
        (ctx.historia && (ctx.historia.camposNarrativos.length > 0 || ctx.historia.resumenCuestionario?.sistemas.some(s => s.maximo > 0))) ||
        (ctx.diagnostico && (ctx.diagnostico.patrones.length > 0 || ctx.diagnostico.impresion.trim() || ctx.diagnostico.estudios.trim()))
      );
    case 'resumen_diagnostico':
      return Boolean(ctx.diagnostico && (ctx.diagnostico.patrones.length > 0 || ctx.diagnostico.impresion.trim() || ctx.diagnostico.estudios.trim()));
    case 'plan_terapeutico':
      return Boolean(ctx.planTerapeutico && ctx.planTerapeutico.fases.length > 0);
    case 'receta_ortomolecular':
      return Boolean(ctx.formulacion && ctx.formulacion.items.length > 0);
    case 'plan_nutricional':
      return Boolean(ctx.nutricion);
    case 'informe_integrado':
      return (
        tieneContenido('informe_clinico_completo', ctx) ||
        tieneContenido('plan_terapeutico', ctx) ||
        tieneContenido('receta_ortomolecular', ctx) ||
        tieneContenido('plan_nutricional', ctx)
      );
  }
}

/** BioHealth_Apellido_Nombre_TipoDocumento_YYYY-MM-DD.pdf, sin acentos, espacios ni caracteres especiales. */
export function nombreArchivoConEtiqueta(paciente: PacienteInforme, etiquetaTipo: string, fechaEmision: string): string {
  const normalizar = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const apellido = normalizar(paciente.apellido || 'SinApellido');
  const nombre = normalizar(paciente.nombre || 'SinNombre');
  const tipoDoc = normalizar(etiquetaTipo);
  const fechaIso = new Date(fechaEmision).toISOString().slice(0, 10);
  return `BioHealth_${apellido}_${nombre}_${tipoDoc}_${fechaIso}.pdf`;
}

export function nombreArchivo(paciente: PacienteInforme, tipo: TipoInforme, fechaEmision: string): string {
  return nombreArchivoConEtiqueta(paciente, ETIQUETA_TIPO_INFORME[tipo], fechaEmision);
}

/** Pie de página con numeración nativa de Chromium (pageNumber/totalPages) y aviso de confidencialidad. */
export function piePaginaHtml(): string {
  return `<div style="font-size:8px;width:100%;padding:0 17mm;color:#8c7968;display:flex;justify-content:space-between;font-family:Arial,sans-serif;">
    <span>BioHealth Medicina Avanzada · Documento confidencial</span>
    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>`;
}
