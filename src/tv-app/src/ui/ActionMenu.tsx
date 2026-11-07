// Menu modal pequeno (modo de organização). Captura teclas em `window` na fase de captura
// e interrompe a propagação: o FocusRoot e o BACK global (em document) não veem a tecla.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Key } from '../platform/keys';

export interface MenuOption {
  label: string;
  run: () => void;
}

export function ActionMenu({ title, options, onClose }: { title: string; options: MenuOption[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const cur = useRef(0);
  cur.current = idx;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.keyCode === Key.Up) setIdx((i) => (i + options.length - 1) % options.length);
      else if (e.keyCode === Key.Down) setIdx((i) => (i + 1) % options.length);
      else if (e.keyCode === Key.Enter) {
        options[cur.current]?.run();
      } else if (e.keyCode === Key.Back) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [options, onClose]);
  return (
    <div class="menu-scrim">
      <div class="menu">
        <div class="menu__title">{title}</div>
        {options.map((o, i) => (
          <div key={o.label} class={'menu__item' + (i === idx ? ' is-focused' : '')}>
            {o.label}
          </div>
        ))}
      </div>
    </div>
  );
}
