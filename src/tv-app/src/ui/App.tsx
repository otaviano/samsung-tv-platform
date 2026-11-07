import './app.css';
import { useEffect, useState } from 'preact/hooks';
import { FocusRoot, useFocusApi } from '../focus/FocusRoot';
import { Row, type TileData } from './Row';
import { report } from '../platform/report';
import { SELF_ID, launchApp, listApps, type InstalledApp } from '../platform/apps';
import { curate } from '../data/curate';
import { loadCachedApps, saveCachedApps } from '../data/appsCache';
import { loadFocus, saveFocus } from '../data/focusMemory';
import type { Background } from '../lifecycle/background';

// Fileiras de exemplo, ainda sem fonte de dados (control plane/agente, fases seguintes).
function tiles(prefix: string, n: number): TileData[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}`, label: `${prefix.toUpperCase()} ${i + 1}` }));
}
const PLACEHOLDER_ROWS = [
  { id: 'cont', title: 'Continuar (exemplo)', items: tiles('cont', 3) },
  { id: 'rec', title: 'Para você (exemplo)', items: tiles('rec', 7) },
];

const toTiles = (apps: InstalledApp[]): TileData[] =>
  apps.map((a) => ({ id: a.id, label: a.name, icon: a.iconPath || undefined }));

/** Cache primeiro; getAppsInfo (lento, ~3 s) atualiza em segundo plano. */
function useApps(): { items: TileData[] | null; error: string | null } {
  const [apps, setApps] = useState<InstalledApp[] | null>(() => loadCachedApps());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const t0 = performance.now();
    listApps()
      .then((all) => {
        const curated = curate(all, SELF_ID);
        report('/apps', { ms: Math.round(performance.now() - t0), total: all.length, curated: curated.map((a) => a.id) });
        saveCachedApps(curated);
        setApps(curated);
      })
      .catch((e: Error) => {
        report('/apps', { error: e.message });
        setError(e.message);
      });
  }, []);
  return { items: apps ? toTiles(apps) : null, error };
}

function open(bg: Background, item: TileData) {
  const t0 = performance.now();
  report('/select', { id: item.id });
  bg.watchLaunch(item.id);
  launchApp(item.id)
    .then(() => report('/launch', { id: item.id, ok: true, ms: Math.round(performance.now() - t0) }))
    .catch((e: Error) => {
      bg.cancelWatch();
      report('/launch', { id: item.id, ok: false, error: e.message });
    });
}

function Home({ bg }: { bg: Background }) {
  const { fm } = useFocusApi();
  const { items, error } = useApps();
  const firstApp = items?.[0]?.id;

  // Cada volta à frente recarrega a página: restaurar o último foco se ele ainda existe;
  // senão o primeiro app (que pode chegar depois do primeiro render).
  useEffect(() => {
    if (fm.userHasMoved) return;
    const saved = loadFocus();
    if (saved && fm.has(saved)) fm.focus(saved);
    else if (firstApp) fm.focus(firstApp);
  }, [firstApp]);

  return (
    <main class="home">
      <header class="home__header">
        <h1>Home</h1>
        <span class="home__tag">
          v0.4{__DEV__ ? ' · dev' : ''}
          {error ? ` · erro ao listar apps: ${error}` : ''}
        </span>
      </header>
      {items && items.length > 0 ? <Row id="apps" title="Apps" items={items} onSelect={(it) => open(bg, it)} /> : null}
      {PLACEHOLDER_ROWS.map((r) => (
        <Row key={r.id} id={r.id} title={r.title} items={r.items} onSelect={(it) => report('/select', { id: it.id })} />
      ))}
    </main>
  );
}

export function App({ bg }: { bg: Background }) {
  return (
    <FocusRoot
      onMove={(id) => {
        saveFocus(id);
        report('/focus', { id });
      }}
    >
      <Home bg={bg} />
    </FocusRoot>
  );
}
