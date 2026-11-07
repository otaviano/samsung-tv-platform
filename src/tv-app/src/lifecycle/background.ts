// Fiação do ciclo de vida com a plataforma. Requer background-support="enable" no
// config.xml: o processo continua vivo (e congela no standby) com outro app na frente.
//
// Voltar à frente = tizen.application.launch(SELF). Medido (E8): funciona escondido, mas
// RECARREGA a página — todo estado que precisa sobreviver vai para localStorage.

import { report } from '../platform/report';
import { WakeDetector } from './wake';
import { startWatch, step, type Watch } from './watch';

const TICK_MS = 1000;
const POLL_MS = 3000;
/** Deixa o "último app" subir antes de tomarmos a frente (evita brigar com ele). */
const WAKE_DELAY_MS = 1500;
/** Não repetir launch(self) enquanto o anterior está em andamento. */
const RETURN_COOLDOWN_MS = 5000;

export interface Background {
  /** Chamar ao abrir um app pela home: quando ele terminar, a home volta. */
  watchLaunch(appId: string): void;
  cancelWatch(): void;
}

function runningIds(): Promise<string[] | null> {
  const app = window.tizen?.application;
  if (!app) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      app.getAppsContext(
        (ctxs) => resolve(ctxs.map((c) => c.appId)),
        () => resolve(null),
      );
    } catch {
      resolve(null);
    }
  });
}

export function startBackground(selfId: string, userApps: () => ReadonlySet<string>): Background {
  let watch: Watch | null = null;
  let returningUntil = 0;

  function bringToFront(reason: string): void {
    const now = Date.now();
    if (!document.hidden || now < returningUntil) return;
    returningUntil = now + RETURN_COOLDOWN_MS;
    report('/bg/front', { reason });
    try {
      window.tizen?.application.launch(
        selfId,
        () => report('/bg/front', { ok: true }),
        (e) => report('/bg/front', { ok: false, error: e.message }),
      );
    } catch (e) {
      report('/bg/front', { ok: false, error: String(e) });
    }
  }

  // Power-on.
  const wake = new WakeDetector(Date.now());
  setInterval(() => {
    const gap = wake.tick(Date.now());
    if (gap === null) return;
    report('/bg/wake', { gapS: Math.round(gap / 1000), hidden: document.hidden });
    watch = null; // o que estava aberto antes do standby não é mais referência
    returningUntil = 0;
    setTimeout(() => bringToFront(`power-on (gap ${Math.round(gap / 1000)} s)`), WAKE_DELAY_MS);
  }, TICK_MS);

  // App aberto pela home terminou.
  setInterval(() => {
    if (!watch || !document.hidden) return;
    const current = watch;
    void runningIds().then((ids) => {
      if (!ids || watch !== current) return;
      const r = step(current, ids, userApps(), Date.now());
      if (r.next && !current.seen && r.next.seen) report('/bg/watch', { seen: current.appId });
      watch = r.next;
      // Nunca visto: o app pode rodar no contexto sob outro appId — reportar a lista.
      if (!r.next) report('/bg/watch', { ended: current.appId, action: r.action, seen: current.seen, running: current.seen ? undefined : ids });
      if (r.action === 'return') bringToFront(`${current.appId} terminou`);
    });
  }, POLL_MS);

  // Diagnóstico (só dev): o processo segue vivo? Morre por quê? (v0.4 sumiu sem rastro.)
  if (__REPORT_URL__) {
    const started = Date.now();
    setInterval(() => {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      report('/bg/hb', {
        upS: Math.round((Date.now() - started) / 1000),
        hidden: document.hidden,
        watching: watch ? watch.appId : null,
        heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
      });
    }, 15_000);
    const bye = (ev: string) => () => {
      try {
        navigator.sendBeacon(__REPORT_URL__ + '/bg/bye', JSON.stringify({ ev, hidden: document.hidden }));
      } catch {
        // best-effort
      }
    };
    window.addEventListener('pagehide', bye('pagehide'));
    window.addEventListener('beforeunload', bye('beforeunload'));
  }

  // Voltamos à frente por qualquer caminho: nada mais a observar.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) watch = null;
  });

  return {
    watchLaunch(appId) {
      watch = startWatch(appId, Date.now());
    },
    cancelWatch() {
      watch = null;
    },
  };
}
