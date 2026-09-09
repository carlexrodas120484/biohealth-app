'use client';

import { useEffect, useState } from 'react';

type Contexto = {
  medicamentos_actuales?: string | null;
  alergias?: string | null;
  embarazo?: boolean | null;
  lactancia?: boolean | null;
  deterioro_renal?: boolean | null;
  deterioro_hepatico?: boolean | null;
};

type Resolucion = {
  principio_id: string;
  estado_resolucion: 'pendiente' | 'resuelta';
  resolucion_tipo: 'aceptada_justificada' | 'descartada' | null;
  justificacion_resolucion: string | null;
  resuelto_por: string | null;
  resolved_at: string | null;
};

type Alerta = {
  principio_id: string;
  nombre: string;
  nivel: 'permitido' | 'requiere_revision' | 'bloqueado';
  motivo: string;
  datos_disparadores?: {
    coincidencias?: string[];
    clases_detectadas?: string[];
    [key: string]: unknown;
  };
  resolucion?: Resolucion | null;
};

type Respuesta = {
  consultaId: string | null;
  contexto: Contexto | null;
  alertas: Alerta[];
  advertencia: string;
};

type TipoResolucion = 'aceptada_justificada' | 'descartada';

function textoEstado(valor: boolean | null | undefined) {
  if (valor === true) return 'Sí';
  if (valor === false) return 'No';
  return 'Desconocido';
}

function etiquetaResolucion(tipo: TipoResolucion | null | undefined) {
  if (tipo === 'aceptada_justificada') return 'Aceptada con justificación';
  if (tipo === 'descartada') return 'Descartada';
  return 'Pendiente';
}

export function SeguridadContextualPanel({ pacienteId }: { pacienteId: string }) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoResolucion>('aceptada_justificada');
  const [justificacion, setJustificacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  async function recargar() {
    const r = await fetch(`/api/pacientes/${pacienteId}/seguridad-formulacion`, { cache: 'no-store' });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error ?? 'No se pudo verificar la seguridad contextual.');
    setDatos(body);
  }

  useEffect(() => {
    let cancelado = false;
    setCargando(true);

    fetch(`/api/pacientes/${pacienteId}/seguridad-formulacion`, { cache: 'no-store' })
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? 'No se pudo verificar la seguridad contextual.');
        if (!cancelado) setDatos(body);
      })
      .catch(e => {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No se pudo verificar la seguridad contextual.');
      })
      .finally(() => { if (!cancelado) setCargando(false); });

    return () => { cancelado = true; };
  }, [pacienteId]);

  async function resolver(alerta: Alerta) {
    if (justificacion.trim().length < 5) {
      setMensaje('Escriba una justificación clínica de al menos 5 caracteres.');
      return;
    }

    setGuardando(true);
    setMensaje('');

    try {
      const r = await fetch(`/api/pacientes/${pacienteId}/seguridad-formulacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principioId: alerta.principio_id,
          tipo,
          justificacion: justificacion.trim(),
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'No se pudo registrar la resolución.');

      await recargar();
      setEditando(null);
      setJustificacion('');
      setTipo('aceptada_justificada');
      setMensaje('Resolución clínica registrada con auditoría.');
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo registrar la resolución.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return (
    <section className="mb-5 rounded-card border border-linea bg-white p-5">
      <p className="text-sm text-choco-soft">Verificando seguridad clínica contextual…</p>
    </section>
  );

  if (error) return (
    <section className="mb-5 rounded-card border border-fase-reset/30 bg-white p-5">
      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-fase-reset">Seguridad clínica no verificada</p>
      <p className="mt-2 text-sm text-choco-mid">{error}</p>
      <p className="mt-1 text-xs text-choco-soft">
        No apruebe la formulación hasta revisar manualmente medicación, alergias, función renal/hepática e interacciones.
      </p>
    </section>
  );

  if (!datos) return null;

  const contexto = datos.contexto;
  const alertas = datos.alertas ?? [];
  const pendientes = alertas.filter(a => a.resolucion?.estado_resolucion !== 'resuelta');
  const bloqueos = pendientes.filter(a => a.nivel === 'bloqueado');

  return (
    <section className={`mb-5 rounded-card border bg-white p-5 ${bloqueos.length > 0 ? 'border-fase-reset/40' : pendientes.length > 0 ? 'border-oro/40' : 'border-linea'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[9.5px] font-semibold uppercase tracking-wider text-oro">Seguridad clínica contextual</p>
          <p className="mt-1 text-sm text-choco-deep">
            {alertas.length > 0
              ? `${alertas.length} alerta${alertas.length === 1 ? '' : 's'} contextual${alertas.length === 1 ? '' : 'es'} · ${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'}.`
              : 'No se detectaron alertas contextuales activas en las reglas estructuradas actuales.'}
          </p>
        </div>
        {bloqueos.length > 0 && (
          <span className="rounded-full border border-fase-reset/30 px-2.5 py-1 text-[11px] font-semibold text-fase-reset">
            {bloqueos.length} bloqueo{bloqueos.length === 1 ? '' : 's'} pendiente{bloqueos.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {contexto ? (
        <div className="mt-4 grid gap-2 text-[12px] text-choco-mid sm:grid-cols-2 lg:grid-cols-3">
          <p><b>Medicación:</b> {contexto.medicamentos_actuales || 'No registrada'}</p>
          <p><b>Alergias:</b> {contexto.alergias || 'No registradas'}</p>
          <p><b>Embarazo:</b> {textoEstado(contexto.embarazo)}</p>
          <p><b>Lactancia:</b> {textoEstado(contexto.lactancia)}</p>
          <p><b>Función renal:</b> {contexto.deterioro_renal === true ? 'Deterioro registrado' : contexto.deterioro_renal === false ? 'Sin deterioro registrado' : 'Desconocido'}</p>
          <p><b>Función hepática:</b> {contexto.deterioro_hepatico === true ? 'Deterioro registrado' : contexto.deterioro_hepatico === false ? 'Sin deterioro registrado' : 'Desconocido'}</p>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-linea p-3 text-sm text-choco-mid">
          No hay una consulta activa con contexto de seguridad estructurado.
        </div>
      )}

      {alertas.length > 0 && (
        <div className="mt-4 space-y-3">
          {alertas.map(alerta => {
            const coincidencias = alerta.datos_disparadores?.coincidencias ?? [];
            const resuelta = alerta.resolucion?.estado_resolucion === 'resuelta';

            return (
              <article key={`${alerta.principio_id}-${alerta.nivel}`} className="rounded-lg border border-linea p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-choco-deep">{alerta.nombre}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${resuelta ? 'border border-linea-fuerte text-choco-mid' : alerta.nivel === 'bloqueado' ? 'border border-fase-reset/30 text-fase-reset' : 'border border-oro/30 text-oro'}`}>
                    {resuelta ? etiquetaResolucion(alerta.resolucion?.resolucion_tipo) : alerta.nivel === 'bloqueado' ? 'Bloqueado' : 'Requiere revisión'}
                  </span>
                </div>

                <p className="mt-1 text-[12.5px] text-choco-mid">{alerta.motivo}</p>
                {coincidencias.length > 0 && (
                  <p className="mt-1 text-[11.5px] text-choco-soft">Coincidencia detectada: {coincidencias.join(', ')}.</p>
                )}

                {resuelta ? (
                  <div className="mt-3 rounded-md border border-linea bg-crema/40 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-choco-mid">Resolución médica registrada</p>
                    <p className="mt-1 text-xs text-choco-mid">{alerta.resolucion?.justificacion_resolucion}</p>
                    {alerta.resolucion?.resolved_at && (
                      <p className="mt-1 text-[10.5px] text-choco-soft">
                        {new Date(alerta.resolucion.resolved_at).toLocaleString('es-PY')}
                      </p>
                    )}
                  </div>
                ) : editando === alerta.principio_id ? (
                  <div className="mt-3 space-y-2 rounded-md border border-oro/20 bg-oro-wash/30 p-3">
                    <select
                      className="w-full rounded-md border border-linea bg-white px-3 py-2 text-sm"
                      value={tipo}
                      onChange={e => setTipo(e.target.value as TipoResolucion)}
                    >
                      <option value="aceptada_justificada">Aceptar con justificación</option>
                      <option value="descartada">Descartar alerta</option>
                    </select>

                    <textarea
                      rows={3}
                      className="w-full rounded-md border border-linea bg-white px-3 py-2 text-sm"
                      placeholder="Justificación clínica obligatoria"
                      value={justificacion}
                      onChange={e => setJustificacion(e.target.value)}
                    />

                    <div className="flex gap-2">
                      <button type="button" disabled={guardando} onClick={() => resolver(alerta)}
                        className="rounded-md bg-choco-deep px-3 py-1.5 text-xs text-crema disabled:opacity-50">
                        {guardando ? 'Guardando…' : 'Registrar resolución'}
                      </button>
                      <button type="button" disabled={guardando}
                        onClick={() => { setEditando(null); setJustificacion(''); }}
                        className="rounded-md border border-linea px-3 py-1.5 text-xs text-choco-mid">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button"
                    onClick={() => { setEditando(alerta.principio_id); setMensaje(''); }}
                    className="mt-3 rounded-md border border-oro/30 px-3 py-1.5 text-xs font-medium text-oro">
                    Resolver alerta
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {mensaje && <p className="mt-3 text-xs text-choco-mid">{mensaje}</p>}
      <p className="mt-4 text-[11px] text-choco-soft">{datos.advertencia}</p>
      {pendientes.length > 0 && (
        <p className="mt-1 text-[11px] font-medium text-oro">
          Las alertas pendientes deben revisarse antes de confirmar la seguridad de la fórmula.
        </p>
      )}
    </section>
  );
}