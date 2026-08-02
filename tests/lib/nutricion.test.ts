import { describe, it, expect } from 'vitest';
import {
  calcularIMC, clasificarIMC, calcularGEB, calcularGET, calcularObjetivoCalorico, calcularMacros,
  calcularFibraG, calcularAguaMl, distribuirHorarios, calcularValoresNutricionales,
  ALIMENTOS_LOCALES, CODIGOS_OBJETIVOS_CLINICOS, alimentosNoRecomendados, advertenciasPorAlimentoYObjetivo,
  generarAdvertenciasClinicas, advertenciasIntegracionFormulacion, generarAdvertenciasPlan,
  estructuraMenuVacio, estructuraMenuSemanalVacio, sugerirListaCompras, VERSION_MOTOR_NUTRICION,
} from '../../lib/clinica/nutricion';

describe('calcularIMC', () => {
  it('calcula el IMC y lo clasifica', () => {
    expect(calcularIMC(70, 170)).toBeCloseTo(24.2, 1);
    expect(clasificarIMC(17)).toBe('bajo_peso');
    expect(clasificarIMC(22)).toBe('normal');
    expect(clasificarIMC(27)).toBe('sobrepeso');
    expect(clasificarIMC(32)).toBe('obesidad');
  });
});

describe('calcularGEB — Mifflin-St Jeor', () => {
  it('calcula GEB para hombre y mujer con la misma antropometría', () => {
    const hombre = calcularGEB(70, 170, 30, 'masculino');
    const mujer = calcularGEB(70, 170, 30, 'femenino');
    // 10*70 + 6.25*170 - 5*30 = 1612.5; +5 hombre, -161 mujer
    expect(hombre).toBe(1618); // round(1617.5)
    expect(mujer).toBe(1452); // round(1451.5)
    expect(hombre).toBeGreaterThan(mujer);
  });
});

describe('calcularGET', () => {
  it('aplica el factor de actividad', () => {
    expect(calcularGET(1600, 'sedentario')).toBe(Math.round(1600 * 1.2));
    expect(calcularGET(1600, 'muy_intenso')).toBe(Math.round(1600 * 1.9));
  });
});

describe('calcularObjetivoCalorico', () => {
  it('resta 500kcal para pérdida de grasa cuando el resultado sigue por encima del GEB', () => {
    expect(calcularObjetivoCalorico(2500, 1600, 'perdida-grasa')).toBe(2000);
  });

  it('nunca baja del GEB (piso de seguridad)', () => {
    expect(calcularObjetivoCalorico(1600, 1600, 'perdida-grasa')).toBe(1600); // 1600-500=1100 < GEB 1600 -> se usa el GEB
  });

  it('suma 300kcal para ganancia de masa muscular', () => {
    expect(calcularObjetivoCalorico(2000, 1600, 'ganancia-masa-muscular')).toBe(2300);
  });

  it('mantiene el GET para mantenimiento', () => {
    expect(calcularObjetivoCalorico(2000, 1600, 'mantenimiento')).toBe(2000);
  });
});

describe('calcularMacros', () => {
  it('reparte las calorías según el objetivo y devuelve gramos', () => {
    const macros = calcularMacros(2000, 'mantenimiento'); // 30/40/30
    expect(macros.proteinaG).toBe(Math.round((2000 * 0.3) / 4));
    expect(macros.carbohidratosG).toBe(Math.round((2000 * 0.4) / 4));
    expect(macros.grasasG).toBe(Math.round((2000 * 0.3) / 9));
  });

  it('define una distribución para cada uno de los 16 objetivos clínicos', () => {
    for (const objetivo of CODIGOS_OBJETIVOS_CLINICOS) {
      const m = calcularMacros(2000, objetivo);
      expect(m.proteinaG).toBeGreaterThan(0);
      expect(m.carbohidratosG).toBeGreaterThan(0);
      expect(m.grasasG).toBeGreaterThan(0);
    }
    expect(CODIGOS_OBJETIVOS_CLINICOS).toHaveLength(16);
  });
});

describe('calcularFibraG y calcularAguaMl', () => {
  it('calcula fibra ~14g por 1000kcal', () => {
    expect(calcularFibraG(2000)).toBe(28);
  });

  it('calcula agua ~35ml por kg', () => {
    expect(calcularAguaMl(70)).toBe(2450);
  });
});

describe('distribuirHorarios', () => {
  it('devuelve desayuno/almuerzo/cena para 3 comidas', () => {
    expect(distribuirHorarios(3)).toEqual(['desayuno', 'almuerzo', 'cena']);
  });

  it('agrega meriendas para más de 3 comidas', () => {
    const horarios = distribuirHorarios(5);
    expect(horarios).toHaveLength(5);
    expect(horarios).toContain('media_manana');
  });

  it('nunca devuelve menos de 1 ni más de 6 horarios', () => {
    expect(distribuirHorarios(0)).toHaveLength(1);
    expect(distribuirHorarios(99)).toHaveLength(6);
  });
});

describe('calcularValoresNutricionales — integración', () => {
  it('devuelve todos los valores requeridos (IMC, GEB, GET, calórico, macros, fibra, agua)', () => {
    const r = calcularValoresNutricionales({ pesoKg: 70, tallaCm: 170, edadAnios: 30, sexo: 'femenino', nivelActividad: 'moderado', objetivo: 'mantenimiento' });
    expect(r.imc).toBeGreaterThan(0);
    expect(r.gebKcal).toBeGreaterThan(0);
    expect(r.getKcal).toBeGreaterThan(r.gebKcal);
    expect(r.objetivoCaloricoKcal).toBeGreaterThan(0);
    expect(r.proteinaG).toBeGreaterThan(0);
    expect(r.fibraG).toBeGreaterThan(0);
    expect(r.aguaMl).toBeGreaterThan(0);
  });
});

describe('catálogo de alimentos locales', () => {
  it('incluye los 20 alimentos paraguayos pedidos como mínimo', () => {
    const codigos = ALIMENTOS_LOCALES.map(a => a.codigo);
    expect(codigos).toEqual(expect.arrayContaining([
      'mandioca', 'batata', 'maiz', 'arroz', 'poroto', 'carne-vacuna', 'pollo', 'pescado', 'huevo',
      'leche-derivados', 'frutas-locales', 'verduras-locales', 'avena', 'mani', 'chia', 'yerba-mate',
      'cocido', 'sopa-paraguaya', 'chipa', 'mbeju',
    ]));
    expect(ALIMENTOS_LOCALES.length).toBeGreaterThanOrEqual(20);
  });

  it('ningún alimento está marcado como prohibido: son etiquetas, no bloqueos', () => {
    for (const a of ALIMENTOS_LOCALES) {
      expect(a).not.toHaveProperty('prohibido');
    }
  });
});

describe('advertenciasPorAlimentoYObjetivo', () => {
  it('advierte por índice glucémico alto en diabetes tipo 2', () => {
    const advertencias = advertenciasPorAlimentoYObjetivo('diabetes-tipo-2');
    expect(advertencias.some(a => a.codigo === 'glucemia-mandioca')).toBe(true);
  });

  it('advierte por sodio en hipertensión (sopa paraguaya)', () => {
    const advertencias = advertenciasPorAlimentoYObjetivo('hipertension');
    expect(advertencias.some(a => a.codigo === 'sodio-sopa-paraguaya')).toBe(true);
  });

  it('no advierte por glucemia en un objetivo no relacionado', () => {
    const advertencias = advertenciasPorAlimentoYObjetivo('reflujo');
    expect(advertencias.some(a => a.fuente === 'alimento' && a.codigo.startsWith('glucemia'))).toBe(false);
  });
});

describe('alimentosNoRecomendados — restricciones declaradas', () => {
  it('filtra alimentos con gluten si hay celiaquía declarada', () => {
    const r = alimentosNoRecomendados({ alergiasAlimentarias: [], celiaquia: true, vegetarianismo: false, veganismo: false });
    expect(r.some(x => x.alimento === 'Avena')).toBe(true);
  });

  it('filtra alimentos no vegetarianos/veganos', () => {
    const vegetariano = alimentosNoRecomendados({ alergiasAlimentarias: [], celiaquia: false, vegetarianismo: true, veganismo: false });
    expect(vegetariano.some(x => x.alimento === 'Carne vacuna')).toBe(true);
    const vegano = alimentosNoRecomendados({ alergiasAlimentarias: [], celiaquia: false, vegetarianismo: false, veganismo: true });
    expect(vegano.some(x => x.alimento === 'Huevo')).toBe(true);
  });

  it('filtra por alergia alimentaria declarada', () => {
    const r = alimentosNoRecomendados({ alergiasAlimentarias: ['mani'], celiaquia: false, vegetarianismo: false, veganismo: false });
    expect(r.some(x => x.alimento === 'Maní')).toBe(true);
  });

  it('sin restricciones declaradas, no filtra nada', () => {
    const r = alimentosNoRecomendados({ alergiasAlimentarias: [], celiaquia: false, vegetarianismo: false, veganismo: false });
    expect(r).toEqual([]);
  });
});

describe('generarAdvertenciasClinicas', () => {
  const vacio = { alergias: null, medicamentosActuales: null, antecedentesPersonales: null, antecedentesFamiliares: null };

  it('advierte por diabetes vía el objetivo, y por hipertensión vía el objetivo', () => {
    const diabetes = generarAdvertenciasPlan({
      objetivo: 'diabetes-tipo-2', paciente: vacio,
      restricciones: { alergiasAlimentarias: [], celiaquia: false, vegetarianismo: false, veganismo: false },
      alimentosRecomendados: [], ingredientesFormulacionAprobada: [],
    });
    expect(diabetes.some(a => a.codigo === 'objetivo-diabetes-tipo-2')).toBe(true);

    const hipertension = generarAdvertenciasPlan({
      objetivo: 'hipertension', paciente: vacio,
      restricciones: { alergiasAlimentarias: [], celiaquia: false, vegetarianismo: false, veganismo: false },
      alimentosRecomendados: [], ingredientesFormulacionAprobada: [],
    });
    expect(hipertension.some(a => a.codigo === 'objetivo-hipertension')).toBe(true);
  });

  it('advierte por medicación anticoagulante y por antecedentes de hepatopatía/nefropatía/oncológicos', () => {
    expect(generarAdvertenciasClinicas({ ...vacio, medicamentosActuales: 'Warfarina 5mg' }).some(a => a.codigo === 'anticoagulantes')).toBe(true);
    expect(generarAdvertenciasClinicas({ ...vacio, antecedentesPersonales: 'Cirrosis hepática' }).some(a => a.codigo === 'hepatopatia')).toBe(true);
    expect(generarAdvertenciasClinicas({ ...vacio, antecedentesPersonales: 'Insuficiencia renal crónica' }).some(a => a.codigo === 'nefropatia')).toBe(true);
    expect(generarAdvertenciasClinicas({ ...vacio, antecedentesFamiliares: 'Antecedente de cáncer' }).some(a => a.codigo === 'oncologico')).toBe(true);
  });
});

describe('advertenciasIntegracionFormulacion', () => {
  it('advierte cuando un alimento recomendado coincide exactamente con un ingrediente ya aprobado', () => {
    const advertencias = advertenciasIntegracionFormulacion(['Magnesio', 'Avena'], ['magnesio']);
    expect(advertencias).toHaveLength(1);
    expect(advertencias[0].fuente).toBe('formulacion');
  });

  it('no advierte si no hay coincidencia', () => {
    expect(advertenciasIntegracionFormulacion(['Avena'], ['Omega-3'])).toEqual([]);
  });

  it('nunca modifica la formulación: la función es de sólo lectura (no muta los arrays de entrada)', () => {
    const alimentos = ['Magnesio'];
    const ingredientes = ['Magnesio'];
    advertenciasIntegracionFormulacion(alimentos, ingredientes);
    expect(alimentos).toEqual(['Magnesio']);
    expect(ingredientes).toEqual(['Magnesio']);
  });
});

describe('estructuras de menú y lista de compras', () => {
  it('arma el menú diario vacío con un slot por horario', () => {
    const menu = estructuraMenuVacio(['desayuno', 'almuerzo', 'cena']);
    expect(menu).toHaveLength(3);
    expect(menu.every(m => m.descripcion === '' && m.alternativas.length === 0)).toBe(true);
  });

  it('arma el menú semanal con los 7 días', () => {
    const semanal = estructuraMenuSemanalVacio(['desayuno']);
    expect(Object.keys(semanal)).toHaveLength(7);
    expect(semanal.lunes).toHaveLength(1);
  });

  it('la lista de compras deduplica', () => {
    expect(sugerirListaCompras(['Avena', 'avena', 'Avena ', 'Huevo'])).toEqual(['Avena', 'avena', 'Huevo']);
  });
});

describe('versión del motor', () => {
  it('expone una constante de versión estable', () => {
    expect(VERSION_MOTOR_NUTRICION).toBeGreaterThanOrEqual(1);
  });
});
