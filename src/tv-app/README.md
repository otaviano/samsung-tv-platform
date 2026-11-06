# tv-app — home custom (Tizen 5.5 / Chromium 69)

Decisões de build: [ADR-0003](../../docs/decisions/0003-build-do-tv-app.md).
Baseline medido do runtime: [device-baseline.md](../../docs/device-baseline.md).

```bash
npm ci
npm run check                 # tipos (lib ES2017) + stylelint (chrome 69) + testes
npm run build:dev             # dist/ com REPORT_URL para o report-sink
python3 -I ../../scripts/report-sink.py &
../../scripts/tv-app.sh install dist && ../../scripts/tv-app.sh run dist
../../scripts/tv-app.sh uninstall dist   # rollback
```

## Regras

- Navegação só por controle remoto: foco direcional, sem hover, sem ponteiro.
- Canvas 1920×1080, dpr 1. Margem de segurança contra overscan em `--safe-x/--safe-y`.
- Sem flex `gap` (usar margem ou grid), sem `:focus-visible` (foco por classe), sem
  `aspect-ratio` — o lint não pega este último.
- Upgrade de dependência de runtime exige auditar **APIs** contra o baseline, não só
  sintaxe (caso Preact 11 / `queueMicrotask`).
