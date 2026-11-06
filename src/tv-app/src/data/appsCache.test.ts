import { describe, expect, it } from 'vitest';
import { loadCachedApps, saveCachedApps } from './appsCache';

function memStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe('appsCache', () => {
  it('ida e volta', () => {
    const s = memStorage();
    const apps = [{ id: 'x', name: 'X', iconPath: '', show: true, categories: [] }];
    saveCachedApps(apps, s);
    expect(loadCachedApps(s)).toEqual(apps);
  });

  it('vazio ou corrompido devolve null', () => {
    const s = memStorage();
    expect(loadCachedApps(s)).toBeNull();
    s.m.set('home.apps.v1', '{nope');
    expect(loadCachedApps(s)).toBeNull();
  });
});
