/**
 * lib/clinica/explicacionClinica.ts
 *
 * Traduce a texto legible los datos que el MIF y el MPI YA calcularon
 * para cada principio seleccionado — no calcula nada clínico nuevo,
 * es un formateador puro sobre `PrincipioSeleccionMPI`.
 *
 * Nota sobre "evidencia": `PrincipioSeleccionMPI` no trae el nivel de
 * evidencia (A-D) como campo propio — ese dato vive en
 * `evidencia_cientifica` y todavía no llega a esta capa (agregar esa
 * lectura queda para una etapa posterior, no forma parte del alcance
 * aprobado de esta etapa). Lo que SÍ ya reutiliza esta función es la
 * `prioridad` del candidato — que para los principios sugeridos desde
 * el catálogo heredado (`disponibleEnBaseValidada === false`) el
 * propio MPI ya deriva de su nivel de evidencia (ver
 * `prioridadDesdeEvidenciaLegacy` en lib/clinica/mpi.ts) — y la marca
 * `disponibleEnBaseValidada`, que indica si el respaldo es una
 * indicación validada de la Base de Conocimiento Clínica o no.
 */

import type { PrincipioSeleccionMPI } from './mpi';

export type ExplicacionClinicaPrincipio = {
  nombre: string;
  objetivos: string[];
  motivoSeleccion: string;
  motivoDosis: string;
  motivoPresentacion: string;
  motivoSabor: string;
  advertenciasRelevantes: PrincipioSeleccionMPI['advertencias'];
};

function construirMotivoSeleccion(c: PrincipioSeleccionMPI): string {
  const rol = c.esObjetivoPrincipal ? 'objetivo principal' : 'objetivo secundario';
  const origenDato = c.disponibleEnBaseValidada
    ? 'con respaldo validado en la Base de Conocimiento Clínica'
    : 'sugerido desde el catálogo heredado del motor de formulación, sin indicación validada específica todavía';
  return `Seleccionado para ${rol} "${c.objetivos.join(', ')}", prioridad ${c.prioridad}, ${origenDato}.`;
}

function construirMotivoDosis(c: PrincipioSeleccionMPI): string {
  if (!c.dosisElegida) return 'Sin dosis validada disponible: requiere que el médico la defina manualmente antes de firmar.';
  const fuente = c.fuenteDosis === 'usual' ? 'dosis usual' : 'dosis mínima (no había dosis usual cargada)';
  return `Dosis elegida: ${c.dosisElegida.valor} ${c.dosisElegida.unidad} (${fuente}).`;
}

/** Una explicación por cada principio ya seleccionado por el MPI (ninguna para los excluidos: no forman parte de la receta). */
export function explicarClinicamente(c: PrincipioSeleccionMPI): ExplicacionClinicaPrincipio {
  return {
    nombre: c.nombre,
    objetivos: c.objetivos,
    motivoSeleccion: construirMotivoSeleccion(c),
    motivoDosis: construirMotivoDosis(c),
    motivoPresentacion: c.decisionPresentacion?.motivo ?? 'Sin datos suficientes para calcular la presentación automáticamente.',
    motivoSabor: c.decisionSabor?.motivo ?? 'Sin datos suficientes para sugerir un sabor automáticamente.',
    advertenciasRelevantes: c.advertencias,
  };
}

export function explicarProtocolo(seleccionados: PrincipioSeleccionMPI[]): ExplicacionClinicaPrincipio[] {
  return seleccionados.map(explicarClinicamente);
}
