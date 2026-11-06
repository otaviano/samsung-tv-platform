// Estado de foco sobre a geometria pura: alvo atual, memória por grupo, e quem mede.
// Também independente de Preact: recebe uma função que devolve os retângulos atuais.

import { findNext, type Direction, type Rect } from './geometry';

export interface Focusable {
  id: string;
  /** Agrupamento lógico (ex.: uma fileira). Ao reentrar, volta ao último focado nele. */
  group?: string;
  rect: Rect;
}

export class FocusManager {
  private current: string | null = null;
  private moved = false;
  private readonly lastInGroup = new Map<string, string>();
  private readonly listeners = new Set<(id: string | null) => void>();

  constructor(private readonly measure: () => Focusable[]) {}

  get focused(): string | null {
    return this.current;
  }

  /** true depois do primeiro move(): conteúdo que chega depois não deve roubar o foco. */
  get userHasMoved(): boolean {
    return this.moved;
  }

  subscribe(fn: (id: string | null) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  focus(id: string | null): void {
    if (id === this.current) return;
    this.current = id;
    if (id) {
      const node = this.measure().find((n) => n.id === id);
      if (node?.group) this.lastInGroup.set(node.group, id);
    }
    this.listeners.forEach((fn) => fn(id));
  }

  /** Garante foco em algo válido (início, ou o atual sumiu do layout). */
  ensure(): void {
    const nodes = this.measure();
    if (this.current && nodes.some((n) => n.id === this.current)) return;
    const first = nodes.slice().sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)[0];
    this.focus(first ? first.id : null);
  }

  /** Move o foco. Retorna false se não há destino (o chamador pode tratar a borda). */
  move(dir: Direction): boolean {
    this.moved = true;
    const nodes = this.measure();
    const cur = nodes.find((n) => n.id === this.current);
    if (!cur) {
      this.ensure();
      return this.current !== null;
    }
    const next = findNext(cur.rect, nodes.filter((n) => n.id !== cur.id), dir);
    if (!next) return false;

    // Memória de grupo: entrando em OUTRO grupo que já teve foco, volta ao último dele —
    // desde que ainda exista no layout.
    const target = nodes.find((n) => n.id === next.id)!;
    let id = target.id;
    if (target.group && target.group !== cur.group) {
      const remembered = this.lastInGroup.get(target.group);
      if (remembered && nodes.some((n) => n.id === remembered)) id = remembered;
    }
    this.focus(id);
    return true;
  }
}
