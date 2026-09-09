'use client';

import { useEffect, useState } from 'react';

type Contexto = {
  medicamentos_actuales?: string | null;
  alergias?: string | null;
  embarazo?: boolean | null;
  lactancia?: boolean | null;
  deterioro_renal?: boolean | null;
  deterioro_hepatico?: boolean | null;
  contexto_actualizado_en?: string | null;
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
};

type Respuesta = {
  consultaId: string | null;
  contexto: Contexto | null;
  alertas: Alerta[];
  advertencia: string;
};

function textoEstado(valor: boolean | null | undefined) {
  if (valor === true) return 'SÃ­';
  if (valor === false) return 'No';
  return 'Desconocido';
}

export function SeguridadContextualPanel({ pacienteId }: { pacienteId: string }) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    fetch(`/api/pacientes/${pacienteId}/seguridad-formulacion`)
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? 'No se pudo verificar la seguridad contextual.');
        if (!cancelado) setDatos(body);
      })
      .catch(e => {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No se pudo verificar la seguridad contextual.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [pacienteId]);

  if (cargando) {
    return (
      <section className="mb-5 rounded-card border border-linea bg-white p-5">
        <p className="text-sm text-choco-soft">Verificando seguridad clÃ­nica contextualâ€¦</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-5 rounded-card border border-fase-reset/30 bg-white p-5">
        <p className="text-[9.5px] font-semibold uppercase tracking-wider text-fase-reset">
          Seguridad clÃ­nica no verificada
        </p>
        <p className="mt-2 text-sm text-choco-mid">{error}</p>
        <p className="mt-1 text-xs text-choco-soft">
          No apruebe la formulaciÃ³n hasta revisar manualmente medicaciÃ³n, alergias, funciÃ³n renal/hepÃ¡tica e interacciones.
        </p>
      </section>
    );
  }

  if (!datos) return null;

  const contexto = datos.contexto;
  const alertas = datos.alertas ?? [];
  const bloqueos = alertas.filter(a => a.nivel === 'bloqueado');
  const revisiones = alertas.filter(a => a.nivel === 'requiere_revision');

  return (
    <section className={`mb-5 rounded-card border bg-white p-5 ${bloqueos.length > 0 ? 'border-fase-reset/40' : alertas.length > 0 ? 'border-oro/40' : 'border-linea'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[9.5px] font-semibold uppercase tracking-wider text-oro">
            Seguridad clÃ­nica contextual
          </p>
          <p className="mt-1 text-sm text-choco-deep">
            {alertas.length > 0
              ? `${alertas.length} alerta${alertas.length === 1 ? '' : 's'} relacionada${alertas.length === 1 ? '' : 's'} con el contexto actual.`
              : 'No se detectaron alertas contextuales activas en las reglas estructuradas actuales.'}
          </p>
        </div>

        {bloqueos.length > 0 && (
          <span className="rounded-full border border-fase-reset/30 px-2.5 py-1 text-[11px] font-semibold text-fase-reset">
            {bloqueos.length} bloqueo{bloqueos.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {!contexto ? (
        <div className="mt-4 rounded-lg border border-linea p-3 text-sm text-choco-mid">
          No hay una consulta activa con contexto de seguridad estructurado.
        </div>
      ) : (
        <div className="mt-4 grid gap-2 text-[12px] text-choco-mid sm:grid-cols-2 lg:grid-cols-3">
          <p><b>MedicaciÃ³n:</b> {contexto.medicamentos_actuales || 'No registrada'}</p>
          <p><b>Alergias:</b> {contexto.alergias || 'No registradas'}</p>
          <p><b>Embarazo:</b> {textoEstado(contexto.embarazo)}</p>
          <p><b>Lactancia:</b> {textoEstado(contexto.lactancia)}</p>
          <p><b>FunciÃ³n renal:</b> {contexto.deterioro_renal === true ? 'Deterioro registrado' : contexto.deterioro_renal === false ? 'Sin deterioro registrado' : 'Desconocido'}</p>
          <p><b>FunciÃ³n hepÃ¡tica:</b> {contexto.deterioro_hepatico === true ? 'Deterioro registrado' : contexto.deterioro_hepatico === false ? 'Sin deterioro registrado' : 'Desconocido'}</p>
        </div>
      )}

      {alertas.length > 0 && (
        <div className="mt-4 space-y-3">
          {alertas.map(alerta => {
            const coincidencias = alerta.datos_disparadores?.coincidencias ?? [];
            return (
              <article key={`${alerta.principio_id}-${alerta.nivel}`} className="rounded-lg border border-linea p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-choco-deep">{alerta.nombre}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${alerta.nivel === 'bloqueado' ? 'border border-fase-reset/30 text-fase-reset' : 'border border-oro/30 text-oro'}`}>
                    {alerta.nivel === 'bloqueado' ? 'Bloqueado' : 'Requiere revisiÃ³n'}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-choco-mid">{alerta.motivo}</p>
                {coincidencias.length > 0 && (
                  <p className="mt-1 text-[11.5px] text-choco-soft">
                    Coincidencia detectada: {coincidencias.join(', ')}.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[11px] text-choco-soft">{datos.advertencia}</p>
      {revisiones.length > 0 && bloqueos.length === 0 && (
        <p className="mt-1 text-[11px] font-medium text-oro">
          Revise estas alertas antes de confirmar la seguridad de la fÃ³rmula.
        </p>
      )}
    </section>
  );
}