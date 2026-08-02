import { describe, it, expect } from 'vitest';
import {
  generarInformeHtml, tieneContenido, nombreArchivo, nombreArchivoConEtiqueta, piePaginaHtml,
  TIPOS_INFORME, ETIQUETA_TIPO_INFORME, type ContextoInforme,
} from '@/lib/pdf/informes';

const PACIENTE_BASE = {
  nombre: 'María José', apellido: 'Pérez Núñez', documento: '1234567',
  fechaNacimiento: '1990-01-01', sexo: 'femenino', telefono: '0973000000',
  motivoConsulta: 'Fatiga crónica',
};

function ctxVacio(): ContextoInforme {
  return {
    paciente: { nombre: 'Ana', apellido: 'Gómez' },
    generadoEn: '2026-08-02T10:00:00.000Z',
    version: 1,
  };
}

function ctxCompleto(): ContextoInforme {
  return {
    paciente: PACIENTE_BASE,
    historia: {
      camposNarrativos: [{ etiqueta: 'Enfermedad actual', valor: 'Cansancio persistente hace 6 meses' }],
      resumenCuestionario: {
        sistemas: [{ sistema: 'Digestivo', puntos: 10, maximo: 20, porcentaje: 50, severidad: 'moderada' }],
        topSintomas: [{ id: 'x', texto: 'Distensión abdominal', sistema: 'Digestivo', valor: 8 }],
        advertencia: 'Cribado, no diagnóstico.',
      },
    },
    diagnostico: {
      patrones: [{ nombre: 'Disbiosis intestinal', nivel: 'alta', prioridad: 'alta' }],
      impresion: 'Cuadro compatible con disfunción digestiva.',
      estudios: 'Coprocultivo pendiente.',
    },
    planTerapeutico: {
      fases: [{ nombre: 'Restore', objetivo: 'Reparar mucosa', estado: 'activa', prioridad: 'alta', duracionEstimadaSemanas: 4, observacionesMedico: 'Iniciar de inmediato.' }],
    },
    formulacion: {
      fase: 'restore', objetivos: ['Reparar mucosa'],
      items: [{ nombre: 'L-glutamina', dosis: '5 g', presentacion: 'polvo', cantidad: '150 g', indicacion: '1 medida en ayunas', observaciones: 'Diluir en agua' }],
      ingredientes: [{ nombre: 'L-glutamina', dosisPorTomaMg: 5000, vecesPorDia: 1, horario: 'ayunas' }],
      firmadaEn: '2026-08-01T00:00:00.000Z', versionReglas: 'v1.0',
    },
    nutricion: {
      objetivoClinico: 'antiinflamatorio',
      calculos: { objetivoCaloricoKcal: 1800, proteinaG: 90, carbohidratosG: 180, grasasG: 60, fibraG: 30, aguaMl: 2000 },
      plan: {
        numeroComidas: 4,
        menuDiario: [{ horario: 'desayuno', descripcion: 'Avena con frutas', alternativas: ['Huevo revuelto'] }],
        alimentosRecomendados: ['Vegetales de hoja verde'],
        alimentosALimitar: ['Café'],
        alimentosAEvitar: ['Azúcar refinada'],
        listaCompras: ['Avena', 'Frutas'],
        observaciones: 'Evitar comer tarde en la noche.',
        duracionDias: 30,
      },
      restricciones: { alergiasAlimentarias: ['Maní'], celiaquia: false, vegetarianismo: true, veganismo: false },
      advertencias: ['Revisar tolerancia a lácteos.'],
    },
    generadoEn: '2026-08-02T10:00:00.000Z',
    version: 2,
  };
}

describe('lib/pdf/informes — generación de HTML', () => {
  it('genera los 6 tipos de informe sin lanzar excepciones', () => {
    const ctx = ctxCompleto();
    for (const tipo of TIPOS_INFORME) {
      const html = generarInformeHtml(tipo, ctx);
      expect(html).toContain('<!doctype html>');
      expect(html).toContain(ETIQUETA_TIPO_INFORME[tipo]);
    }
  });

  it('no muestra secciones vacías: informe clínico completo sin historia ni diagnóstico omite esos encabezados', () => {
    const ctx = ctxVacio();
    const html = generarInformeHtml('informe_clinico_completo', ctx);
    expect(html).not.toContain('Historia clínica y cuestionario funcional');
    expect(html).not.toContain('Diagnóstico funcional confirmado');
  });

  it('resumen diagnóstico incluye sólo patrones confirmados y su nivel/prioridad', () => {
    const html = generarInformeHtml('resumen_diagnostico', ctxCompleto());
    expect(html).toContain('Disbiosis intestinal');
    expect(html).toContain('alta');
  });

  it('plan terapéutico lista únicamente las fases recibidas (el filtrado por estado ya ocurrió antes de llegar acá)', () => {
    const html = generarInformeHtml('plan_terapeutico', ctxCompleto());
    expect(html).toContain('Restore');
    expect(html).toContain('Reparar mucosa');
  });

  it('receta ortomolecular usa exactamente la dosis del item, sin recalcular', () => {
    const html = generarInformeHtml('receta_ortomolecular', ctxCompleto());
    expect(html).toContain('L-glutamina');
    expect(html).toContain('5 g');
    expect(html).toContain('150 g');
    expect(html).toContain('1 medida en ayunas');
  });

  it('plan nutricional muestra calorías, macros, menú, alimentos y advertencias', () => {
    const html = generarInformeHtml('plan_nutricional', ctxCompleto());
    expect(html).toContain('1800');
    expect(html).toContain('Avena con frutas');
    expect(html).toContain('Vegetales de hoja verde');
    expect(html).toContain('Revisar tolerancia a lácteos.');
  });

  it('informe integrado combina todas las secciones aprobadas con salto de página entre ellas', () => {
    const html = generarInformeHtml('informe_integrado', ctxCompleto());
    expect(html).toContain('Diagnóstico funcional confirmado');
    expect(html).toContain('Plan terapéutico');
    expect(html).toContain('Formulación ortomolecular aprobada');
    expect(html).toContain('Plan nutricional aprobado');
    expect(html).toContain('seccion-nueva');
  });

  it('escapa caracteres especiales/HTML en campos de texto libre', () => {
    const ctx = ctxCompleto();
    ctx.diagnostico!.impresion = '<script>alert(1)</script> & "comillas"';
    const html = generarInformeHtml('resumen_diagnostico', ctx);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('documento extenso: informe integrado con muchas fases/ítems no falla y contiene todos los bloques', () => {
    const ctx = ctxCompleto();
    ctx.planTerapeutico = {
      fases: Array.from({ length: 20 }, (_, i) => ({
        nombre: `Fase ${i + 1}`, objetivo: `Objetivo ${i + 1}`, estado: 'activa', prioridad: 'media',
        duracionEstimadaSemanas: 4, observacionesMedico: '',
      })),
    };
    const html = generarInformeHtml('informe_integrado', ctx);
    expect(html).toContain('Fase 1');
    expect(html).toContain('Fase 20');
  });
});

describe('lib/pdf/informes — tieneContenido', () => {
  it('devuelve false para un contexto sin ningún dato aprobado/confirmado', () => {
    const ctx = ctxVacio();
    for (const tipo of TIPOS_INFORME) {
      expect(tieneContenido(tipo, ctx)).toBe(false);
    }
  });

  it('devuelve true cuando hay datos para ese tipo específico', () => {
    const ctx = ctxCompleto();
    for (const tipo of TIPOS_INFORME) {
      expect(tieneContenido(tipo, ctx)).toBe(true);
    }
  });

  it('informe integrado es true si al menos un módulo tiene datos, aunque los demás estén vacíos', () => {
    const ctx = ctxVacio();
    ctx.nutricion = ctxCompleto().nutricion;
    expect(tieneContenido('informe_integrado', ctx)).toBe(true);
    expect(tieneContenido('plan_terapeutico', ctx)).toBe(false);
  });
});

describe('lib/pdf/informes — nombre de archivo', () => {
  it('sigue el formato BioHealth_Apellido_Nombre_TipoDocumento_YYYY-MM-DD.pdf', () => {
    const nombre = nombreArchivo({ nombre: 'Juan', apellido: 'Perez' }, 'plan_nutricional', '2026-08-02T10:00:00.000Z');
    expect(nombre).toBe('BioHealth_Perez_Juan_Plan_nutricional_2026-08-02.pdf');
  });

  it('quita acentos y caracteres especiales del nombre/apellido', () => {
    const nombre = nombreArchivo({ nombre: 'María José', apellido: 'Núñez Ávalos' }, 'informe_integrado', '2026-08-02T10:00:00.000Z');
    expect(nombre).not.toMatch(/[áéíóúñÁÉÍÓÚÑ]/);
    expect(nombre.startsWith('BioHealth_Nunez_Avalos_Maria_Jose_')).toBe(true);
  });

  it('usa un nombre de reemplazo si falta apellido o nombre, sin romper el formato', () => {
    const nombre = nombreArchivo({ nombre: '' , apellido: null }, 'resumen_diagnostico', '2026-08-02T10:00:00.000Z');
    expect(nombre).toContain('SinApellido');
    expect(nombre).toContain('SinNombre');
    expect(nombre.endsWith('.pdf')).toBe(true);
  });

  it('nombreArchivoConEtiqueta acepta una etiqueta arbitraria (para los tipos legacy)', () => {
    const nombre = nombreArchivoConEtiqueta({ nombre: 'Juan', apellido: 'Perez' }, 'Receta para botica', '2026-08-02T10:00:00.000Z');
    expect(nombre).toBe('BioHealth_Perez_Juan_Receta_para_botica_2026-08-02.pdf');
  });
});

describe('lib/pdf/informes — pie de página', () => {
  it('incluye numeración de página nativa (pageNumber/totalPages)', () => {
    const html = piePaginaHtml();
    expect(html).toContain('pageNumber');
    expect(html).toContain('totalPages');
    expect(html).toContain('confidencial');
  });
});
