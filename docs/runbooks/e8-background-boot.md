# E8/E9 — Voltar para a nossa home: background, retorno e power-on

**Requisito do usuário:** tudo pelo controle remoto. Abrir na nossa home ao ligar a TV é
**mandatório**. Atalho por celular/rede não é aceitável.
**Degrau:** 3 (app próprio `E8BgTest01`, `experiments/e8-background`). Rollback:
`scripts/tv-app.sh uninstall experiments/e8-background`.

## Resultados (2026-11-06)

| Pergunta | Resultado | Confiança |
| --- | --- | --- |
| App em background recebe teclas registradas (cores, BACK) com outro app na frente? | **Não.** Teclas só vão ao app em primeiro plano | Confirmado |
| Home é registrável? | **Não.** Ausente das 46 teclas do `getSupportedKeys` | Confirmado |
| App com `background-support="enable"` segue rodando JS escondido? | **Sim** (heartbeat a cada 3 s com `hidden: true`) | Confirmado |
| App em background pode se trazer para a frente (`launch(self)`)? | **Sim.** A página **recarrega** (novo boot) — estado tem de ser persistido | Confirmado |
| Serviço web `on-boot` pode abrir a UI? | Abre **congelada** (JS parado, BACK sem efeito). Serviço suspenso logo após `onStart`. **Removido** | Confirmado |
| `addAppStatusChangeListener` (global ou por app) | Registra sem erro, **nunca dispara** | Confirmado |
| Saber se outro app saiu do primeiro plano | **Sem sinal.** Hub é overlay: nem processo nem visibilidade mudam | Confirmado |
| Voltar quando o app de conteúdo **fecha** | **Funciona** (~1 s, via polling de `getAppsContext`) | Confirmado |
| …mas apps fecham ao sair? | **Às vezes.** Netflix nunca (suspende); HBO Max depende de onde se sai | Confirmado |
| `tizen.power` | **Não existe** no perfil TV | Confirmado |
| **Power-on (standby curto, 98 s) traz a nossa home?** | **Sim.** Processo **congela** no standby; ao ligar, `online` + salto de relógio (gap) disparam `launch(self)`; ~4 s após ligar | Confirmado (1 amostra) |
| **Power-on após standby longo (9 h 16 min) traz a nossa home?** | **Sim.** Processo continuou congelado, não foi encerrado. Só o gap disparou (`online` **não** veio). Wake → `launch` pedido em 3,8 s → frente em 7,2 s (medido do wake, não do botão) | Confirmado (1 amostra, 2026-11-07) |

## Mecanismo de power-on

1. App fica em background (`background-support="enable"`).
2. Tique de 1 s; se o intervalo real > 10 s, o processo esteve congelado → TV acabou de
   ligar. Evento `online` é sinal redundante.
3. Após 1,5 s (deixa o "último app" subir), `tizen.application.launch(self)`.
   O gap é o sinal **primário**: no standby longo o `online` não disparou.

## Pendente

- **Boot frio** (tomada): não há processo nosso; depende de "Executar automaticamente o
  último app" (existe no menu, confirmado pelo usuário) e de a nossa home ser a última.
- Atraso de 1,5 s: ajustar para minimizar o flash do app anterior.

## Observação para o E5

Ao ligar a TV sobem `com.samsung.tizen.samsung-analytics` e
`com.samsung.tv.built-in-app-upgrader` — telemetria e updater de apps disparam a cada
power-on.
