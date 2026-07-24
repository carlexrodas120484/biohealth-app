import type { Fase } from '@/lib/algoritmo/fases';
import type { NivelJerarquico, BandaPrioridad } from '@/lib/algoritmo/ipt';

export type { Fase, NivelJerarquico, BandaPrioridad };

export interface Paciente {
  id: string;
  tenantId: string;
  nombre: string;
  apellido: string | null;
  documento: string | null;
  fechaNacimiento: string | null; // ISO date (YYYY-MM-DD)
  sexo: 'femenino' | 'masculino';
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  ciudad: string | null;
  ocupacion: string | null;
  motivoConsulta: string | null;
  antecedentesPersonales: string | null;
  antecedentesFamiliares: string | null;
  medicamentosActuales: string | null;
  alergias: string | null;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
  /** @deprecated calculada automáticamente desde fechaNacimiento; se mantiene por compatibilidad con lib/pdf */
  edad: number;
  /** @deprecated alias legacy de `documento`; se mantiene por compatibilidad con lib/pdf */
  ci: string;
}

export interface Consulta {
  id: string;
  tenantId: string;
  pacienteId: string;
  medicoId: string;
  pasoActual: number; // 1-10
  motivoConsulta: string;
  versionReglas: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sintoma {
  id: string;
  consultaId: string;
  nombre: string;
  intensidad: number; // 0-100
}

export interface HallazgoEscaneo {
  id: string;
  consultaId: string;
  parametro: string;
  severidad: 'ok' | 'med' | 'alto';
  archivoUrl: string | null;
}

export interface Alteracion {
  id: string;
  consultaId: string;
  nombre: string;
  dominio: string;
  nivel: NivelJerarquico;
  ic: number;
  is_: number;
  rv: number;
  ev: number;
  cb: number;
  perpetuador: boolean;
  iptCalculado: number | null;
}

export interface ActivoBiblioteca {
  id: string;
  tenantId: string;
  version: number;
  nombre: string;
  familia: string;
  fase: Fase;
  objetivo: string;
  mecanismo: string;
  dosis: string;
  dosisMax: string;
  evidencia: number; // 1-5
  contraindicaciones: string;
  interacciones: string;
  referencias: number;
  vigente: boolean;
}

export interface Formula {
  id: string;
  consultaId: string;
  firmada: boolean;
  firmadaPor: string | null;
  firmadaEn: string | null;
  versionReglas: string;
  items: { activoId: string; nombre: string; dosisIndicada: string }[];
}

export interface FaseAsignacion {
  id: string;
  consultaId: string;
  fase: Fase;
  sugeridaPorSistema: boolean;
  confirmada: boolean;
  motivoAnulacion: string | null;
}
