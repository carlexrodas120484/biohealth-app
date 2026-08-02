'use client';

import { useEffect, useState } from 'react';
import { TarjetaDashboard } from './TarjetaDashboard';
import { EtiquetaSemaforo, type Semaforo } from './Semaforo';
import { GraficoTendencia } from './GraficoTendencia';

type Indicador = { codigo: string; nombre: string; valor: number | null; unidad: string; semaforo: Semaforo; explicacion: string; rangoReferencia: string };
type EstadoSistema = { semaforo: Semaforo; explicacion: string; indicadoresConsiderados: string[] };
type Problema = { prioridad: number; codigo: string; titulo: string; severidad: Semaforo; porQue: string; recomendacion: string };
type Alerta = { codigo: string; severidad: Semaforo; titulo: string; explicacion: string; origen: string };
type PatronConfirmado = { codigo: string; nombre: string; nivel: string; prioridad: string; puntaje: number };
type PuntoSerie = { fecha: string; valor: number };

type DashboardPayload = {
  paciente: { nombre: string; apellido: string | null; edad: number | null; sexo: string | null; motivoConsulta: string | null; observaciones: string | null };
  alertas: Alerta[];
  problemasPriorizados: Problema[];
  diagnostico: { confirmado: boolean; impresion: string; patronesConfirmados: PatronConfirmado[] };
  riesgoCardiovascular: EstadoSistema;
  riesgoMetabolico: EstadoSistema;
  inflamacion: EstadoSistema;
  estadoIntestinal: EstadoSistema;
  estadoHormonal: EstadoSistema;
  estadoMitocondrial: EstadoSistema;
  evolucionClinica: Array<{ fecha: string; fase: string; cicloNum: number; reduccionIptPct: number; mejoriaObjetivosPct: number; adherenciaPct: number; decision: string }>;
  laboratorios: { indicadoresActuales: Indicador[]; series: Record<string, PuntoSerie[]>; ultimaFecha: string | null };
  formulacionActiva: { estado: string; fase: string | null; cantidadItems: number; firmadaEn: string | null } | null;
  nutricionActiva: { estado: string; objetivoClinico: string | null; aprobadoEn: string | null } | null;
  proximoControl: { fecha: string; semanas: number } | null;
  recordatorios: string[];
  estadoTratamiento: { faseSeleccionada: string | null; faseConfirmada: boolean; fasesActivas: number; fasesTotal: number; formulacionEstado: string | null; nutricionEstado: string | null };
};

const GRAFICOS: Array<{ campo: string; codigoIndicador: string; nombre: string; unidad: string }> = [
  { campo: 'peso_kg', codigoIndicador: 'peso', nombre: 'Peso', unidad: 'kg' },
  { campo: 'imc', codigoIndicador: 'imc', nombre: 'IMC', unidad: 'kg/m²' },
  { campo: 'cintura_cm', codigoIndicador: 'cintura', nombre: 'Cintura', unidad: 'cm' },
  { campo: 'presion_sistolica', codigoIndicador: 'presion_arterial', nombre: 'Presión sistólica', unidad: 'mmHg' },
  { campo: 'glucemia_mg_dl', codigoIndicador: 'glucemia', nombre: 'Glucemia', unidad: 'mg/dL' },
  { campo: 'hba1c_pct', codigoIndicador: 'hba1c', nombre: 'HbA1c', unidad: '%' },
  { campo: 'trigliceridos_mg_dl', codigoIndicador: 'trigliceridos', nombre: 'Triglicéridos', unidad: 'mg/dL' },
  { campo: 'hdl_mg_dl', codigoIndicador: 'hdl', nombre: 'HDL', unidad: 'mg/dL' },
  { campo: 'ldl_mg_dl', codigoIndicador: 'ldl', nombre: 'LDL', unidad: 'mg/dL' },
  { campo: 'vitamina_d_ng_ml', codigoIndicador: 'vitamina_d', nombre: 'Vitamina D', unidad: 'ng/mL' },
  { campo: 'homa_ir', codigoIndicador: 'homa_ir', nombre: 'HOMA-IR', unidad: '' },
  { campo: 'pcr_mg_l', codigoIndicador: 'pcr', nombre: 'PCR', unidad: 'mg/L' },
  { campo: 'ferritina_ng_ml', codigoIndicador: 'ferritina', nombre: 'Ferritina', unidad: 'ng/mL' },
];

function EstadoSistemaCard({ titulo, estado }: { titulo: string; estado: EstadoSistema }) {
  return (
    <TarjetaDashboard titulo={titulo}>
      <EtiquetaSemaforo semaforo={estado.semaforo} />
      <p className="mt-2 text-[12.5px] text-choco-mid">{estado.explicacion}</p>
    </TarjetaDashboard>
  );
}

export function DashboardClinico({ pacienteId }: { pacienteId: string }) {
  const [datos, setDatos] = useState<DashboardPayload | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCargando(true);
      setError('');
      try {
        const res = await fetch(`/api/pacientes/${pacienteId}/dashboard`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'No se pudo cargar el dashboard.');
        if (!cancelado) setDatos(body);
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No se pudo cargar el dashboard.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [pacienteId]);

  if (cargando) return <p className="text-sm text-choco-soft">Cargando dashboard…</p>;
  if (error) return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</div>;
  if (!datos) return null;

  const nombreCompleto = [datos.paciente.nombre, datos.paciente.apellido].filter(Boolean).join(' ');

  return (
    <div className="space-y-4">
      {/* 1. Resumen general del paciente */}
      <TarjetaDashboard titulo="Resumen general del paciente">
        <p className="font-serif text-2xl text-choco-deep">{nombreCompleto}</p>
        <p className="mt-1 text-[12.5px] text-choco-soft">
          {datos.paciente.edad != null ? `${datos.paciente.edad} años · ` : ''}{datos.paciente.sexo ?? '—'}
        </p>
        {datos.paciente.motivoConsulta && <p className="mt-2 text-[12.5px] text-choco-mid"><b>Motivo de consulta:</b> {datos.paciente.motivoConsulta}</p>}
      </TarjetaDashboard>

      {/* 2. Alertas clínicas (motor interno: prioriza + explica el "por qué") */}
      <TarjetaDashboard titulo={`Alertas clínicas (${datos.problemasPriorizados.length})`}>
        {datos.problemasPriorizados.length === 0 ? (
          <p className="text-[12.5px] text-choco-soft">Sin alertas activas para este paciente.</p>
        ) : (
          <ul className="space-y-2.5">
            {datos.problemasPriorizados.slice(0, 10).map(p => (
              <li key={p.codigo} className="border-t border-linea pt-2.5 first:border-none first:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-choco-deep">#{p.prioridad} · {p.titulo}</span>
                  <EtiquetaSemaforo semaforo={p.severidad} />
                </div>
                <p className="mt-1 text-[12px] text-choco-mid">{p.porQue}</p>
                <p className="mt-0.5 text-[11.5px] text-choco-soft">Sugerencia: {p.recomendacion}</p>
              </li>
            ))}
          </ul>
        )}
      </TarjetaDashboard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 3. Diagnóstico funcional */}
        <TarjetaDashboard titulo="Diagnóstico funcional">
          <EtiquetaSemaforo semaforo={datos.diagnostico.confirmado ? 'verde' : 'amarillo'} texto={datos.diagnostico.confirmado ? 'Confirmado' : 'Pendiente de confirmar'} />
          {datos.diagnostico.impresion && <p className="mt-2 text-[12.5px] text-choco-mid">{datos.diagnostico.impresion}</p>}
        </TarjetaDashboard>

        {/* 4. Patrones confirmados */}
        <TarjetaDashboard titulo={`Patrones confirmados (${datos.diagnostico.patronesConfirmados.length})`}>
          {datos.diagnostico.patronesConfirmados.length === 0 ? (
            <p className="text-[12.5px] text-choco-soft">Sin patrones funcionales confirmados todavía.</p>
          ) : (
            <ul className="space-y-1.5">
              {datos.diagnostico.patronesConfirmados.map(p => (
                <li key={p.codigo} className="flex items-center justify-between text-[12.5px]">
                  <span className="text-choco-deep">{p.nombre}</span>
                  <span className="text-choco-soft">{p.nivel}</span>
                </li>
              ))}
            </ul>
          )}
        </TarjetaDashboard>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* 5-10. Los 6 semáforos de sistema */}
        <EstadoSistemaCard titulo="Riesgo cardiovascular" estado={datos.riesgoCardiovascular} />
        <EstadoSistemaCard titulo="Riesgo metabólico" estado={datos.riesgoMetabolico} />
        <EstadoSistemaCard titulo="Inflamación" estado={datos.inflamacion} />
        <EstadoSistemaCard titulo="Estado intestinal" estado={datos.estadoIntestinal} />
        <EstadoSistemaCard titulo="Estado hormonal" estado={datos.estadoHormonal} />
        <EstadoSistemaCard titulo="Estado mitocondrial" estado={datos.estadoMitocondrial} />
      </div>

      {/* 11. Evolución clínica */}
      <TarjetaDashboard titulo="Evolución clínica">
        {datos.evolucionClinica.length === 0 ? (
          <p className="text-[12.5px] text-choco-soft">Todavía no hay controles registrados para mostrar evolución.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[11px] text-choco-soft">Adherencia por control</p>
              <GraficoTendencia puntos={datos.evolucionClinica.map(c => ({ fecha: c.fecha, valor: c.adherenciaPct }))} unidad="%" rangoMin={0} rangoMax={100} />
            </div>
            <div>
              <p className="mb-1 text-[11px] text-choco-soft">Reducción de IPT por control</p>
              <GraficoTendencia puntos={datos.evolucionClinica.map(c => ({ fecha: c.fecha, valor: c.reduccionIptPct }))} unidad="%" />
            </div>
          </div>
        )}
      </TarjetaDashboard>

      {/* 12. Laboratorios recientes (13 indicadores con semáforo + gráfico) */}
      <TarjetaDashboard titulo={`Laboratorios recientes${datos.laboratorios.ultimaFecha ? ` · último registro ${datos.laboratorios.ultimaFecha}` : ''}`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GRAFICOS.map(g => {
            const indicador = datos.laboratorios.indicadoresActuales.find(i => i.codigo === g.codigoIndicador);
            const serie = datos.laboratorios.series[g.campo] ?? [];
            return (
              <div key={g.campo} className="rounded-md border border-linea p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-choco-deep">{g.nombre}</span>
                  {indicador && <EtiquetaSemaforo semaforo={indicador.semaforo} />}
                </div>
                <GraficoTendencia puntos={serie} unidad={g.unidad} />
                {indicador && indicador.semaforo !== 'sin_datos' && <p className="mt-1 text-[11px] text-choco-soft">{indicador.explicacion}</p>}
              </div>
            );
          })}
        </div>
      </TarjetaDashboard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 13. Formulación activa */}
        <TarjetaDashboard titulo="Formulación activa">
          {datos.formulacionActiva ? (
            <>
              <EtiquetaSemaforo semaforo={datos.formulacionActiva.estado === 'aprobada' ? 'verde' : 'amarillo'} texto={datos.formulacionActiva.estado} />
              <p className="mt-2 text-[12.5px] text-choco-mid">Fase {datos.formulacionActiva.fase ?? '—'} · {datos.formulacionActiva.cantidadItems} componentes</p>
            </>
          ) : (
            <p className="text-[12.5px] text-choco-soft">Sin formulación registrada.</p>
          )}
        </TarjetaDashboard>

        {/* 14. Nutrición activa */}
        <TarjetaDashboard titulo="Nutrición activa">
          {datos.nutricionActiva ? (
            <>
              <EtiquetaSemaforo semaforo={datos.nutricionActiva.estado === 'aprobado' ? 'verde' : 'amarillo'} texto={datos.nutricionActiva.estado} />
              <p className="mt-2 text-[12.5px] text-choco-mid">Objetivo: {datos.nutricionActiva.objetivoClinico ?? '—'}</p>
            </>
          ) : (
            <p className="text-[12.5px] text-choco-soft">Sin plan nutricional registrado.</p>
          )}
        </TarjetaDashboard>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 15. Próximo control */}
        <TarjetaDashboard titulo="Próximo control sugerido">
          {datos.proximoControl ? (
            <p className="text-[13px] text-choco-deep">{datos.proximoControl.fecha} <span className="text-choco-soft">(en {datos.proximoControl.semanas} semanas, según la fase activa)</span></p>
          ) : (
            <p className="text-[12.5px] text-choco-soft">Sin fase activa: no se puede sugerir una fecha de control.</p>
          )}
        </TarjetaDashboard>

        {/* 16. Recordatorios */}
        <TarjetaDashboard titulo={`Recordatorios (${datos.recordatorios.length})`}>
          {datos.recordatorios.length === 0 ? (
            <p className="text-[12.5px] text-choco-soft">Sin pendientes.</p>
          ) : (
            <ul className="space-y-1.5">
              {datos.recordatorios.map((r, i) => (
                <li key={i} className="text-[12.5px] text-choco-mid">• {r}</li>
              ))}
            </ul>
          )}
        </TarjetaDashboard>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 17. Observaciones */}
        <TarjetaDashboard titulo="Observaciones">
          <p className="text-[12.5px] text-choco-mid">{datos.paciente.observaciones?.trim() || 'Sin observaciones registradas.'}</p>
        </TarjetaDashboard>

        {/* 18. Estado del tratamiento */}
        <TarjetaDashboard titulo="Estado del tratamiento">
          <ul className="space-y-1.5 text-[12.5px] text-choco-mid">
            <li>Fase seleccionada: <b className="text-choco-deep">{datos.estadoTratamiento.faseSeleccionada ?? '—'}</b> {datos.estadoTratamiento.faseConfirmada ? '(confirmada)' : '(sin confirmar)'}</li>
            <li>Fases activas del plan: <b className="text-choco-deep">{datos.estadoTratamiento.fasesActivas}</b> de {datos.estadoTratamiento.fasesTotal}</li>
            <li>Formulación: <b className="text-choco-deep">{datos.estadoTratamiento.formulacionEstado ?? 'sin registrar'}</b></li>
            <li>Nutrición: <b className="text-choco-deep">{datos.estadoTratamiento.nutricionEstado ?? 'sin registrar'}</b></li>
          </ul>
        </TarjetaDashboard>
      </div>
    </div>
  );
}
