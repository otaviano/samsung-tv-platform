// Navegação espacial pura: dados retângulos e uma direção, qual é o próximo alvo.
// Sem DOM, sem Preact — testável em isolamento (ADR-0003).
//
// Regras (escolhidas para UI em fileiras, controle remoto):
//  1. Só candidatos estritamente À FRENTE na direção (borda próxima além da borda de saída).
//  2. Horizontal (left/right): exige sobreposição vertical com o atual — fica na mesma
//     linha. No fim da fileira, não salta na diagonal: retorna null.
//  3. Vertical (up/down), duas fases: (a) acha a "linha" mais próxima ao longo do eixo;
//     (b) dentro dela, o candidato mais alinhado no eixo ortogonal. Evita que ↓ pule uma
//     fileira próxima por haver outra mais distante melhor alinhada.

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Candidate<Id = string> {
  id: Id;
  rect: Rect;
}

// Tolerância para bordas que encostam/sobrepõem por arredondamento de layout.
const EPS = 1;

interface Span {
  start: number;
  end: number;
}

function along(r: Rect, dir: Direction): Span {
  return dir === 'left' || dir === 'right' ? { start: r.x, end: r.x + r.w } : { start: r.y, end: r.y + r.h };
}

function across(r: Rect, dir: Direction): Span {
  return dir === 'left' || dir === 'right' ? { start: r.y, end: r.y + r.h } : { start: r.x, end: r.x + r.w };
}

/** Distância (>= 0) da borda de saída do atual até a borda de entrada do candidato. */
function primaryGap(cur: Rect, c: Rect, dir: Direction): number | null {
  const a = along(cur, dir);
  const b = along(c, dir);
  const forward = dir === 'right' || dir === 'down';
  const gap = forward ? b.start - a.end : a.start - b.end;
  return gap >= -EPS ? Math.max(0, gap) : null;
}

/** Distância entre intervalos no eixo ortogonal; 0 se sobrepõem. */
function crossGap(cur: Rect, c: Rect, dir: Direction): number {
  const a = across(cur, dir);
  const b = across(c, dir);
  if (b.end <= a.start) return a.start - b.end;
  if (b.start >= a.end) return b.start - a.end;
  return 0;
}

function crossOverlaps(cur: Rect, c: Rect, dir: Direction): boolean {
  const a = across(cur, dir);
  const b = across(c, dir);
  return Math.min(a.end, b.end) - Math.max(a.start, b.start) > EPS;
}

function crossCenterOffset(cur: Rect, c: Rect, dir: Direction): number {
  const a = across(cur, dir);
  const b = across(c, dir);
  return Math.abs((a.start + a.end) / 2 - (b.start + b.end) / 2);
}

export function findNext<Id>(
  current: Rect,
  candidates: ReadonlyArray<Candidate<Id>>,
  dir: Direction,
): Candidate<Id> | null {
  const horizontal = dir === 'left' || dir === 'right';

  const ahead: Array<{ c: Candidate<Id>; gap: number }> = [];
  for (const c of candidates) {
    const gap = primaryGap(current, c.rect, dir);
    if (gap === null) continue;
    if (horizontal && !crossOverlaps(current, c.rect, dir)) continue;
    ahead.push({ c, gap });
  }
  if (ahead.length === 0) return null;

  // Fase (a): a linha mais próxima = candidatos cuja faixa ao longo do eixo sobrepõe a do
  // candidato mais próximo. Na horizontal isso degenera em "o mais próximo", como deve.
  let nearest = ahead[0]!;
  for (const a of ahead) if (a.gap < nearest.gap) nearest = a;
  const line = along(nearest.c.rect, dir);
  const inLine = ahead.filter(({ c }) => {
    const s = along(c.rect, dir);
    return Math.min(s.end, line.end) - Math.max(s.start, line.start) > EPS;
  });

  // Fase (b): dentro da linha, menor afastamento ortogonal; desempate pelo centro, depois
  // pela distância ao longo do eixo.
  let best = inLine[0]!;
  for (const a of inLine) {
    const d = crossGap(current, a.c.rect, dir) - crossGap(current, best.c.rect, dir);
    if (d < 0) best = a;
    else if (d === 0) {
      const o = crossCenterOffset(current, a.c.rect, dir) - crossCenterOffset(current, best.c.rect, dir);
      if (o < 0 || (o === 0 && a.gap < best.gap)) best = a;
    }
  }
  return best.c;
}
