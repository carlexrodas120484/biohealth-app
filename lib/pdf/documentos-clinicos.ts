import { FASES, type Fase } from '@/lib/algoritmo/fases';

export type TipoDocumentoClinico = 'receta_botica' | 'informe_medico' | 'informe_paciente';

type PacienteDocumento = {
  nombre: string;
  apellido?: string | null;
  documento?: string | null;
  fecha_nacimiento?: string | null;
  sexo?: string | null;
  telefono?: string | null;
  motivo_consulta?: string | null;
  antecedentes_personales?: string | null;
  medicamentos_actuales?: string | null;
  alergias?: string | null;
};

type ItemDocumento = {
  nombre: string;
  dosis: string;
  presentacion?: string;
  cantidad?: string;
  indicacion: string;
  observaciones?: string;
  evidencia?: string;
  fuente?: string;
};

type FormulacionDocumento = {
  id: string;
  fase: Fase;
  objetivos: string[];
  items: ItemDocumento[];
  revision_clinica?: {
    pesoKg?: string;
    embarazoLactancia?: string;
    funcionRenal?: string;
    funcionHepatica?: string;
    laboratorios?: string;
  } | null;
  firmada_en?: string | null;
  version_reglas?: string | null;
};

export const PROFESIONAL = {
  nombre: process.env.MEDICO_NOMBRE ?? 'Dr. Carlos Rubén Rodas Palacios',
  registro: process.env.MEDICO_REGISTRO ?? '12.930',
  especialidad: process.env.MEDICO_ESPECIALIDAD ?? 'Medicina Familiar y Medicina Ortomolecular',
  consultorio: process.env.CONSULTORIO_NOMBRE ?? 'BioHealth Medicina Avanzada',
  direccion: process.env.CONSULTORIO_DIRECCION ?? 'Ayolas, Misiones',
  telefono: process.env.CONSULTORIO_TELEFONO ?? '0973 913 205',
};

const CSS = `<style>
  @page { size: A4; margin: 16mm 17mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #32251d; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.45; }
  h1,h2 { font-family: Georgia, serif; font-weight: 400; color: #241812; }
  h1 { font-size: 24px; margin: 3px 0 12px; } h2 { font-size: 15px; margin: 18px 0 7px; }
  .marca { color: #a27d2f; font-size: 9px; font-weight: 700; letter-spacing: .17em; text-transform: uppercase; }
  .cabecera { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid #d9cfb8; padding-bottom: 12px; }
  .datos { color: #6b5544; font-size: 10px; text-align: right; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 22px; margin: 14px 0; padding: 10px; background: #faf8f2; }
  .bloque { break-inside: avoid; border-bottom: 1px solid #e6dfce; padding: 9px 0; }
  .fila { display: flex; justify-content: space-between; gap: 16px; }
  .dosis { font-weight: 700; white-space: nowrap; }
  .suave { color: #746253; } .nota { color: #806d5b; font-size: 9.5px; margin-top: 3px; }
  ul { margin: 5px 0 0 18px; padding: 0; } li { margin: 3px 0; }
  .alerta { margin-top: 16px; padding: 9px 11px; border-left: 3px solid #a27d2f; background: #faf8f2; }
  .firma { margin-top: 34px; width: 270px; border-top: 1px solid #32251d; padding-top: 6px; }
  footer { margin-top: 24px; color: #8c7968; font-size: 8.5px; }
</style>`;

export function e(valor: unknown) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function nombrePaciente(p: PacienteDocumento) { return [p.nombre, p.apellido].filter(Boolean).join(' '); }
export function fecha(valor?: string | null) { return valor ? new Date(valor).toLocaleDateString('es-PY') : '—'; }
export function edad(fechaNacimiento?: string | null) {
  if (!fechaNacimiento) return '—';
  const n = new Date(fechaNacimiento); const h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--;
  return `${a} años`;
}
function cabecera(titulo: string) {
  return `<div class="cabecera"><div><div class="marca">Método BioHealth®</div><h1>${e(titulo)}</h1></div><div class="datos"><b>${e(PROFESIONAL.consultorio)}</b><br>${e(PROFESIONAL.direccion)}<br>${e(PROFESIONAL.telefono)}</div></div>`;
}
function meta(p: PacienteDocumento, f: FormulacionDocumento) {
  return `<div class="meta"><div><b>Paciente:</b> ${e(nombrePaciente(p))}</div><div><b>Fecha:</b> ${fecha(f.firmada_en)}</div><div><b>Documento:</b> ${e(p.documento || '—')}</div><div><b>Edad:</b> ${edad(p.fecha_nacimiento)}</div></div>`;
}
function firma(f: FormulacionDocumento) {
  return `<div class="firma"><b>${e(PROFESIONAL.nombre)}</b><br>${e(PROFESIONAL.especialidad)}<br>Registro profesional: ${e(PROFESIONAL.registro)}</div><footer>Documento ${e(f.id)} · formulación firmada ${fecha(f.firmada_en)} · reglas ${e(f.version_reglas || 'v1.0')}</footer>`;
}

export function recetaBotica(p: PacienteDocumento, f: FormulacionDocumento) {
  return `<!doctype html><html><head><meta charset="utf-8">${CSS}</head><body>${cabecera('Receta para botica')}${meta(p, f)}
  <h2>Preparación magistral</h2>${f.items.map((i, n) => `<div class="bloque"><div class="fila"><b>${n + 1}. ${e(i.nombre)}</b><span class="dosis">${e(i.dosis)}</span></div>${i.presentacion ? `<div><b>Presentación/vehículo:</b> ${e(i.presentacion)}</div>` : ''}${i.cantidad ? `<div><b>Cantidad a preparar:</b> ${e(i.cantidad)}</div>` : ''}<div><b>Posología:</b> ${e(i.indicacion)}</div>${i.observaciones ? `<div class="nota">Indicaciones de elaboración/precauciones: ${e(i.observaciones)}</div>` : ''}</div>`).join('')}
  <div class="alerta">Preparar y dispensar conforme a la composición y posología indicadas. Confirmar con el profesional cualquier incompatibilidad, imposibilidad técnica o sustitución propuesta.</div>${firma(f)}</body></html>`;
}

export function informeMedico(p: PacienteDocumento, f: FormulacionDocumento) {
  const r = f.revision_clinica ?? {};
  return `<!doctype html><html><head><meta charset="utf-8">${CSS}</head><body>${cabecera('Informe médico')}${meta(p, f)}
  <h2>Contexto clínico</h2><p><b>Motivo de consulta:</b> ${e(p.motivo_consulta || 'No registrado')}</p><p><b>Antecedentes:</b> ${e(p.antecedentes_personales || 'No registrados')}</p><p><b>Medicación actual:</b> ${e(p.medicamentos_actuales || 'No registrada')}</p><p><b>Alergias:</b> ${e(p.alergias || 'No registradas')}</p>
  <h2>Valoración terapéutica</h2><p><b>Fase:</b> ${e(FASES[f.fase]?.nombre ?? f.fase)}</p><p><b>Objetivos:</b> ${e(f.objetivos.join(', '))}</p>
  <p><b>Contexto de dosificación:</b> peso ${e(r.pesoKg || '—')} kg; embarazo/lactancia ${e(r.embarazoLactancia || '—')}; función renal ${e(r.funcionRenal || '—')}; función hepática ${e(r.funcionHepatica || '—')}.</p><p><b>Laboratorios relevantes:</b> ${e(r.laboratorios || 'No registrados')}</p>
  <h2>Formulación</h2>${f.items.map(i => `<div class="bloque"><div class="fila"><b>${e(i.nombre)}</b><span class="dosis">${e(i.dosis)}</span></div><div>${e(i.indicacion)}</div>${i.observaciones ? `<div class="nota">${e(i.observaciones)}</div>` : ''}<div class="nota">Evidencia ${e(i.evidencia || 'sin clasificar')} · Fuente: ${e(i.fuente || 'no registrada')}</div></div>`).join('')}
  <div class="alerta">La formulación fue individualizada y firmada por el profesional. Este documento registra la decisión clínica; no constituye una recomendación automática del sistema.</div>${firma(f)}</body></html>`;
}

export function informePaciente(p: PacienteDocumento, f: FormulacionDocumento) {
  const primerNombre = p.nombre.split(' ')[0];
  return `<!doctype html><html><head><meta charset="utf-8">${CSS}</head><body>${cabecera('Indicaciones para el paciente')}${meta(p, f)}
  <p>Hola ${e(primerNombre)}. Estas son las indicaciones confirmadas por tu médico para esta etapa.</p><h2>Qué debes usar</h2>
  ${f.items.map((i, n) => `<div class="bloque"><div class="fila"><b>${n + 1}. ${e(i.nombre)}</b><span class="dosis">${e(i.dosis)}</span></div><div>${e(i.indicacion)}</div>${i.observaciones ? `<div class="nota">Importante: ${e(i.observaciones)}</div>` : ''}</div>`).join('')}
  <h2>Objetivos de esta etapa</h2><ul>${f.objetivos.map(o => `<li>${e(o)}</li>`).join('')}</ul>
  <div class="alerta">No cambies las dosis ni suspendas productos por tu cuenta. Si presentas una reacción inesperada, empeoramiento o una urgencia, suspende el producto sospechoso y busca atención médica.</div>
  <p class="suave" style="margin-top:16px">Para consultas: ${e(PROFESIONAL.telefono)} · Lleva este documento a tu próximo control.</p>${firma(f)}</body></html>`;
}
