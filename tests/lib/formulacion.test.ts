import { describe, it, expect } from 'vitest';
import {
  calcularCapsulasPorToma, calcularPresentacion, agruparPorHorario, separarIncompatibles,
  calcularCargaTotalMg, calcularDosisDiariaTotalMg, calcularCantidadParaDuracion, detectarDuplicados,
  excedeLimite, construirPreparaciones, generarAlertas, clasificarSabor,
  CAPACIDAD_CAPSULA_MG_DEFECTO, LIMITE_CAPSULAS_ANTES_DE_SOBRE,
  type IngredienteFormula, type InfoCatalogo,
} from '../../lib/clinica/formulacion';

function catalogo(overrides: Partial<InfoCatalogo> & { nombre: string }): InfoCatalogo {
  return {
    capacidadCapsulaMg: 500, amargor: 0, solubleEnAgua: true, presentacionPreferida: 'individualizar',
    incompatibilidades: [], doseReferenciaMaxMg: null, limiteSuperiorMg: null, ...overrides,
  };
}

function ingrediente(overrides: Partial<IngredienteFormula> & { nombre: string; dosisPorTomaMg: number }): IngredienteFormula {
  return { id: overrides.nombre, vecesPorDia: 1, horario: 'desayuno', ...overrides };
}

describe('calcularCapsulasPorToma', () => {
  it('redondea hacia arriba', () => {
    expect(calcularCapsulasPorToma(1000, CAPACIDAD_CAPSULA_MG_DEFECTO)).toBe(1);
    expect(calcularCapsulasPorToma(1001, CAPACIDAD_CAPSULA_MG_DEFECTO)).toBe(2);
    expect(calcularCapsulasPorToma(2500, 1000)).toBe(3);
  });

  it('usa la capacidad por defecto de 1000mg cuando no hay catálogo', () => {
    const { capsulasPorToma } = calcularPresentacion(ingrediente({ nombre: 'X', dosisPorTomaMg: 1000 }), null, false);
    expect(capsulasPorToma).toBe(1);
  });
});

describe('calcularPresentacion — regla 3: sugerir sobre si supera el límite de cápsulas', () => {
  it('sugiere cápsula si entra en el límite', () => {
    const r = calcularPresentacion(ingrediente({ nombre: 'A', dosisPorTomaMg: 2000 }), catalogo({ nombre: 'A' }), false);
    expect(r.capsulasPorToma).toBe(4); // 2000/500
    // supera LIMITE_CAPSULAS_ANTES_DE_SOBRE (2) -> sobre
    expect(r.presentacionSugerida).toBe('sobre');
  });

  it('sugiere cápsula si no supera el límite', () => {
    const r = calcularPresentacion(ingrediente({ nombre: 'A', dosisPorTomaMg: 500 }), catalogo({ nombre: 'A' }), false);
    expect(r.capsulasPorToma).toBe(1);
    expect(r.presentacionSugerida).toBe('capsula');
    expect(LIMITE_CAPSULAS_ANTES_DE_SOBRE).toBe(2);
  });
});

describe('calcularPresentacion — regla 4: no cambiar automáticamente a sobre', () => {
  it('no cambia a sobre si el principio es muy amargo, aunque supere el límite de cápsulas', () => {
    const r = calcularPresentacion(ingrediente({ nombre: 'Amargo', dosisPorTomaMg: 2000 }), catalogo({ nombre: 'Amargo', amargor: 4 }), false);
    expect(r.cambioAutomaticoBloqueado).toBe(true);
    expect(r.presentacionSugerida).toBe('capsula');
    expect(r.motivosBloqueo.some(m => m.includes('amargo'))).toBe(true);
  });

  it('no cambia a sobre si tiene mala solubilidad', () => {
    const r = calcularPresentacion(ingrediente({ nombre: 'X', dosisPorTomaMg: 2000 }), catalogo({ nombre: 'X', solubleEnAgua: false }), false);
    expect(r.cambioAutomaticoBloqueado).toBe(true);
    expect(r.presentacionSugerida).toBe('capsula');
  });

  it('no cambia a sobre si es incompatible con otro componente de la preparación', () => {
    const r = calcularPresentacion(ingrediente({ nombre: 'X', dosisPorTomaMg: 2000 }), catalogo({ nombre: 'X' }), true);
    expect(r.cambioAutomaticoBloqueado).toBe(true);
    expect(r.motivosBloqueo.some(m => m.includes('incompatible'))).toBe(true);
  });

  it('no cambia a sobre si requiere protección especial (presentación comercial)', () => {
    const r = calcularPresentacion(ingrediente({ nombre: 'X', dosisPorTomaMg: 2000 }), catalogo({ nombre: 'X', presentacionPreferida: 'comercial' }), false);
    expect(r.cambioAutomaticoBloqueado).toBe(true);
    expect(r.presentacionSugerida).toBe('comercial');
  });

  it('no cambia a sobre si el médico bloqueó esa presentación', () => {
    const r = calcularPresentacion(
      ingrediente({ nombre: 'X', dosisPorTomaMg: 2000, bloquearPresentacion: true }),
      catalogo({ nombre: 'X' }),
      false
    );
    expect(r.cambioAutomaticoBloqueado).toBe(true);
    expect(r.presentacionSugerida).toBe('capsula');
  });

  it('respeta la presentación explícita elegida por el médico por sobre cualquier bloqueo', () => {
    const r = calcularPresentacion(
      ingrediente({ nombre: 'X', dosisPorTomaMg: 2000, presentacionElegida: 'liquido' }),
      catalogo({ nombre: 'X', amargor: 5 }),
      false
    );
    expect(r.presentacionSugerida).toBe('liquido');
  });
});

describe('clasificarSabor', () => {
  it('clasifica los 5 niveles de amargor', () => {
    expect(clasificarSabor(0)).toBe('neutro');
    expect(clasificarSabor(1)).toBe('leve');
    expect(clasificarSabor(2)).toBe('moderado');
    expect(clasificarSabor(3)).toBe('amargo');
    expect(clasificarSabor(5)).toBe('muy_amargo');
  });
});

describe('agruparPorHorario — regla 6', () => {
  it('agrupa por horario', () => {
    const ingredientes = [
      ingrediente({ nombre: 'A', dosisPorTomaMg: 100, horario: 'ayunas' }),
      ingrediente({ nombre: 'B', dosisPorTomaMg: 100, horario: 'cena' }),
      ingrediente({ nombre: 'C', dosisPorTomaMg: 100, horario: 'ayunas' }),
    ];
    const grupos = agruparPorHorario(ingredientes);
    expect(grupos.ayunas.map(i => i.nombre)).toEqual(['A', 'C']);
    expect(grupos.cena.map(i => i.nombre)).toEqual(['B']);
    expect(grupos.desayuno).toEqual([]);
  });
});

describe('separarIncompatibles — regla 5', () => {
  it('separa dos ingredientes mutuamente incompatibles en sub-preparaciones distintas', () => {
    const catalogoPorNombre = new Map([
      ['Hierro', catalogo({ nombre: 'Hierro', incompatibilidades: ['Calcio'] })],
      ['Calcio', catalogo({ nombre: 'Calcio' })],
    ]);
    const ingredientes = [ingrediente({ nombre: 'Hierro', dosisPorTomaMg: 100 }), ingrediente({ nombre: 'Calcio', dosisPorTomaMg: 100 })];
    const grupos = separarIncompatibles(ingredientes, catalogoPorNombre);
    expect(grupos).toHaveLength(2);
  });

  it('mantiene juntos ingredientes compatibles', () => {
    const catalogoPorNombre = new Map([['A', catalogo({ nombre: 'A' })], ['B', catalogo({ nombre: 'B' })]]);
    const ingredientes = [ingrediente({ nombre: 'A', dosisPorTomaMg: 100 }), ingrediente({ nombre: 'B', dosisPorTomaMg: 100 })];
    expect(separarIncompatibles(ingredientes, catalogoPorNombre)).toHaveLength(1);
  });
});

describe('cálculos de dosis — reglas 8, 9, 12', () => {
  it('calcula la dosis diaria total (dosis por toma × veces por día)', () => {
    expect(calcularDosisDiariaTotalMg(ingrediente({ nombre: 'A', dosisPorTomaMg: 500, vecesPorDia: 3 }))).toBe(1500);
  });

  it('calcula la carga total por preparación (mg)', () => {
    const ingredientes = [ingrediente({ nombre: 'A', dosisPorTomaMg: 300 }), ingrediente({ nombre: 'B', dosisPorTomaMg: 200 })];
    expect(calcularCargaTotalMg(ingredientes)).toBe(500);
  });

  it('calcula la cantidad total para una duración editable (ej. 30 días)', () => {
    const ing = ingrediente({ nombre: 'A', dosisPorTomaMg: 500, vecesPorDia: 2 });
    expect(calcularCantidadParaDuracion(ing, 30)).toBe(30000); // 1000mg/día * 30
    expect(calcularCantidadParaDuracion(ing, 15)).toBe(15000);
  });
});

describe('detectarDuplicados — regla 11', () => {
  it('detecta principios repetidos', () => {
    const ingredientes = [
      ingrediente({ nombre: 'Magnesio', dosisPorTomaMg: 100, horario: 'desayuno' }),
      ingrediente({ nombre: 'Magnesio', dosisPorTomaMg: 100, horario: 'cena' }),
      ingrediente({ nombre: 'Zinc', dosisPorTomaMg: 15 }),
    ];
    expect(detectarDuplicados(ingredientes)).toEqual(['Magnesio']);
  });
});

describe('excedeLimite — regla 10', () => {
  it('marca cuando la dosis diaria supera el límite superior de referencia', () => {
    const ing = ingrediente({ nombre: 'Zinc', dosisPorTomaMg: 50, vecesPorDia: 2 }); // 100mg/día
    expect(excedeLimite(ing, catalogo({ nombre: 'Zinc', limiteSuperiorMg: 40 }))).toBe(true);
    expect(excedeLimite(ing, catalogo({ nombre: 'Zinc', limiteSuperiorMg: 200 }))).toBe(false);
  });

  it('no marca nada si no hay catálogo (no inventa límites)', () => {
    expect(excedeLimite(ingrediente({ nombre: 'X', dosisPorTomaMg: 99999 }), null)).toBe(false);
  });
});

describe('construirPreparaciones — integración de las reglas 1-6, 9 y 12', () => {
  it('arma preparaciones agrupadas por horario con cápsulas, sabor y carga calculados', () => {
    const catalogoPorNombre = new Map([['Omega-3', catalogo({ nombre: 'Omega-3', amargor: 1 })]]);
    const preparaciones = construirPreparaciones(
      [ingrediente({ nombre: 'Omega-3', dosisPorTomaMg: 1000, horario: 'desayuno' })],
      catalogoPorNombre
    );
    expect(preparaciones).toHaveLength(1);
    expect(preparaciones[0].horario).toBe('desayuno');
    expect(preparaciones[0].ingredientes[0].capsulasPorToma).toBe(2);
    expect(preparaciones[0].ingredientes[0].sabor).toBe('leve');
    expect(preparaciones[0].cargaTotalMg).toBe(1000);
    expect(preparaciones[0].requiereEnmascararSabor).toBe(false);
  });

  it('advierte enmascarar sabor cuando hay un ingrediente amargo en sobre', () => {
    const catalogoPorNombre = new Map([['X', catalogo({ nombre: 'X', amargor: 4 })]]);
    const preparaciones = construirPreparaciones(
      [ingrediente({ nombre: 'X', dosisPorTomaMg: 100, horario: 'cena' })],
      catalogoPorNombre
    );
    expect(preparaciones[0].requiereEnmascararSabor).toBe(true);
  });
});

describe('generarAlertas', () => {
  const pacienteVacio = { alergias: null, medicamentosActuales: null, antecedentesPersonales: null, antecedentesFamiliares: null };

  it('alerta por alergia registrada', () => {
    const alertas = generarAlertas({ ingredientes: [], catalogoPorNombre: new Map(), paciente: { ...pacienteVacio, alergias: 'Penicilina' } });
    expect(alertas.some(a => a.codigo === 'alergias')).toBe(true);
  });

  it('alerta por medicación actual y por anticoagulante específico', () => {
    const alertas = generarAlertas({ ingredientes: [], catalogoPorNombre: new Map(), paciente: { ...pacienteVacio, medicamentosActuales: 'Warfarina 5mg' } });
    expect(alertas.some(a => a.codigo === 'medicacion-actual')).toBe(true);
    expect(alertas.some(a => a.codigo === 'anticoagulantes')).toBe(true);
  });

  it('alerta por antihipertensivo e hipoglucemiante', () => {
    const alertasHTA = generarAlertas({ ingredientes: [], catalogoPorNombre: new Map(), paciente: { ...pacienteVacio, medicamentosActuales: 'Enalapril 10mg' } });
    expect(alertasHTA.some(a => a.codigo === 'antihipertensivos')).toBe(true);
    const alertasDM = generarAlertas({ ingredientes: [], catalogoPorNombre: new Map(), paciente: { ...pacienteVacio, medicamentosActuales: 'Metformina 850mg' } });
    expect(alertasDM.some(a => a.codigo === 'hipoglucemiantes')).toBe(true);
  });

  it('alerta por antecedentes de hepatopatía, nefropatía y oncológicos', () => {
    const hep = generarAlertas({ ingredientes: [], catalogoPorNombre: new Map(), paciente: { ...pacienteVacio, antecedentesPersonales: 'Cirrosis hepática' } });
    expect(hep.some(a => a.codigo === 'hepatopatia')).toBe(true);
    const nef = generarAlertas({ ingredientes: [], catalogoPorNombre: new Map(), paciente: { ...pacienteVacio, antecedentesPersonales: 'Insuficiencia renal crónica' } });
    expect(nef.some(a => a.codigo === 'nefropatia')).toBe(true);
    const onc = generarAlertas({ ingredientes: [], catalogoPorNombre: new Map(), paciente: { ...pacienteVacio, antecedentesFamiliares: 'Antecedente de cáncer de mama' } });
    expect(onc.some(a => a.codigo === 'oncologico')).toBe(true);
  });

  it('alerta por duplicación de principio activo', () => {
    const ingredientes = [ingrediente({ nombre: 'Magnesio', dosisPorTomaMg: 100 }), ingrediente({ nombre: 'Magnesio', dosisPorTomaMg: 100, horario: 'cena' })];
    const alertas = generarAlertas({ ingredientes, catalogoPorNombre: new Map(), paciente: pacienteVacio });
    expect(alertas.some(a => a.codigo === 'duplicado-Magnesio')).toBe(true);
  });

  it('alerta por dosis elevada respecto del límite del catálogo', () => {
    const ingredientes = [ingrediente({ nombre: 'Zinc', dosisPorTomaMg: 100 })];
    const catalogoPorNombre = new Map([['Zinc', catalogo({ nombre: 'Zinc', limiteSuperiorMg: 50 })]]);
    const alertas = generarAlertas({ ingredientes, catalogoPorNombre, paciente: pacienteVacio });
    expect(alertas.some(a => a.codigo === 'dosis-elevada-Zinc')).toBe(true);
  });

  it('alerta por incompatibilidad entre componentes, una sola vez por par', () => {
    const ingredientes = [ingrediente({ nombre: 'Hierro', dosisPorTomaMg: 50 }), ingrediente({ nombre: 'Calcio', dosisPorTomaMg: 50 })];
    const catalogoPorNombre = new Map([
      ['Hierro', catalogo({ nombre: 'Hierro', incompatibilidades: ['Calcio'] })],
      ['Calcio', catalogo({ nombre: 'Calcio' })],
    ]);
    const alertas = generarAlertas({ ingredientes, catalogoPorNombre, paciente: pacienteVacio });
    const incompatibles = alertas.filter(a => a.fuente === 'incompatibilidad');
    expect(incompatibles).toHaveLength(1);
  });

  it('no genera ninguna alerta si no hay datos ni ingredientes', () => {
    expect(generarAlertas({ ingredientes: [], catalogoPorNombre: new Map(), paciente: pacienteVacio })).toEqual([]);
  });
});
