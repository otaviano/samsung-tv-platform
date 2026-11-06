import './app.css';
import { FocusRoot } from '../focus/FocusRoot';
import { Row, type TileData } from './Row';
import { report } from '../platform/report';

// Dados de exemplo: a fileira "Apps" é mais larga que a tela para exercitar a rolagem;
// "Continuar" é mais curta para exercitar ↓ vindo de uma coluna sem par.
function tiles(prefix: string, n: number): TileData[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}`, label: `${prefix.toUpperCase()} ${i + 1}` }));
}
const ROWS = [
  { id: 'apps', title: 'Apps', items: tiles('app', 9) },
  { id: 'cont', title: 'Continuar', items: tiles('cont', 3) },
  { id: 'rec', title: 'Para você', items: tiles('rec', 7) },
];

export function App() {
  return (
    <FocusRoot onMove={(id) => report('/focus', { id })}>
      <main class="home">
        <header class="home__header">
          <h1>Home</h1>
          <span class="home__tag">esqueleto v0.2 · foco{__DEV__ ? ' · dev' : ''}</span>
        </header>
        {ROWS.map((r) => (
          <Row key={r.id} id={r.id} title={r.title} items={r.items} onSelect={(it) => report('/select', { id: it.id })} />
        ))}
      </main>
    </FocusRoot>
  );
}
