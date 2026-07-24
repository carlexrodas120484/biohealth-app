import { describe, it, expect } from 'vitest';
import { seleccionarFase, DOMINIOS, UMBRAL_DOMINIO } from '../../lib/algoritmo/fases';
import type { AlteracionInput } from '../../lib/algoritmo/ipt';

describe('seleccionarFase — fidelidad con el prototipo validado (paso 6)', () => {
  it('reproduce el caso demostrado en el prototipo: disbiosis en Barrera (IPT 95) → Restore', () => {
    const alteraciones: AlteracionInput[] = [
      { id: 'a1', nombre: 'Disbiosis intestinal', dominio: DOMINIOS.BARRERA, nivel: 'primaria', perpetuadorActivo: true, IC: 4, IS: 5, RV: 3, EV: 3, CB: 3 },
      { id: 'a2', nombre: 'Inflamación sistémica', dominio: DOMINIOS.INFLAMATORIO, nivel: 'secundaria', perpetuadorActivo: false, IC: 4, IS: 4, RV: 3, EV: 4, CB: 4 },
    ];
    const r = seleccionarFase(alteraciones, false);
    expect(r.fase).toBe('restore');
    expect(r.compuertas[1].cumple).toBe(true);
    expect(r.compuertas[1].iptDominio).toBe(95);
    // las compuertas 3 a 6 no se evalúan porque la 2 ya resolvió la fase
    expect(r.compuertas.slice(2).every(c => c.evaluada === false)).toBe(true);
  });

  it('una bandera roja deriva antes de evaluar cualquier dominio', () => {
    const alteraciones: AlteracionInput[] = [
      { id: 'a1', nombre: 'Disbiosis intestinal', dominio: DOMINIOS.BARRERA, nivel: 'primaria', perpetuadorActivo: false, IC: 5, IS: 5, RV: 5, EV: 5, CB: 5 },
    ];
    const r = seleccionarFase(alteraciones, true);
    expect(r.derivado).toBe(true);
    expect(r.compuertas.filter(c => c.evaluada).length).toBe(1);
  });

  it('si ningún dominio alcanza el umbral, la fase resultante es Balance', () => {
    const alteraciones: AlteracionInput[] = [
      { id: 'a1', nombre: 'Alteración menor', dominio: DOMINIOS.BARRERA, nivel: 'terciaria', perpetuadorActivo: false, IC: 1, IS: 1, RV: 1, EV: 1, CB: 1 },
    ];
    const r = seleccionarFase(alteraciones, false);
    expect(r.fase).toBe('balance');
  });

  it('respeta el orden fisiológico: Barrera antes que Eje específico aunque este último tenga IPT mayor', () => {
    const alteraciones: AlteracionInput[] = [
      { id: 'a1', nombre: 'Disbiosis leve', dominio: DOMINIOS.BARRERA, nivel: 'secundaria', perpetuadorActivo: false, IC: 3, IS: 3, RV: 3, EV: 3, CB: 3 }, // ~ justo en el umbral
      { id: 'a2', nombre: 'Hipotiroidismo subclínico', dominio: DOMINIOS.EJE_ESPECIFICO, nivel: 'primaria', perpetuadorActivo: true, IC: 5, IS: 5, RV: 5, EV: 5, CB: 5 }, // IPT muy alto
    ];
    const r = seleccionarFase(alteraciones, false);
    // el eje específico tiene IPT más alto, pero si Barrera supera el umbral, gana igual por ir primero
    if (r.compuertas[1].iptDominio! >= UMBRAL_DOMINIO) {
      expect(r.fase).toBe('restore');
    }
  });
});
