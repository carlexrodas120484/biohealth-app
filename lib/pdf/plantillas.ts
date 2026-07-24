/**
 * lib/pdf/plantillas.ts
 *
 * Plantillas HTML para los dos entregables de la consulta. El contenido
 * y la estructura de datos son los mismos que se validaron con jsPDF en
 * el prototipo (formula_<paciente>.pdf y plan_<paciente>.pdf); lo que
 * cambia es que ahora se maquetan con HTML/CSS real —lo que permite
 * membrete, tipografía de marca y layout más rico— y se renderizan en
 * el servidor a partir de la consulta persistida, no de arrays mock.
 */

import type { Paciente, Formula } from '@/types';
import type { Fase } from '@/lib/algoritmo/fases';
import { FASES } from '@/lib/algoritmo/fases';

const ESTILO_BASE = `
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica', Arial, sans-serif; color: #3A2A1E; padding: 40px 48px; }
    .eyebrow { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #B08D3F; font-weight: 600; }
    h1 { font-family: Georgia, serif; font-size: 26px; font-weight: 400; color: #241812; margin: 4px 0 16px; }
    .meta { font-size: 12px; color: #6B5544; line-height: 1.8; margin-bottom: 20px; }
    hr { border: none; border-top: 1px solid #E6DFCE; margin: 16px 0; }
    h2 { font-size: 14px; font-weight: 600; color: #241812; margin-bottom: 10px; }
    .item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; }
    .item b { font-weight: 600; }
    .nota { font-size: 10px; color: #9A8672; margin-top: 4px; }
    .firma { margin-top: 40px; font-size: 11px; color: #6B5544; }
    .firma .linea { border-top: 1px solid #3A2A1E; width: 220px; margin-bottom: 6px; }
    .footer { margin-top: 24px; font-size: 9px; color: #B08D3F; }
  </style>
`;

export function plantillaFormulaMagistral(paciente: Paciente, fase: Fase, formula: Formula): string {
  const f = FASES[fase];
  return `<!DOCTYPE html><html><head>${ESTILO_BASE}</head><body>
    <div class="eyebrow">Método BioHealth®</div>
    <h1>Fórmula magistral</h1>
    <div class="meta">
      Paciente: ${escapeHtml(paciente.nombre)}<br>
      Edad: ${paciente.edad} · Sexo: ${paciente.sexo} · C.I. ${paciente.ci}<br>
      Fase terapéutica: ${f.nombre}<br>
      Fecha: ${new Date().toLocaleDateString('es-PY')}
    </div>
    <hr>
    <h2>Composición</h2>
    ${formula.items.map(i => `<div class="item"><span>${escapeHtml(i.nombre)}</span><b>${escapeHtml(i.dosisIndicada)}</b></div>`).join('')}
    <p class="nota">Vehículo: cápsula · posología según objetivo de fase indicada al paciente.</p>
    <hr>
    <p class="meta">
      ${formula.firmada
        ? `Firmado electrónicamente · ${formula.firmadaEn} · versión de reglas ${formula.versionReglas}`
        : 'Documento sin firmar — pendiente de validación médica'}
    </p>
    <div class="firma">
      <div class="linea"></div>
      Dr. Carlos Rodas · BioHealth Medicina Avanzada · Ayolas
    </div>
    <div class="footer">Generado por Método BioHealth® · no reemplaza el juicio clínico</div>
  </body></html>`;
}

export function plantillaPlanPaciente(
  paciente: Paciente,
  fase: Fase,
  formula: Formula,
  priorizar: string,
  evitar: string
): string {
  const f = FASES[fase];
  const primerNombre = paciente.nombre.split(' ')[0];
  return `<!DOCTYPE html><html><head>${ESTILO_BASE}</head><body>
    <div class="eyebrow">Método BioHealth®</div>
    <h1>Tu plan de esta fase</h1>
    <p class="meta">Hola ${escapeHtml(primerNombre)}, estás en la fase ${f.nombre}.</p>
    <hr>
    <h2>Qué tomar</h2>
    ${formula.items.length
      ? formula.items.map(i => `<div class="item"><span>${escapeHtml(i.nombre)}</span><b>${escapeHtml(i.dosisIndicada)}</b></div>`).join('')
      : `<p class="meta">A definir en la próxima consulta.</p>`}
    <h2 style="margin-top:16px">Qué priorizar en tu alimentación</h2>
    <p class="meta">${escapeHtml(priorizar)}</p>
    <h2>Qué evitar</h2>
    <p class="meta">${escapeHtml(evitar)}</p>
    <hr>
    <p class="meta">
      Próximo control sugerido: en ${f.semanasMinimas || 4} semanas.<br>
      Cualquier duda, escribinos por WhatsApp: 0973 913 205
    </p>
    <div class="footer">Generado por Método BioHealth®</div>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
