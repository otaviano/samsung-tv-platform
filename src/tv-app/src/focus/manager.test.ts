import { describe, expect, it } from 'vitest';
import { FocusManager, type Focusable } from './manager';

const W = 320;
const H = 180;
const STEP = 344;
function row(name: string, y: number, count: number): Focusable[] {
  return Array.from({ length: count }, (_, i) => ({ id: `${name}${i}`, group: name, rect: { x: 96 + i * STEP, y, w: W, h: H } }));
}

function setup(nodes: Focusable[]) {
  let layout = nodes;
  const fm = new FocusManager(() => layout);
  return { fm, setLayout: (n: Focusable[]) => (layout = n) };
}

describe('FocusManager', () => {
  it('ensure() foca o primeiro item em ordem de leitura', () => {
    const { fm } = setup([...row('B', 460, 3), ...row('A', 200, 3)]);
    fm.ensure();
    expect(fm.focused).toBe('A0');
  });

  it('volta ao último item focado ao reentrar numa fileira', () => {
    const { fm } = setup([...row('A', 200, 5), ...row('B', 460, 5)]);
    fm.focus('A3');
    fm.move('down');
    expect(fm.focused).toBe('B3');
    fm.move('left');
    fm.move('left'); // B1 — geometricamente o mais próximo acima seria A1
    fm.move('up');
    expect(fm.focused).toBe('A3');
  });

  it('memória ignorada se o item lembrado saiu do layout', () => {
    const a = row('A', 200, 5);
    const b = row('B', 460, 5);
    const { fm, setLayout } = setup([...a, ...b]);
    fm.focus('A4');
    fm.move('down');
    fm.move('left');
    setLayout([...a.slice(0, 3), ...b]); // A4 removido
    fm.move('up');
    expect(fm.focused).toBe('A2'); // B3 -> mais próximo em A
  });

  it('move() retorna false na borda e mantém o foco', () => {
    const { fm } = setup(row('A', 200, 3));
    fm.focus('A2');
    expect(fm.move('right')).toBe(false);
    expect(fm.focused).toBe('A2');
  });

  it('notifica assinantes e permite cancelar', () => {
    const { fm } = setup(row('A', 200, 3));
    const seen: Array<string | null> = [];
    const off = fm.subscribe((id) => seen.push(id));
    fm.focus('A0');
    fm.move('right');
    off();
    fm.move('right');
    expect(seen).toEqual(['A0', 'A1']);
  });

  it('move() sem foco atual faz ensure()', () => {
    const { fm } = setup(row('A', 200, 3));
    expect(fm.move('down')).toBe(true);
    expect(fm.focused).toBe('A0');
  });
});
