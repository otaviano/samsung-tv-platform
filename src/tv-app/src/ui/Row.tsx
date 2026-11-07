// Fileira horizontal com rolagem por transform. A geometria entregue ao motor de foco é a
// LÓGICA (posição no trilho menos o deslocamento-alvo), não a renderizada: durante a
// transição do transform, getBoundingClientRect devolveria posições intermediárias e um
// clique rápido decidiria com geometria errada.
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useFocusApi, useFocusable } from '../focus/FocusRoot';
import type { Rect } from '../focus/geometry';
import { report } from '../platform/report';
import { monogramHue } from './icons';

export interface TileData {
  id: string;
  label: string;
  /** Caminho de imagem (ícone do app). */
  icon?: string;
  /** Ícone próprio (SVG). Tem precedência sobre `icon`. */
  glyph?: () => JSX.Element;
  /** Oculto (visível só no modo de organização). */
  dimmed?: boolean;
  /** Sendo movido (modo de organização). */
  moving?: boolean;
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

  const ensureVisible = (focusedId: string | null) => {
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
  };

  useEffect(() => fm.subscribe(ensureVisible), [fm]);
  // Reordenação muda a posição do tile focado sem mudar o foco.
  useEffect(() => ensureVisible(fm.focused), [items]);

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
  const [pressed, setPressed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  const focused = useFocusable(props.item.id, {
    group: props.group,
    rect: props.rect,
    onSelect: () => {
      // Feedback imediato: sem ele, OK parece "não fazer nada" (observado no device, v0.2).
      setPressed(true);
      setTimeout(() => setPressed(false), 180);
      props.onSelect();
    },
  });
  const { icon, glyph, label, dimmed, moving } = props.item;
  const cls =
    'tile' +
    (focused ? ' is-focused' : '') +
    (pressed ? ' is-pressed' : '') +
    (dimmed ? ' is-dimmed' : '') +
    (moving ? ' is-moving' : '');
  const showImg = !glyph && icon && !iconFailed;
  return (
    <div class={cls} ref={props.setEl}>
      <div
        class={'tile__card' + (glyph ? ' tile__card--glyph' : '') + (!glyph && !showImg ? ' tile__card--mono' : '')}
        style={!glyph && !showImg ? { backgroundColor: `hsl(${monogramHue(props.item.id)}, 38%, 30%)` } : undefined}
      >
        {glyph ? (
          glyph()
        ) : showImg ? (
          <img
            class="tile__icon"
            src={icon}
            alt=""
            onLoad={() => report('/icon', { id: props.item.id, ok: true })}
            onError={() => {
              // Netflix e Prime Video (pré-instalados de sistema) falham aqui; o ícone do pacote
              // também não serve (mesmo caminho / vazio) — medido em 2026-11-06.
              report('/icon', { id: props.item.id, ok: false, src: icon });
              setIconFailed(true);
            }}
          />
        ) : (
          <span class="tile__mono">{label.trim().charAt(0).toUpperCase()}</span>
        )}
        {dimmed ? <span class="tile__badge">oculto</span> : null}
        {moving ? <span class="tile__badge tile__badge--move">◀ ▶</span> : null}
      </div>
      <span class="tile__label">{label}</span>
    </div>
  );
}
