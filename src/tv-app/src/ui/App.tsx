import './app.css';

// Esqueleto: valida build + render no device. Foco direcional entra na próxima etapa.
const PLACEHOLDER_ROWS = [
  { title: 'Apps', items: ['A', 'B', 'C', 'D', 'E'] },
  { title: 'Continuar', items: ['1', '2', '3'] },
];

export function App() {
  return (
    <main class="home">
      <header class="home__header">
        <h1>Home</h1>
        <span class="home__tag">esqueleto v0.1{__DEV__ ? ' · dev' : ''}</span>
      </header>
      {PLACEHOLDER_ROWS.map((row) => (
        <section class="row" key={row.title}>
          <h2 class="row__title">{row.title}</h2>
          <div class="row__items">
            {row.items.map((it) => (
              <div class="tile" key={it}>
                {it}
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
