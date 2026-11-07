// Preferências da fileira de apps definidas pelo usuário (objetivo 3): ordem e ocultos.
// Persistidas em localStorage; tudo aqui é puro, exceto load/save.

import type { InstalledApp } from '../platform/apps';

const KEY = 'home.appPrefs.v1';

export interface AppPrefs {
  /** Ordem escolhida. Apps fora da lista (novos) vão para o fim, por nome. */
  order: string[];
  hidden: string[];
}

export const EMPTY_PREFS: AppPrefs = { order: [], hidden: [] };

export function loadPrefs(storage: Pick<Storage, 'getItem'> = localStorage): AppPrefs {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return EMPTY_PREFS;
    const p = JSON.parse(raw) as Partial<AppPrefs>;
    return {
      order: Array.isArray(p.order) ? p.order.filter((x) => typeof x === 'string') : [],
      hidden: Array.isArray(p.hidden) ? p.hidden.filter((x) => typeof x === 'string') : [],
    };
  } catch {
    return EMPTY_PREFS;
  }
}

export function savePrefs(prefs: AppPrefs, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // cota/indisponível: preferências valem só nesta sessão
  }
}

/** Aplica a ordem; `curated` já vem ordenado por nome. Ocultos ficam fora salvo `includeHidden`. */
export function arrange(curated: InstalledApp[], prefs: AppPrefs, includeHidden = false): InstalledApp[] {
  const byId = new Map(curated.map((a) => [a.id, a] as [string, InstalledApp]));
  const out: InstalledApp[] = [];
  for (const id of prefs.order) {
    const a = byId.get(id);
    if (a) {
      out.push(a);
      byId.delete(id);
    }
  }
  curated.forEach((a) => {
    if (byId.has(a.id)) out.push(a);
  });
  return includeHidden ? out : out.filter((a) => prefs.hidden.indexOf(a.id) === -1);
}

/** Move `id` uma posição na lista exibida (inclui ocultos) e grava a ordem completa. */
export function move(prefs: AppPrefs, shown: readonly string[], id: string, delta: -1 | 1): AppPrefs {
  const i = shown.indexOf(id);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= shown.length) return prefs;
  const order = shown.slice();
  order[i] = shown[j] as string;
  order[j] = id;
  return { ...prefs, order };
}

export function toggleHidden(prefs: AppPrefs, id: string): AppPrefs {
  const hidden = prefs.hidden.indexOf(id) === -1 ? prefs.hidden.concat(id) : prefs.hidden.filter((h) => h !== id);
  return { ...prefs, hidden };
}
