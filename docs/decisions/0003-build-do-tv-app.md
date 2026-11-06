# ADR-0003: Build do tv-app — TypeScript + esbuild (chrome69) + Preact

- **Status:** aceito (2026-11-06)
- **Data:** 2026-11-06

## Contexto

Fatos confirmados **no device** (E6, `device-baseline.md`):

- Runtime web é **Chromium 69.0.3497.106**, canvas **1920×1080 dpr 1**, CPU **armv7**.
- Sem optional chaining, sem `??`, sem `gap` em flexbox, sem `:focus-visible`.
  Presentes: async/await, object spread, `fetch`, IntersectionObserver, ResizeObserver,
  CSS grid, custom properties, localStorage, IndexedDB.
- Entrada só por controle remoto: setas/OK/BACK nativas; coloridas e mídia via
  `tvinputdevice.registerKey`.
- Deploy: `scripts/tv-app.sh` empacota **qualquer diretório com `config.xml`** e instala via
  SDB. Ciclo validado.
- **O emulador (TV Extensions 10.0) não representa o M69** (ADR-0002). Validação de
  runtime é no hardware, via `scripts/report-sink.py`.

Estação: Node 26.3.1 / npm 11.16.0 no host.

Requisitos do app (de `architecture.md`): home minimalista, **funciona offline** (cache
local primário), navegação por foco direcional, abrir rápido em ARM 32-bit. Vai crescer:
tela de configurações, apps ocultos, depois recomendações do agente.

## Decisão

**TypeScript (strict) compilado por esbuild com `target: chrome69`, UI em Preact, motor de
foco próprio e independente de framework, sem polyfills por padrão.**

| Peça | Escolha | Por quê |
| --- | --- | --- |
| Linguagem | TypeScript strict, `tsc --noEmit` só para tipos | Tipagem sem acoplar o build ao `tsc` |
| Bundler / transpilação | esbuild, `target: ['chrome69']`, bundle único, minificado | Converte `?.`/`??` e o resto da sintaxe para o M69; falha o build no que não sabe converter; binário único, rápido, poucas dependências ([esbuild — target](https://esbuild.github.io/api/#target)) |
| UI | Preact 10 (hooks, sem `preact/compat`) | Modelo declarativo para estado que vai crescer, ~4 KB gz; Preact 10 suporta até IE11, então M69 é folgado ([Preact — browser support](https://preactjs.com/guide/v10/getting-started)) |
| Foco | módulo TS próprio (`src/focus/`), sem dependência de Preact | É o núcleo da experiência; lógica geométrica pura, testável sem DOM; não amarra a UI a uma lib de spatial navigation React-first |
| Guarda de API | `tsconfig` `lib: ["ES2017", "ES2018.Promise", "DOM"]` | Erro de tipo ao usar API de JS que o M69 não tem. **Limite:** a lib `DOM` do TS é moderna e não protege APIs de DOM |
| Guarda de CSS | stylelint + `stylelint-no-unsupported-browser-features`, browserslist `chrome 69` | **Validado no setup:** pega flex `gap` e `:focus-visible`; **não pega `aspect-ratio`** (Chrome 88). `css-overflow` ignorado (falso positivo para `overflow: hidden`) |
| Polyfills | nenhum por padrão; adicionar só com evidência do device | O baseline medido já cobre o necessário |
| Testes | Vitest para lógica pura (foco, cache, modelo); smoke no device via `report-sink` | Emulador fora do loop |
| Saída | `src/tv-app/dist/` com `config.xml`, `index.html`, `app.js`, `app.css` | `tv-app.sh install src/tv-app/dist` sem mudança no script |

Estrutura:

```
src/tv-app/
  package.json  package-lock.json  tsconfig.json  build.mjs  .browserslistrc
  static/        config.xml, index.html (copiados para dist/)
  src/
    main.tsx     bootstrap, registro de teclas
    focus/       motor de foco (puro)
    data/        cache local (localStorage/IndexedDB), modelo da home
    ui/          componentes Preact
  dist/          gitignored
```

## Consequências

- Sintaxe moderna liberada no código-fonte; o build garante a saída M69.
- Três camadas de proteção contra regressão de compatibilidade: transpilação (esbuild),
  tipos (lib do TS) e CSS (stylelint) — e a verdade final continua sendo o device.
- **Não protegido estaticamente:** APIs de DOM/Web novas (a lib `DOM` do TS não tem
  versão). Mitigação: smoke no device a cada mudança relevante; lista de APIs proibidas no
  `README` do app à medida que aparecerem.
- Build roda **no host** (Node 26), não no container Tizen. O container entra só para
  empacotar/assinar/instalar. Reprodutibilidade via `package-lock.json`. **Revisitar** se
  o build precisar rodar em CI.
- Dependências de runtime: só `preact`. O resto é devDependency.
- **Preact fixado na major 10** (`--save-exact`). Achado no setup: o **Preact 11** agenda
  renders com `queueMicrotask` (Chrome 71+) — `ReferenceError` no primeiro `setState` no
  M69. O 10 usa `Promise.prototype.then`. **Qualquer upgrade de dependência de runtime
  exige auditar as APIs usadas contra o baseline do device**, não só a sintaxe: o esbuild
  converte sintaxe, não APIs.

## Alternativas consideradas

- **Vanilla TS, sem framework:** menor peso possível, mas reconciliação manual de DOM vira
  fonte de bugs quando entrarem configurações, apps ocultos e recomendações. Preact custa
  ~4 KB e evita escrever um mini-framework.
- **React:** ~40 KB gz a mais para nada que o Preact não cubra. Em ARM 32-bit, o tempo de
  parse conta.
- **Lit / Web Components:** Custom Elements v1 e Shadow DOM existem no M69, mas o ganho
  sobre Preact aqui é nulo e o modelo de foco atravessando shadow roots complica.
- **Vite:** usa esbuild/Rollup por baixo; o valor dele é o dev server com HMR, que não
  serve para um app empacotado e instalado na TV. esbuild direto é menos peça.
- **Babel + preset-env + core-js:** mais flexível para polyfills, mais lento e mais
  dependências. Polyfill automático por browserslist é exatamente o que **não** queremos
  sem evidência do device.
- **Lib de spatial navigation pronta** (ex.: Norigin): React-first, e foco é o ponto onde
  queremos controle total. Reavaliar se o motor próprio passar de ~300 linhas.

## Rollback

Decisão de código, sem impacto no device. Trocar esbuild por outro bundler: arquivo de
build isolado (`build.mjs`). Trocar Preact por vanilla: custo proporcional ao número de
componentes — por isso o motor de foco e o cache ficam fora de Preact desde o início.
