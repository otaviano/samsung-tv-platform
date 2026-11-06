import { render } from 'preact';
import { App } from './ui/App';
import { Key, exitApp, registerKeys } from './platform/keys';
import { report } from './platform/report';

// performance.now() é relativo ao início da navegação: t0 = quanto a plataforma levou até
// o nosso JS começar (o resto dos "3 s" percebidos não é nosso).
const t0 = performance.now();
const registered = registerKeys();

document.addEventListener('keydown', (e) => {
  report('/key', { keyCode: e.keyCode, key: e.key });
  if (e.keyCode === Key.Back) {
    // Raiz da home: BACK sai. Com navegação entre telas, BACK volta primeiro.
    setTimeout(exitApp, __REPORT_URL__ ? 300 : 0);
  }
});

const root = document.getElementById('root');
if (root) {
  render(<App />, root);
  report('/boot', {
    ua: navigator.userAgent,
    jsStartMs: Math.round(t0),
    renderMs: Math.round(performance.now() - t0),
    cacheHit: !!localStorage.getItem('home.apps.v1'),
    registered,
  });
}
