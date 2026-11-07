import { describe, expect, it } from 'vitest';
import { EMPTY_PREFS, arrange, loadPrefs, move, toggleHidden } from './appPrefs';
import type { InstalledApp } from '../platform/apps';

const app = (id: string): InstalledApp => ({ id, name: id, iconPath: '', show: true, categories: [] });
const A = app('a'), B = app('b'), C = app('c'), D = app('d');
const ids = (xs: InstalledApp[]) => xs.map((x) => x.id);

describe('appPrefs', () => {
  it('sem prefs: mantém a ordem de entrada', () => {
    expect(ids(arrange([A, B, C], EMPTY_PREFS))).toEqual(['a', 'b', 'c']);
  });

  it('ordem do usuário primeiro; apps novos no fim; ids que sumiram ignorados', () => {
    expect(ids(arrange([A, B, C, D], { order: ['c', 'x', 'a'], hidden: [] }))).toEqual(['c', 'a', 'b', 'd']);
  });

  it('ocultos saem, a menos que includeHidden', () => {
    const p = { order: [], hidden: ['b'] };
    expect(ids(arrange([A, B, C], p))).toEqual(['a', 'c']);
    expect(ids(arrange([A, B, C], p, true))).toEqual(['a', 'b', 'c']);
  });

  it('move troca com o vizinho e grava a ordem completa', () => {
    expect(move(EMPTY_PREFS, ['a', 'b', 'c'], 'b', 1).order).toEqual(['a', 'c', 'b']);
    expect(move(EMPTY_PREFS, ['a', 'b', 'c'], 'b', -1).order).toEqual(['b', 'a', 'c']);
  });

  it('move nas bordas não muda nada', () => {
    expect(move(EMPTY_PREFS, ['a', 'b'], 'a', -1)).toBe(EMPTY_PREFS);
    expect(move(EMPTY_PREFS, ['a', 'b'], 'b', 1)).toBe(EMPTY_PREFS);
  });

  it('toggleHidden alterna', () => {
    const p = toggleHidden(EMPTY_PREFS, 'a');
    expect(p.hidden).toEqual(['a']);
    expect(toggleHidden(p, 'a').hidden).toEqual([]);
  });

  it('load tolera lixo', () => {
    expect(loadPrefs({ getItem: () => '{nope' })).toEqual(EMPTY_PREFS);
    expect(loadPrefs({ getItem: () => '{"order":[1,"a"],"hidden":"x"}' })).toEqual({ order: ['a'], hidden: [] });
  });
});
