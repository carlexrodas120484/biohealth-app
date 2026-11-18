import { useState } from 'react';
import { EncabezadoSeccion } from '@/components/ui/EncabezadoSeccion';
import { Revelar } from '@/components/ui/Revelar';
import { categorias, servicios, type CategoriaServicio } from '@/config/servicios';
import { TarjetaServicio } from './TarjetaServicio';

type Filtro = 'todos' | CategoriaServicio;

export function Servicios() {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const lista = filtro === 'todos' ? servicios : servicios.filter((s) => s.categoria === filtro);
  const opciones: { id: Filtro; etiqueta: string }[] = [
    { id: 'todos', etiqueta: 'Todos' },
    ...(Object.entries(categorias) as [CategoriaServicio, string][]).map(([id, etiqueta]) => ({ id, etiqueta })),
  ];

  return (
    <section id="servicios" aria-labelledby="titulo-servicios" className="seccion bg-white">
      <div className="contenedor">
        <div className="flex flex-col gap-10">
          <EncabezadoSeccion
            etiqueta="Nuestros servicios"
            titulo={<span id="titulo-servicios">Especialidades y estudios en un mismo lugar</span>}
            texto="Un equipo multidisciplinario que trabaja de forma coordinada, con estudios complementarios integrados a la consulta."
          />
          <div role="tablist" aria-label="Filtrar servicios" className="flex flex-wrap gap-2">
            {opciones.map((o) => (
              <button
                key={o.id}
                role="tab"
                aria-selected={filtro === o.id}
                onClick={() => setFiltro(o.id)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                  filtro === o.id
                    ? 'border-tinta bg-tinta text-white'
                    : 'border-linea text-tinta-suave hover:border-dorado hover:text-tinta'
                }`}
              >
                {o.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {lista.map((s, i) => (
            <Revelar key={s.id} retardo={(i % 3) * 90} className="h-full">
              <TarjetaServicio servicio={s} />
            </Revelar>
          ))}
        </div>
      </div>
    </section>
  );
}
