// Curadoria padrão da fileira de apps. `show` do getAppsInfo NÃO BASTA como filtro: em
// 2026-11-06 o device marcou 180 de 310 apps como visíveis, incluindo serviços internos
// (AdPlayer, AgingApp), stubs `cobalt-app-*` e entradas `-dummy`.
// Regras derivadas da lista real do device (evidence/raw-tv-report-20261106.log).

import type { InstalledApp } from '../platform/apps';

/** Plataforma de anúncios: nunca na home, qualquer que seja o formato do ID. */
const AD_PLATFORM = /^adplatform\./i;

/** Apps de loja têm package ID de 10 caracteres alfanuméricos (ex.: `9Ur5IzDKqV.TizenYouTube`). */
const STORE_ID = /^[A-Za-z0-9]{10}\./;
const SERVICE_CATEGORY = 'http://tizen.org/category/service';
/** Serviços de background que vêm sem categoria (ex.: `IkWsFHtOY9.StremioService`). */
const SERVICE_NAME = /service|worker/i;

/** Pré-instalados voltados ao usuário, que não seguem o formato de loja. */
export const PREINSTALLED_ALLOW: ReadonlySet<string> = new Set([
  'org.tizen.netflix-app',
  'org.tizen.primevideo',
  'org.tizen.globoplayapp',
  'com.samsung.tv.aria-video', // Apple TV (o `-dummy` fica fora)
  'org.tizen.apple.apple-music',
  'org.tizen.browser', // Internet
]);

/** Do formato de loja, mas não são apps de conteúdo (ou são publicidade). */
export const STORE_DENY: ReadonlySet<string> = new Set([
  'yL49PNFmjW.PromotionApp', // "Samsung Promotion" — publicidade
  'qtMHjALHus.TVDeviceCare',
  'C9cMLuRno1.emanual',
]);

export function isDefaultVisible(app: InstalledApp): boolean {
  // `show` é necessário (sem ele entram componentes internos: AirPlayWebApp,
  // MultiScreenWebLauncher, PrivacyChoices...), embora não suficiente.
  if (!app.show || !app.name.trim() || AD_PLATFORM.test(app.id)) return false;
  if (PREINSTALLED_ALLOW.has(app.id)) return true;
  if (!STORE_ID.test(app.id) || STORE_DENY.has(app.id)) return false;
  if (app.categories.indexOf(SERVICE_CATEGORY) !== -1) return false;
  return !SERVICE_NAME.test(app.id) && !SERVICE_NAME.test(app.name);
}

export function curate(apps: InstalledApp[], selfId?: string): InstalledApp[] {
  return apps
    .filter((a) => a.id !== selfId && isDefaultVisible(a))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
}
