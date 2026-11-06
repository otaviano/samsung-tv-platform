// Ponte entre o FocusManager (puro) e o Preact. Registro de alvos por id; cada alvo
// informa como medir seu retângulo (por padrão getBoundingClientRect).
import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { FocusManager, type Focusable } from './manager';
import type { Direction, Rect } from './geometry';
import { Key } from '../platform/keys';

interface Entry {
  group?: string;
  rect: () => Rect;
  onSelect?: () => void;
}

interface FocusApi {
  fm: FocusManager;
  register(id: string, entry: Entry): () => void;
}

const Ctx = createContext<FocusApi | null>(null);

const ARROWS: Record<number, Direction> = {
  [Key.Left]: 'left',
  [Key.Up]: 'up',
  [Key.Right]: 'right',
  [Key.Down]: 'down',
};

export function FocusRoot({ children, onMove }: { children: ComponentChildren; onMove?: (id: string | null) => void }) {
  const registry = useRef(new Map<string, Entry>());
  const api = useMemo<FocusApi>(() => {
    const fm = new FocusManager(() => {
      const out: Focusable[] = [];
      registry.current.forEach((e, id) => out.push({ id, group: e.group, rect: e.rect() }));
      return out;
    });
    return {
      fm,
      register(id, entry) {
        registry.current.set(id, entry);
        return () => registry.current.delete(id);
      },
    };
  }, []);

  useEffect(() => {
    api.fm.ensure();
    const off = onMove ? api.fm.subscribe(onMove) : undefined;
    const onKey = (e: KeyboardEvent) => {
      const dir = ARROWS[e.keyCode];
      if (dir) {
        e.preventDefault();
        api.fm.move(dir);
      } else if (e.keyCode === Key.Enter) {
        const id = api.fm.focused;
        if (id) registry.current.get(id)?.onSelect?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      off?.();
    };
  }, [api]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useFocusApi(): FocusApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useFocusApi fora de <FocusRoot>');
  return api;
}

/** Registra um alvo e devolve se ele está focado. */
export function useFocusable(id: string, entry: Entry): boolean {
  const { fm, register } = useFocusApi();
  const [focused, setFocused] = useState(fm.focused === id);
  const latest = useRef(entry);
  latest.current = entry;

  useEffect(() => {
    const off = register(id, {
      group: entry.group,
      rect: () => latest.current.rect(),
      onSelect: () => latest.current.onSelect?.(),
    });
    const unsub = fm.subscribe((f) => setFocused(f === id));
    setFocused(fm.focused === id);
    return () => {
      off();
      unsub();
    };
  }, [id, entry.group]);

  return focused;
}
