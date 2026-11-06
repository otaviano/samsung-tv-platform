import { describe, expect, it } from 'vitest';
import { findNext, type Candidate, type Rect } from './geometry';

// Layout no formato do app: tiles 320x180, passo horizontal 344 (24 de margem).
const W = 320;
const H = 180;
const STEP = 344;
function row(name: string, y: number, count: number, x0 = 96): Candidate[] {
  return Array.from({ length: count }, (_, i) => ({ id: `${name}${i}`, rect: { x: x0 + i * STEP, y, w: W, h: H } }));
}
const rowA = row('A', 200, 5);
const rowB = row('B', 460, 2);
const rowC = row('C', 720, 5);
const all = [...rowA, ...rowB, ...rowC];
const rect = (id: string): Rect => all.find((c) => c.id === id)!.rect;
const next = (from: string, dir: Parameters<typeof findNext>[2], pool: Candidate[] = all) =>
  findNext(rect(from), pool.filter((c) => c.id !== from), dir)?.id ?? null;

describe('findNext — horizontal', () => {
  it('anda para o vizinho na mesma fileira', () => {
    expect(next('A1', 'right')).toBe('A2');
    expect(next('A1', 'left')).toBe('A0');
  });

  it('para na borda da fileira em vez de saltar na diagonal', () => {
    expect(next('A4', 'right')).toBeNull();
    expect(next('A0', 'left')).toBeNull();
    expect(next('B1', 'right')).toBeNull(); // C2.. existe à direita, mas em outra linha
  });
});

describe('findNext — vertical', () => {
  it('desce para o tile alinhado da fileira seguinte', () => {
    expect(next('A1', 'down')).toBe('B1');
    expect(next('B0', 'down')).toBe('C0');
  });

  it('fileira seguinte mais curta: vai ao tile mais próximo dela, não pula para a outra', () => {
    // A4 não tem tile alinhado em B; C4 está perfeitamente alinhado, mas mais longe.
    expect(next('A4', 'down')).toBe('B1');
  });

  it('sobe simetricamente', () => {
    expect(next('C3', 'up')).toBe('B1');
    expect(next('B0', 'up')).toBe('A0');
  });

  it('sem nada acima/abaixo retorna null', () => {
    expect(next('A2', 'up')).toBeNull();
    expect(next('C2', 'down')).toBeNull();
  });

  it('item largo (ex.: cabeçalho/hero) é alcançável de qualquer coluna', () => {
    const hero: Candidate = { id: 'hero', rect: { x: 96, y: 0, w: 1728, h: 150 } };
    const pool = [hero, ...all];
    expect(findNext(rect('A4'), pool.filter((c) => c.id !== 'A4'), 'up')?.id).toBe('hero');
    // Todos sobrepõem o hero (empate ortogonal) -> desempate pelo centro: A2 é o central.
    expect(findNext(hero.rect, rowA, 'down')?.id).toBe('A2');
  });
});

describe('findNext — tolerâncias de layout', () => {
  it('bordas encostadas (gap 0) e sobreposição sub-pixel contam como à frente', () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const touching: Candidate = { id: 't', rect: { x: 100, y: 0, w: 100, h: 100 } };
    const subpx: Candidate = { id: 's', rect: { x: 99.5, y: 0, w: 100, h: 100 } };
    expect(findNext(a, [touching], 'right')?.id).toBe('t');
    expect(findNext(a, [subpx], 'right')?.id).toBe('s');
  });

  it('candidato sobreposto de verdade não é "à frente"', () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const overlapping: Candidate = { id: 'o', rect: { x: 50, y: 0, w: 100, h: 100 } };
    expect(findNext(a, [overlapping], 'right')).toBeNull();
  });

  it('roçar 1px na vertical não conta como mesma linha', () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const grazing: Candidate = { id: 'g', rect: { x: 200, y: 99.5, w: 100, h: 100 } };
    expect(findNext(a, [grazing], 'right')).toBeNull();
  });
});
