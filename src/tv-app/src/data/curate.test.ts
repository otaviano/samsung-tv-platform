import { describe, expect, it } from 'vitest';
import { curate } from './curate';
import type { InstalledApp } from '../platform/apps';

const SVC = 'http://tizen.org/category/service';
const a = (id: string, name: string, categories: string[] = [], show = true): InstalledApp => ({ id, name, iconPath: '', show, categories });

// Recorte real do device (2026-11-06).
const DEVICE = [
  a('9Ur5IzDKqV.TizenYouTube', 'YouTube'),
  a('MCmYXNxgcu.DisneyPlus', 'Disney+'),
  a('MCmYXNxgcu.DisneyPlusService', 'DisneyPlusPreviewService', [SVC]),
  a('5b8c3eb16b.BeamCTVDev', 'HBO Max'),
  a('5b8c3eb16b.backgroundService', 'Max Worker', [SVC]),
  a('IkWsFHtOY9.Stremio', 'Stremio'),
  a('IkWsFHtOY9.StremioService', 'StremioService'), // sem categoria
  a('yL49PNFmjW.PromotionApp', 'Samsung Promotion'),
  a('qtMHjALHus.TVDeviceCare', 'TVDeviceCare'),
  a('org.tizen.netflix-app', 'Netflix'),
  a('com.samsung.tv.aria-video', 'Apple TV'),
  a('com.samsung.tv.aria-dummy', 'Apple TV'),
  a('com.samsung.tv.adplayer', 'AdPlayer'),
  a('com.samsung.tv.cobalt-app-5494', 'App'),
  a('org.tizen.AgingApp', 'AgingApp'),
  a('OtvHome001.home', 'Home'),
  // Escaparam na 1ª versão das regras (curadoria aplicada sobre show=false também):
  a('adplatform.ADPlayer', 'ADPlayer', [], false), // "adplatform" tem 10 caracteres
  a('NRi6kdBYJ0.AirPlayWebApp', 'AirPlayWebApp', [], false),
  a('tv6pbVMQFF.PrivacyChoices', 'PrivacyChoices', [], false),
  a('NvZ26VG9Yw.HBOGOLAG', ''), // sem nome
];

describe('curate', () => {
  it('mantém só apps de conteúdo, ordenados por nome', () => {
    expect(curate(DEVICE, 'OtvHome001.home').map((x) => x.name)).toEqual([
      'Apple TV',
      'Disney+',
      'HBO Max',
      'Netflix',
      'Stremio',
      'YouTube',
    ]);
  });

  it('exclui serviço sem categoria pelo nome, e o dummy duplicado', () => {
    const ids = curate(DEVICE).map((x) => x.id);
    expect(ids).not.toContain('IkWsFHtOY9.StremioService');
    expect(ids).not.toContain('com.samsung.tv.aria-dummy');
  });

  it('publicidade da Samsung fica fora mesmo no formato de loja', () => {
    expect(curate(DEVICE).map((x) => x.id)).not.toContain('yL49PNFmjW.PromotionApp');
  });

  it('o próprio app não aparece', () => {
    expect(curate(DEVICE, 'OtvHome001.home').map((x) => x.id)).not.toContain('OtvHome001.home');
  });

  it('show=false, nome vazio e plataforma de anúncio ficam fora (casos reais do device)', () => {
    const ids = curate(DEVICE).map((x) => x.id);
    for (const bad of ['adplatform.ADPlayer', 'NRi6kdBYJ0.AirPlayWebApp', 'tv6pbVMQFF.PrivacyChoices', 'NvZ26VG9Yw.HBOGOLAG']) {
      expect(ids).not.toContain(bad);
    }
  });

  it('plataforma de anúncio fica fora mesmo se marcada como visível', () => {
    expect(curate([a('adplatform.ADPlayer', 'ADPlayer')])).toEqual([]);
  });
});
