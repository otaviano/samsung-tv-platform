# Working agreement — assistentes de código

Compatível com ChatGPT, Claude e Codex. `CLAUDE.md` é um symlink para este arquivo.

## Antes de propor qualquer coisa

Ler, nesta ordem: `README.md` → `docs/device-baseline.md` → `docs/discovery-report.md` →
`docs/rollback-strategy.md` → `docs/decisions/`.

## Regras

1. **Separar fato de hipótese.** Toda afirmação sobre a plataforma vem com fonte: link para
   documentação oficial Samsung/Tizen, ou uma observação reproduzível com o comando que a
   produziu. Marcar confiança: Confirmado / Provável / Hipótese.
2. **Não inventar capacidades do device.** Se não foi lido do device ou da doc, é hipótese e
   precisa estar rotulada como tal. Em especial: não assumir a versão do Tizen a partir da
   string de firmware; não assumir que SDB dá root.
3. **Nada destrutivo ou irreversível.** Vedado durante o discovery: atualizar firmware,
   entrar no service menu, factory reset, flash, privilege escalation.
4. **Rollback primeiro.** Nenhuma mudança sem rollback conhecido ou risco de recuperação
   explicitamente aceito pelo usuário. Respeitar a escada de degraus em
   `docs/rollback-strategy.md` — não pular degraus.
5. **Registrar.** Todo experimento no device ou na rede entra em `docs/change-log.md`,
   inclusive os que falharam. Atualizar ADRs quando arquitetura ou premissas mudarem.
6. **Dados sensíveis fora do git.** Serial, DUID/UDN, MAC completo, TVkey, tokens e
   certificados. Ver `docs/security.md`.
7. **Alvo é Chromium M69.** Código em `src/tv-app` não assume baseline moderno de browser.
   Navegação por controle remoto, sem ponteiro e sem hover.
8. **Sem simplificação excessiva.** O usuário é arquiteto de software com ~20 anos de
   experiência. Ir direto ao ponto técnico.

## Idioma

Documentação e conversa em **português (pt-BR)**. Identificadores de código em inglês.
