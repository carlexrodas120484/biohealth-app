import { describe, it, expect } from 'vitest';
import { RUTA_POR_PASO, siguientePaso } from '@/lib/flujo/pasos';

describe('lib/flujo/pasos — orden canónico del flujo clínico', () => {
  it('recorre los 11 pasos en el orden historia → ... → informes', () => {
    expect(RUTA_POR_PASO).toEqual([
      'historia', 'cuestionario', 'bioescaner', 'diagnostico', 'ipt',
      'fase', 'objetivos', 'formulacion', 'nutricion', 'control', 'informes',
    ]);
  });

  it('devuelve el paso siguiente para cada paso intermedio', () => {
    expect(siguientePaso('historia')).toBe('cuestionario');
    expect(siguientePaso('cuestionario')).toBe('bioescaner');
    expect(siguientePaso('diagnostico')).toBe('ipt');
    expect(siguientePaso('ipt')).toBe('fase');
    expect(siguientePaso('fase')).toBe('objetivos');
    expect(siguientePaso('objetivos')).toBe('formulacion');
    expect(siguientePaso('formulacion')).toBe('nutricion');
    expect(siguientePaso('nutricion')).toBe('control');
    expect(siguientePaso('control')).toBe('informes');
  });

  it('devuelve null en el último paso (informes)', () => {
    expect(siguientePaso('informes')).toBeNull();
  });

  it('devuelve null para un paso desconocido, sin lanzar excepción', () => {
    expect(siguientePaso('no-existe')).toBeNull();
  });
});
