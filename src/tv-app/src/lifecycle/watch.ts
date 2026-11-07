// Retorno à home quando o app aberto por ela termina (E8b). Lógica pura sobre a lista de
// appIds em execução (tizen.application.getAppsContext), sem acesso a plataforma.
//
// Limites medidos: Netflix suspende em vez de sair (nunca some do contexto -> nunca
// voltamos); HBO Max às vezes sai, às vezes não. Não existe sinal de "quem está na frente".

export interface Watch {
  appId: string;
  startedAt: number;
  /** O app já apareceu no contexto? Antes disso, ausência = ainda subindo, não "saiu". */
  seen: boolean;
  /** Contexto no momento em que o app apareceu: base para detectar outro app aberto depois. */
  baseline: readonly string[];
}

/**
 * Apps cujo launcher (id na fileira) delega para outro processo, que é o que aparece no
 * contexto. Medido no device (2026-11-07): YouTube abre como `com.samsung.tv.cobalt-yt`.
 */
const RUNS_AS: Record<string, string> = {
  'com.samsung.tv.cobalt-yt': '9Ur5IzDKqV.TizenYouTube',
};

/** Traduz ids do contexto para os ids da fileira (launcher). */
export function normalize(running: readonly string[]): string[] {
  return running.map((id) => RUNS_AS[id] || id);
}

export type Action = 'none' | 'return';

/** Desiste de esperar um app que nunca apareceu (launch falhou sem erro, etc.). */
export const UNSEEN_TIMEOUT_MS = 60_000;

export function startWatch(appId: string, now: number): Watch {
  return { appId, startedAt: now, seen: false, baseline: [] };
}

/**
 * Um passo de observação.
 * @param userApps apps da fileira (curados). Se um deles, diferente do observado, abriu
 *   depois do observado, o usuário seguiu para outro app pelo Smart Hub: o observado
 *   terminar (ex.: por memória) NÃO deve nos trazer para a frente por cima dele.
 */
export function step(
  w: Watch,
  running: readonly string[],
  userApps: ReadonlySet<string>,
  now: number,
): { next: Watch | null; action: Action } {
  running = normalize(running);
  const alive = running.indexOf(w.appId) !== -1;
  if (!w.seen) {
    if (alive) return { next: { ...w, seen: true, baseline: running.slice() }, action: 'none' };
    if (now - w.startedAt > UNSEEN_TIMEOUT_MS) return { next: null, action: 'none' };
    return { next: w, action: 'none' };
  }
  if (alive) return { next: w, action: 'none' };
  const movedOn = running.some((id) => id !== w.appId && userApps.has(id) && w.baseline.indexOf(id) === -1);
  return { next: null, action: movedOn ? 'none' : 'return' };
}
