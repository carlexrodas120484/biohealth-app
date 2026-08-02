import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requerirRolAdminEnPagina } from '@/lib/adminAuth';
import { esUuidValido } from '@/lib/validation/id';
import { PrincipioActivoForm } from '@/components/admin/PrincipioActivoForm';

const ROLES_AUTORIZADOS = ['medico_titular'] as const;

export default async function EditarPrincipioActivoPage({ params }: { params: { id: string } }) {
  if (!esUuidValido(params.id)) notFound();

  const supabase = await createClient();
  const { tenantId } = await requerirRolAdminEnPagina(supabase, ROLES_AUTORIZADOS);

  const { data: principio } = await supabase
    .from('principios_activos').select('*').eq('id', params.id)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`).maybeSingle();
  if (!principio) notFound();

  const p = principio as any;

  return (
    <div className="mx-auto max-w-4xl">
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-oro">Base de conocimiento</p>
      <h1 className="mb-1 font-serif text-3xl text-choco-deep">Editar: {p.nombre_canonico}</h1>
      {p.estado === 'validado' && (
        <p className="mb-4 text-sm text-fase-target">
          Este principio está validado. Guardar cambios exige confirmación explícita y lo regresa a "En revisión".
        </p>
      )}
      <PrincipioActivoForm
        modo="editar"
        principioId={p.id}
        datosIniciales={{
          nombreCanonico: p.nombre_canonico, nombreComercial: p.nombre_comercial ?? '', descripcion: p.descripcion ?? '',
          mecanismoAccion: p.mecanismo_accion ?? '', funcionesClinicas: p.funciones_clinicas ?? [], sistemasRelacionados: p.sistemas_relacionados ?? [],
          limiteEdadMinAnios: p.limite_edad_min_anios, limiteEdadMaxAnios: p.limite_edad_max_anios,
          limitePesoMinKg: p.limite_peso_min_kg, limitePesoMaxKg: p.limite_peso_max_kg,
          limiteRenal: p.limite_renal ?? '', limiteHepatico: p.limite_hepatico ?? '',
          contraindicadoEmbarazo: p.contraindicado_embarazo, contraindicadoLactancia: p.contraindicado_lactancia, contraindicadoOncologico: p.contraindicado_oncologico,
          precaucionAnticoagulacion: p.precaucion_anticoagulacion, precaucionAntihipertensivos: p.precaucion_antihipertensivos, precaucionHipoglucemiantes: p.precaucion_hipoglucemiantes,
        }}
      />
    </div>
  );
}
