import { render } from 'preact';
import { App } from './ui/App';
import { Key, hideApp, registerKeys } from './platform/keys';
import { report } from './platform/report';
import { SELF_ID } from './platform/apps';
import { loadCachedApps } from './data/appsCache';
import { startBackground } from './lifecycle/background';

// performance.now() é relativo ao início da navegação: t0 = quanto a plataforma levou até
// o nosso JS começar (o resto dos "3 s" percebidos não é nosso).
const t0 = performance.now();
const registered = registerKeys();

// Ciclo de vida: volta à frente no power-on e quando o app aberto pela home termina.
const bg = startBackground(SELF_ID, () => new Set((loadCachedApps() || []).map((a) => a.id)));

document.addEventListener('keydown', (e) => {
  report('/key', { keyCode: e.keyCode, key: e.key });
  if (e.keyCode === Key.Back) {
    // Raiz da home: BACK esconde (não encerra — ver hideApp). Com telas, BACK volta antes.
    e.preventDefault();
    report('/back', { result: hideApp() });
  }
});

const root = document.getElementById('root');
if (root) {
  render(<App bg={bg} />, root);
  report('/boot', {
    ua: navigator.userAgent,
    jsStartMs: Math.round(t0),
    renderMs: Math.round(performance.now() - t0),
    cacheHit: !!localStorage.getItem('home.apps.v1'),
    hidden: document.hidden,
    registered,
  });
}
