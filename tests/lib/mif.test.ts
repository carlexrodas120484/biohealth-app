import { describe, it, expect, vi } from 'vitest';
import {
  mgDesdeDosis, decidirPresentacion, perfilOrganolepticoBloqueaConversion, seleccionarSabor,
  agruparPorCompatibilidad, generarFormulaSugerida,
} from '@/lib/clinica/mif';
import type { PrincipioFarmacotecnico, PreferenciasPaciente } from '@/lib/repositorios/baseFarmacotecnica';
import { crearSupabaseMock } from '../helpers/supabaseMock';

function principioBase(overrides: Partial<PrincipioFarmacotecnico> = {}): PrincipioFarmacotecnico {
  return {
    id: 'p1', nombreCanonico: 'Principio X', nombreCientifico: null, sinonimos: [], categorias: [],
    dosisMinima: null, dosisUsual: null, dosisMaxima: null,
    capacidadCapsulaMg: 500, tamanoCapsula: null, maxCapsulasPorToma: null, presentacionIdeal: 'capsula',
    farmacotecnia: { compatibleSobres: null, compatibleLiquidos: null, compatibleCapsulas: null, higroscopico: null, fotosensible: null, sensibleCalor: null },
    perfilOrganoleptico: { tipoSabor: null, intensidad: null, facilidadEnmascarar: null, intensidadNumerica: null, estabilidad: null },
    saboresCompatibles: [], incompatibilidadesNombres: [], compatibilidadesNombres: [],
    ...overrides,
  };
}

describe('mgDesdeDosis — Regla 0: conversión de unidades', () => {
  it('convierte g a mg', () => expect(mgDesdeDosis({ valor: 5, unidad: 'g' })).toBe(5000));
  it('convierte mcg a mg', () => expect(mgDesdeDosis({ valor: 500, unidad: 'mcg' })).toBe(0.5));
  it('deja mg sin cambios', () => expect(mgDesdeDosis({ valor: 300, unidad: 'mg' })).toBe(300));
  it('no convierte UI (no es una unidad de masa)', () => expect(mgDesdeDosis({ valor: 1000, unidad: 'ui' })).toBeNull());
  it('no convierte ml (líquido, no masa)', () => expect(mgDesdeDosis({ valor: 5, unidad: 'ml' })).toBeNull());
  it('devuelve null si no hay dosis', () => expect(mgDesdeDosis(null)).toBeNull());
});

describe('perfilOrganolepticoBloqueaConversion — Regla 3', () => {
  it('bloquea con sabor amargo e intensidad alta (ej. NAC)', () => {
    const r = perfilOrganolepticoBloqueaConversion({ tipoSabor: 'amargo', intensidad: 'alta', facilidadEnmascarar: null, intensidadNumerica: null, estabilidad: null });
    expect(r.bloqueado).toBe(true);
  });
  it('bloquea con sabor sulfuroso e intensidad extrema (ej. berberina)', () => {
    const r = perfilOrganolepticoBloqueaConversion({ tipoSabor: 'sulfuroso', intensidad: 'extrema', facilidadEnmascarar: null, intensidadNumerica: null, estabilidad: null });
    expect(r.bloqueado).toBe(true);
  });
  it('bloquea si la facilidad de enmascarar es difícil, aunque el sabor no sea amargo', () => {
    const r = perfilOrganolepticoBloqueaConversion({ tipoSabor: 'terroso', intensidad: 'media', facilidadEnmascarar: 'dificil', intensidadNumerica: null, estabilidad: null });
    expect(r.bloqueado).toBe(true);
  });
  it('no bloquea con sabor amargo pero intensidad baja', () => {
    const r = perfilOrganolepticoBloqueaConversion({ tipoSabor: 'amargo', intensidad: 'baja', facilidadEnmascarar: 'facil', intensidadNumerica: null, estabilidad: null });
    expect(r.bloqueado).toBe(false);
  });
  it('no bloquea con perfil neutro', () => {
    const r = perfilOrganolepticoBloqueaConversion({ tipoSabor: 'neutro', intensidad: 'baja', facilidadEnmascarar: 'facil', intensidadNumerica: null, estabilidad: null });
    expect(r.bloqueado).toBe(false);
  });
});

describe('decidirPresentacion — Reglas 1 y 2', () => {
  it('Regla 1: dentro del límite de 2 cápsulas por toma, sugiere cápsula', () => {
    const p = principioBase({ capacidadCapsulaMg: 500 });
    const d = decidirPresentacion(p, 800, { capacidadCapsulaMgDefecto: 1000, limiteCapsulasAntesDeSobre: 2, amargorBloqueaSobreAutomatico: 3 });
    expect(d.capsulasPorToma).toBe(2);
    expect(d.presentacionSugerida).toBe('capsula');
    expect(d.superaLimite).toBe(false);
  });

  it('Regla 2: supera el límite y es compatible con sobre → sugiere sobre', () => {
    const p = principioBase({ capacidadCapsulaMg: 500, farmacotecnia: { compatibleSobres: true, compatibleLiquidos: null, compatibleCapsulas: null, higroscopico: null, fotosensible: null, sensibleCalor: null } });
    const d = decidirPresentacion(p, 2000, { capacidadCapsulaMgDefecto: 1000, limiteCapsulasAntesDeSobre: 2, amargorBloqueaSobreAutomatico: 3 });
    expect(d.capsulasPorToma).toBe(4);
    expect(d.superaLimite).toBe(true);
    expect(d.presentacionSugerida).toBe('sobre');
    expect(d.alternativasEvaluadas.find(a => a.opcion === 'sobre')?.viable).toBe(true);
  });

  it('Regla 2: supera el límite, no compatible con sobre pero sí con líquido → sugiere líquido', () => {
    const p = principioBase({ capacidadCapsulaMg: 500, farmacotecnia: { compatibleSobres: false, compatibleLiquidos: true, compatibleCapsulas: null, higroscopico: null, fotosensible: null, sensibleCalor: null } });
    const d = decidirPresentacion(p, 2000, { capacidadCapsulaMgDefecto: 1000, limiteCapsulasAntesDeSobre: 2, amargorBloqueaSobreAutomatico: 3 });
    expect(d.presentacionSugerida).toBe('liquido');
  });

  it('Regla 2: supera el límite, sin sobre ni líquido compatibles → recomienda dividir horarios, mantiene cápsula', () => {
    const p = principioBase({ capacidadCapsulaMg: 500 });
    const d = decidirPresentacion(p, 2000, { capacidadCapsulaMgDefecto: 1000, limiteCapsulasAntesDeSobre: 2, amargorBloqueaSobreAutomatico: 3 });
    expect(d.presentacionSugerida).toBe('capsula');
    expect(d.alternativasEvaluadas.some(a => a.opcion === 'dividir_horario' && a.viable)).toBe(true);
  });

  it('Regla 3: perfil organoléptico desfavorable mantiene cápsula aunque supere el límite (ej. NAC/berberina)', () => {
    const p = principioBase({
      capacidadCapsulaMg: 500,
      farmacotecnia: { compatibleSobres: true, compatibleLiquidos: true, compatibleCapsulas: null, higroscopico: null, fotosensible: null, sensibleCalor: null },
      perfilOrganoleptico: { tipoSabor: 'amargo', intensidad: 'extrema', facilidadEnmascarar: 'dificil', intensidadNumerica: 5, estabilidad: null },
    });
    const d = decidirPresentacion(p, 2000, { capacidadCapsulaMgDefecto: 1000, limiteCapsulasAntesDeSobre: 2, amargorBloqueaSobreAutomatico: 3 });
    expect(d.presentacionSugerida).toBe('capsula');
    expect(d.motivo).toMatch(/organoléptico/);
  });

  it('respeta un límite de cápsulas específico del principio, distinto del global', () => {
    const p = principioBase({ capacidadCapsulaMg: 500, maxCapsulasPorToma: 1 });
    const d = decidirPresentacion(p, 800, { capacidadCapsulaMgDefecto: 1000, limiteCapsulasAntesDeSobre: 2, amargorBloqueaSobreAutomatico: 3 });
    // 800mg / 500mg = 2 cápsulas, pero el límite propio del principio es 1
    expect(d.limiteCapsulasAplicado).toBe(1);
    expect(d.superaLimite).toBe(true);
  });

  it('cuando la dosis no es convertible a mg (UI/ml), no calcula cápsulas y usa la presentación ideal cargada', () => {
    const p = principioBase({ presentacionIdeal: 'liquido' });
    const d = decidirPresentacion(p, null);
    expect(d.capsulasPorToma).toBeNull();
    expect(d.presentacionSugerida).toBe('liquido');
  });
});

describe('seleccionarSabor — Reglas 4 y 5', () => {
  const p = principioBase({
    saboresCompatibles: [{ sabor: 'naranja', nivelAceptacion: 3 }, { sabor: 'limon', nivelAceptacion: 5 }, { sabor: 'pina', nivelAceptacion: 4 }],
  });

  it('Regla 4: sin preferencias del paciente, sugiere el sabor de mayor aceptación', () => {
    const d = seleccionarSabor(p, null);
    expect(d.sabor).toBe('limon');
  });

  it('Regla 5: el sabor favorito del paciente tiene prioridad aunque no sea el de mayor aceptación', () => {
    const preferencias: PreferenciasPaciente = { saborFavorito: 'naranja', saboresRechazados: [], dificultadTragarCapsulas: null, preferenciaForma: null, notas: null };
    const d = seleccionarSabor(p, preferencias);
    expect(d.sabor).toBe('naranja');
  });

  it('excluye los sabores rechazados por el paciente, incluso si tienen la mayor aceptación', () => {
    const preferencias: PreferenciasPaciente = { saborFavorito: null, saboresRechazados: ['limon'], dificultadTragarCapsulas: null, preferenciaForma: null, notas: null };
    const d = seleccionarSabor(p, preferencias);
    expect(d.sabor).toBe('pina');
  });

  it('devuelve null con motivo si no hay sabores compatibles cargados', () => {
    const sinSabores = principioBase({ saboresCompatibles: [] });
    const d = seleccionarSabor(sinSabores, null);
    expect(d.sabor).toBeNull();
  });

  it('el sabor favorito rechazado no se elige (dato inconsistente defendido igual)', () => {
    const preferencias: PreferenciasPaciente = { saborFavorito: 'limon', saboresRechazados: ['limon'], dificultadTragarCapsulas: null, preferenciaForma: null, notas: null };
    const d = seleccionarSabor(p, preferencias);
    expect(d.sabor).not.toBe('limon');
  });
});

describe('agruparPorCompatibilidad', () => {
  it('separa dos principios mutuamente incompatibles en grupos distintos', () => {
    const a = principioBase({ nombreCanonico: 'A', incompatibilidadesNombres: ['B'] });
    const b = principioBase({ nombreCanonico: 'B' });
    const grupos = agruparPorCompatibilidad([a, b]);
    expect(grupos).toHaveLength(2);
  });

  it('agrupa juntos los principios sin incompatibilidades entre sí', () => {
    const a = principioBase({ nombreCanonico: 'A' });
    const b = principioBase({ nombreCanonico: 'B' });
    const grupos = agruparPorCompatibilidad([a, b]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toHaveLength(2);
  });
});

function usarMock(user: { id: string } | null, queue: any[]) {
  const { client } = crearSupabaseMock(user, queue);
  return client;
}

describe('generarFormulaSugerida — orquestación de sólo lectura', () => {
  it('no está disponible si los objetivos no están confirmados, y no consulta la Base Farmacotécnica', () => {
    const client = usarMock({ id: 'u1' }, [
      { data: null, error: null }, // diagnostico
      { data: null, error: null }, // ipt
      { data: null, error: null }, // fase
      { data: { fase: 'restore', objetivos: ['Disminuir inflamación'], confirmado: false }, error: null }, // objetivos
    ]);
    return generarFormulaSugerida(client as any, 'tenant-1', 'paciente-1').then(receta => {
      expect(receta.disponible).toBe(false);
      expect(receta.motivoNoDisponible).toMatch(/objetivos/);
    });
  });

  it('no está disponible si la fase no está confirmada', () => {
    const client = usarMock({ id: 'u1' }, [
      { data: null, error: null },
      { data: null, error: null },
      { data: { fase_seleccionada: 'restore', confirmado: false }, error: null },
      { data: { fase: 'restore', objetivos: ['Disminuir inflamación'], confirmado: true }, error: null },
    ]);
    return generarFormulaSugerida(client as any, 'tenant-1', 'paciente-1').then(receta => {
      expect(receta.disponible).toBe(false);
      expect(receta.motivoNoDisponible).toMatch(/fase/);
    });
  });

  it('genera una sugerencia cuando fase y objetivos están confirmados, marcando "sin validar" el candidato que no está en la Base Farmacotécnica', async () => {
    const client = usarMock({ id: 'u1' }, [
      { data: null, error: null }, // diagnostico
      { data: null, error: null }, // ipt
      { data: { fase_seleccionada: 'restore', confirmado: true }, error: null }, // fase
      { data: { fase: 'restore', objetivos: ['Disminuir inflamación'], confirmado: true }, error: null }, // objetivos
      { data: [], error: null }, // principios_activos validados (ninguno)
      { data: null, error: null }, // preferencias
    ]);
    const receta = await generarFormulaSugerida(client as any, 'tenant-1', 'paciente-1');
    expect(receta.disponible).toBe(true);
    expect(receta.candidatos.length).toBeGreaterThan(0);
    expect(receta.candidatos.every(c => !c.disponibleEnBaseValidada)).toBe(true);
    expect(receta.candidatos[0].advertencias[0].descripcion).toMatch(/no tiene un registro validado/);
  });
});
