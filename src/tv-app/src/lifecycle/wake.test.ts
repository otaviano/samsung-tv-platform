import { describe, expect, it } from 'vitest';
import { WakeDetector } from './wake';

describe('WakeDetector', () => {
  it('tiques regulares não disparam', () => {
    const w = new WakeDetector(0);
    for (let t = 1000; t <= 60_000; t += 1000) expect(w.tick(t)).toBeNull();
  });

  it('salto de relógio (standby) devolve o intervalo, uma vez', () => {
    const w = new WakeDetector(0);
    w.tick(1000);
    expect(w.tick(1000 + 33_384_000)).toBe(33_384_000);
    expect(w.tick(1000 + 33_385_000)).toBeNull();
  });

  it('atraso de tique abaixo do limiar (CPU ocupada) não dispara', () => {
    const w = new WakeDetector(0);
    expect(w.tick(9_000)).toBeNull();
  });
});
