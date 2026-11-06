// Fileira horizontal com rolagem por transform. A geometria entregue ao motor de foco é a
// LÓGICA (posição no trilho menos o deslocamento-alvo), não a renderizada: durante a
// transição do transform, getBoundingClientRect devolveria posições intermediárias e um
// clique rápido decidiria com geometria errada.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useFocusApi, useFocusable } from '../focus/FocusRoot';
import type { Rect } from '../focus/geometry';

export interface TileData {
  id: string;
  label: string;
}

interface Props {
  id: string;
  title: string;
  items: TileData[];
  onSelect: (item: TileData) => void;
}

export function Row({ id, title, items, onSelect }: Props) {
  const { fm } = useFocusApi();
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLDivElement>());
  const offsetTarget = useRef(0); // atualizado SÍNCRONO, antes do próximo measure()
  const [offset, setOffset] = useState(0);

  useEffect(
    () =>
      fm.subscribe((focusedId) => {
        const el = focusedId ? els.current.get(focusedId) : undefined;
        const vp = viewport.current;
        const tr = track.current;
        if (!el || !vp || !tr) return;
        // Coordenadas no trilho. Área útil = viewport menos o padding (margem de segurança),
        // simétrico: o trilho começa em tr.offsetLeft.
        const visible = vp.clientWidth - 2 * tr.offsetLeft;
        const left = el.offsetLeft;
        const right = left + el.offsetWidth;
        let next = offsetTarget.current;
        if (right > next + visible) next = right - visible;
        if (left < next) next = left;
        if (next !== offsetTarget.current) {
          offsetTarget.current = next;
          setOffset(next);
        }
      }),
    [fm],
  );

  const logicalRect = (tileId: string) => (): Rect => {
    const el = els.current.get(tileId);
    const vp = viewport.current;
    const tr = track.current;
    if (!el || !vp || !tr) return { x: 0, y: 0, w: 0, h: 0 };
    // offsetLeft/Top ignoram transform: geometria estável mesmo no meio da transição.
    const v = vp.getBoundingClientRect();
    return {
      x: v.left + tr.offsetLeft + el.offsetLeft - offsetTarget.current,
      y: v.top + tr.offsetTop + el.offsetTop,
      w: el.offsetWidth,
      h: el.offsetHeight,
    };
  };

  return (
    <section class="row">
      <h2 class="row__title">{title}</h2>
      <div class="row__viewport" ref={viewport}>
        <div class="row__track" ref={track} style={{ transform: `translateX(${-offset}px)` }}>
          {items.map((it) => (
            <Tile
              key={it.id}
              item={it}
              group={id}
              rect={logicalRect(it.id)}
              onSelect={() => onSelect(it)}
              setEl={(el) => (el ? els.current.set(it.id, el) : els.current.delete(it.id))}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Tile(props: {
  item: TileData;
  group: string;
  rect: () => Rect;
  onSelect: () => void;
  setEl: (el: HTMLDivElement | null) => void;
}) {
  const focused = useFocusable(props.item.id, { group: props.group, rect: props.rect, onSelect: props.onSelect });
  return (
    <div class={focused ? 'tile is-focused' : 'tile'} ref={props.setEl}>
      {props.item.label}
    </div>
  );
}
