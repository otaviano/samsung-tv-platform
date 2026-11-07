import './app.css';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { FocusRoot, useFocusApi } from '../focus/FocusRoot';
import { Row, type TileData } from './Row';
import { StatusBar } from './StatusBar';
import { ActionMenu, type MenuOption } from './ActionMenu';
import { IconArrange, IconSettings, IconSources } from './icons';
import { report } from '../platform/report';
import { SELF_ID, launchApp, listApps, type InstalledApp } from '../platform/apps';
import { SYSTEM_APPS } from '../platform/system';
import { Key } from '../platform/keys';
import { curate } from '../data/curate';
import { loadCachedApps, saveCachedApps } from '../data/appsCache';
import { loadFocus, saveFocus } from '../data/focusMemory';
import { arrange, loadPrefs, move, savePrefs, toggleHidden, type AppPrefs } from '../data/appPrefs';
import type { Background } from '../lifecycle/background';

const ARRANGE_ID = 'sys.arrange';

/** Cache primeiro; getAppsInfo (lento, ~3 s) atualiza em segundo plano. */
function useApps(): { apps: InstalledApp[] | null; error: string | null } {
  const [apps, setApps] = useState<InstalledApp[] | null>(() => loadCachedApps());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const t0 = performance.now();
    listApps()
      .then((all) => {
        const curated = curate(all, SELF_ID);
        report('/apps', { ms: Math.round(performance.now() - t0), total: all.length, curated: curated.map((a) => a.id), icons: curated.map((a) => a.iconPath) });
        saveCachedApps(curated);
        setApps(curated);
      })
      .catch((e: Error) => {
        report('/apps', { error: e.message });
        setError(e.message);
      });
  }, []);
  return { apps, error };
}

function open(bg: Background | null, id: string) {
  const t0 = performance.now();
  report('/select', { id });
  if (bg) bg.watchLaunch(id);
  launchApp(id)
    .then(() => report('/launch', { id, ok: true, ms: Math.round(performance.now() - t0) }))
    .catch((e: Error) => {
      if (bg) bg.cancelWatch();
      report('/launch', { id, ok: false, error: e.message });
    });
}

// Fontes e Configurações fora da fileira até resolver o backlog: abrem e fecham sozinhas
// em < 2 s (2026-11-07, docs/change-log.md). Hipótese: tv-viewer travado.
const SYSTEM_READY = false;
const SYSTEM_TILES: TileData[] = [
  ...(SYSTEM_READY
    ? [
        { id: SYSTEM_APPS.sources, label: 'Fontes', glyph: IconSources },
        { id: SYSTEM_APPS.settings, label: 'Configurações', glyph: IconSettings },
      ]
    : []),
  { id: ARRANGE_ID, label: 'Organizar apps', glyph: IconArrange },
];

const toTile = (a: InstalledApp, prefs: AppPrefs, moving: string | null): TileData => ({
  id: a.id,
  label: a.name,
  icon: a.iconPath || undefined,
  dimmed: prefs.hidden.indexOf(a.id) !== -1,
  moving: a.id === moving,
});

function Home({ bg }: { bg: Background }) {
  const { fm } = useFocusApi();
  const { apps, error } = useApps();
  const [prefs, setPrefsState] = useState<AppPrefs>(loadPrefs);
  const [editing, setEditing] = useState(false);
  const [menuFor, setMenuFor] = useState<InstalledApp | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const setPrefs = (p: AppPrefs) => {
    savePrefs(p);
    setPrefsState(p);
    report('/prefs', { order: p.order.length, hidden: p.hidden });
  };

  const shown = useMemo(() => (apps ? arrange(apps, prefs, editing) : []), [apps, prefs, editing]);
  const tiles = shown.map((a) => toTile(a, prefs, moving));
  const firstApp = shown[0]?.id;

  // Cada volta à frente recarrega a página: restaurar o último foco se ele ainda existe;
  // senão o primeiro app (que pode chegar depois do primeiro render).
  useEffect(() => {
    if (fm.userHasMoved) return;
    const saved = loadFocus();
    if (saved && fm.has(saved)) fm.focus(saved);
    else if (firstApp) fm.focus(firstApp);
  }, [firstApp]);

  // Modo mover: ◀▶ trocam de posição; OK/BACK concluem. Captura em window (antes do
  // FocusRoot e do BACK global, ambos em document).
  useEffect(() => {
    if (!moving) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.keyCode;
      if (k !== Key.Left && k !== Key.Right && k !== Key.Enter && k !== Key.Back && k !== Key.Up && k !== Key.Down) return;
      e.stopPropagation();
      e.preventDefault();
      if (k === Key.Left || k === Key.Right) {
        setPrefs(move(prefs, shown.map((a) => a.id), moving, k === Key.Left ? -1 : 1));
      } else if (k === Key.Enter || k === Key.Back) {
        setMoving(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [moving, prefs, shown]);

  // BACK no modo de organização sai do modo (não esconde a home).
  useEffect(() => {
    if (!editing || moving || menuFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.keyCode !== Key.Back) return;
      e.stopPropagation();
      e.preventDefault();
      setEditing(false);
      fm.focus(ARRANGE_ID);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [editing, moving, menuFor]);

  const onApp = (t: TileData) => {
    if (!editing) return open(bg, t.id);
    const a = shown.find((x) => x.id === t.id);
    if (a) setMenuFor(a);
  };

  const onSystem = (t: TileData) => {
    if (t.id === ARRANGE_ID) {
      setEditing(true);
      report('/arrange', { on: true });
      if (firstApp) fm.focus(firstApp);
      return;
    }
    // Configurações/Fontes abrem POR CIMA da home (E10): nada a observar.
    open(null, t.id);
  };

  const menuOptions: MenuOption[] = menuFor
    ? [
        { label: 'Mover', run: () => { setMoving(menuFor.id); setMenuFor(null); } },
        {
          label: prefs.hidden.indexOf(menuFor.id) === -1 ? 'Ocultar da home' : 'Mostrar na home',
          run: () => { setPrefs(toggleHidden(prefs, menuFor.id)); setMenuFor(null); },
        },
        { label: 'Cancelar', run: () => setMenuFor(null) },
      ]
    : [];

  return (
    <main class={'home' + (editing ? ' is-editing' : '')}>
      <StatusBar />
      {editing ? (
        <div class="hint">
          Organizando apps · <b>OK</b> opções do app · <b>BACK</b> concluir
        </div>
      ) : null}
      {tiles.length > 0 ? <Row id="apps" title="Apps" items={tiles} onSelect={onApp} /> : null}
      {!editing ? <Row id="system" title="Sistema" items={SYSTEM_TILES} onSelect={onSystem} /> : null}
      {error ? <div class="error">Não foi possível listar os apps: {error}</div> : null}
      {__DEV__ ? <div class="devtag">v0.5 · dev</div> : null}
      {menuFor ? <ActionMenu title={menuFor.name} options={menuOptions} onClose={() => setMenuFor(null)} /> : null}
    </main>
  );
}

export function App({ bg }: { bg: Background }) {
  return (
    <FocusRoot
      onMove={(id) => {
        saveFocus(id);
        report('/focus', { id });
        if (__DEV__) measureFrames(id);
      }}
    >
      <Home bg={bg} />
    </FocusRoot>
  );
}

/** Só dev: quadros durante a transição de foco (~400 ms). Intervalo > 34 ms = quadro perdido. */
let lastKeyAt = 0;
if (__DEV__) document.addEventListener('keydown', () => (lastKeyAt = performance.now()), true);
function measureFrames(id: string | null) {
  const start = performance.now();
  const keyToFocus = lastKeyAt ? Math.round(start - lastKeyAt) : null;
  const gaps: number[] = [];
  let prev = start;
  let firstFrame: number | null = null;
  const tick = (t: number) => {
    if (firstFrame === null) firstFrame = Math.round(t - (lastKeyAt || start));
    gaps.push(t - prev);
    prev = t;
    if (t - start < 400) requestAnimationFrame(tick);
    else
      report('/perf', {
        id,
        keyToFocus,
        keyToFirstFrame: firstFrame,
        frames: gaps.length,
        maxGap: Math.round(Math.max.apply(null, gaps)),
        slow: gaps.filter((g) => g > 34).length,
      });
  };
  requestAnimationFrame(tick);
}
