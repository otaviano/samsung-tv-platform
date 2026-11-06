// Cache local da fileira de apps: getAppsInfo levou 2,9 s no device (2026-11-06) — a home
// renderiza do cache e atualiza em segundo plano (architecture.md: cache local primário).

import type { InstalledApp } from '../platform/apps';

const KEY = 'home.apps.v1';

interface Stored {
  savedAt: number;
  apps: InstalledApp[];
}

export function loadCachedApps(storage: Pick<Storage, 'getItem'> = localStorage): InstalledApp[] | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return Array.isArray(parsed.apps) ? parsed.apps : null;
  } catch {
    return null; // cache corrompido = sem cache
  }
}

export function saveCachedApps(apps: InstalledApp[], storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), apps } satisfies Stored));
  } catch {
    // cota/indisponível: segue sem cache
  }
}
