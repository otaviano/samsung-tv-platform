import { describe, expect, it } from 'vitest';
import { UNSEEN_TIMEOUT_MS, startWatch, step } from './watch';

const HBO = '5b8c3eb16b.BeamCTVDev';
const YT = '9Ur5IzDKqV.TizenYouTube';
const SERVICES = ['org.tizen.tv-viewer', 'rJeHak5zRg.SpotifyService'];
const USER_APPS = new Set([HBO, YT]);

describe('watch/step', () => {
  it('ausente antes de aparecer = ainda subindo, não volta', () => {
    const r = step(startWatch(HBO, 0), SERVICES, USER_APPS, 2000);
    expect(r.action).toBe('none');
    expect(r.next?.seen).toBe(false);
  });

  it('apareceu e depois saiu: volta', () => {
    let w = step(startWatch(HBO, 0), [...SERVICES, HBO], USER_APPS, 3000).next!;
    expect(w.seen).toBe(true);
    w = step(w, [...SERVICES, HBO], USER_APPS, 6000).next!;
    const r = step(w, SERVICES, USER_APPS, 9000);
    expect(r).toEqual({ next: null, action: 'return' });
  });

  it('serviços entrando e saindo não importam', () => {
    const w = step(startWatch(HBO, 0), [...SERVICES, HBO], USER_APPS, 3000).next!;
    const r = step(w, ['org.tizen.tv-viewer', 'MCmYXNxgcu.DisneyPlusService'], USER_APPS, 6000);
    expect(r.action).toBe('return');
  });

  it('usuário abriu outro app da fileira depois: observado sumir não nos traz', () => {
    const w = step(startWatch(HBO, 0), [...SERVICES, HBO], USER_APPS, 3000).next!;
    const r = step(w, [...SERVICES, YT], USER_APPS, 60_000);
    expect(r).toEqual({ next: null, action: 'none' });
  });

  it('app da fileira que já rodava antes (ex.: Netflix suspenso) não conta como "seguiu"', () => {
    const w = step(startWatch(HBO, 0), [...SERVICES, YT, HBO], USER_APPS, 3000).next!;
    expect(step(w, [...SERVICES, YT], USER_APPS, 6000).action).toBe('return');
  });

  it('nunca apareceu: desiste após o timeout sem voltar', () => {
    const r = step(startWatch(HBO, 0), SERVICES, USER_APPS, UNSEEN_TIMEOUT_MS + 1);
    expect(r).toEqual({ next: null, action: 'none' });
  });

  it('YouTube roda no contexto como cobalt-yt: conta como o launcher', () => {
    const w = step(startWatch(YT, 0), [...SERVICES, 'com.samsung.tv.cobalt-yt'], USER_APPS, 3000).next!;
    expect(w.seen).toBe(true);
    expect(step(w, SERVICES, USER_APPS, 6000).action).toBe('return');
  });

  it('YouTube (cobalt-yt) aberto depois pelo Smart Hub conta como "seguiu"', () => {
    const w = step(startWatch(HBO, 0), [...SERVICES, HBO], USER_APPS, 3000).next!;
    expect(step(w, [...SERVICES, 'com.samsung.tv.cobalt-yt'], USER_APPS, 6000).action).toBe('none');
  });
});
