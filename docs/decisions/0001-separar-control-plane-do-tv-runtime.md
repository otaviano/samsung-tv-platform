# ADR-0001: Separar control plane do TV runtime

- **Status:** aceito
- **Data:** 2026-11-06

## Contexto

O handoff estabelece dois planos distintos: um app Tizen rodando na TV e uma API de controle
hospedada fora dela. A TV é um device de plataforma congelada (**Tizen 5.5 / Chromium M69**,
confirmado por documentação para modelos 2020) com ciclo de deploy lento e caro — exige
Developer Mode ligado, SDB na LAN e assinatura de pacote.

Fato relevante: a TV está em Wi-Fi e sob DHCP, e o Developer Mode está desligado. Toda
iteração no device tem atrito alto.

## Decisão

O app da TV é autossuficiente para a experiência core: UI e cache local funcionam com a API
e a internet indisponíveis. A API é enriquecimento, nunca dependência de boot.

## Consequências

- Lógica que muda com frequência mora na API, onde o deploy é barato.
- O app da TV fica propositalmente simples: render, navegação por controle remoto, cache.
- O schema de cache local vira contrato versionado — a API precisa evoluir sem quebrar
  um app instalado que o usuário não atualizou.
- Um modo offline degradado precisa ser testado como caminho de primeira classe, não como
  tratamento de erro.

## Alternativas consideradas

- **App fino, tudo na API:** descartado. Uma falha de rede deixaria a TV sem home.
- **Tudo no app:** descartado. Cada ajuste exigiria Developer Mode e redeploy via SDB.

## Rollback

Decisão estrutural de baixo custo de reversão enquanto `src/` está vazio. Após o primeiro
protótipo, reverter significa reescrever a fronteira de dados — caro. Revisitar antes do
primeiro commit funcional em `src/tv-app`.
