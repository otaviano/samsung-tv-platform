// Guarda de CSS contra o Chromium 69 (ADR-0003). Erro, não aviso.
//
// Validado em 2026-11-06 com arquivo-sonda: PEGA flex `gap` e `:focus-visible`; NÃO
// reclama de grid `gap` (correto). NÃO PEGA `aspect-ratio` (Chrome 88) — furo conhecido;
// o device continua sendo a fonte de verdade.
export default {
  plugins: ['stylelint-no-unsupported-browser-features'],
  rules: {
    'plugin/no-unsupported-browser-features': [
      true,
      {
        severity: 'error',
        ignorePartialSupport: false,
        // css-overflow: o "parcial" do caniuse é `overflow: clip` / sintaxe de 2 valores;
        // `overflow: hidden` é suportado desde sempre.
        ignore: ['css-overflow'],
      },
    ],
  },
};
