# Change log

Registro de **toda** mudança ou experimento envolvendo o device ou a rede. Uma entrada por
experimento, mesmo que falhe. Template e regras em
[rollback-strategy.md](rollback-strategy.md).

Entradas em ordem cronológica inversa (mais recente no topo).

---

## 2026-11-06 — D0: inventário passivo inicial

- **Degrau:** 0 (observação passiva)
- **Hipótese:** é possível identificar o device e seu estado de developer mode sem nenhuma
  mudança e sem port scan.
- **Passos:** `scripts/inventory-host.sh`, `scripts/discover-tv.sh <TV_IP>`
- **Resultado:** TV identificada em `<TV_IP>` via cache ARP + OUI. Developer Mode
  confirmado desligado. Portas 8001/8002/9197 abertas, 26101 fechada. Serial exposto sem
  auth via UPnP.
- **Validação:** `modelName` retornado bate com o baseline (`<TV_MODEL>`).
- **Rollback:** não aplicável — nenhuma mudança feita.
- **Risco de recuperação:** nenhum.
- **Registro:** [discovery-report.md](discovery-report.md)

---

## 2026-11-06 — E3: toolchain Tizen em container

- **Degrau:** 0 no device (não tocado), 1 no host
- **Hipótese:** é possível rodar o toolchain Samsung TV no Fedora 44 via container Ubuntu,
  sem instalar nada no host e sem depender de GUI.
- **Passos exatos:** `podman build -t tizen-tv:6.1 -f infra/Containerfile infra/`
- **Resultado observado:** Tizen CLI 2.5.25, sdb 4.2.25, Package Manager 0.5.67.
  `TV-SAMSUNG-Public-WebAppDevelopment` 10.0.0, `TV-SAMSUNG-Extension-Tools` 10.0.0,
  `TV-SAMSUNG-Extension-Resources` 10.0.0, `cert-add-on` 2.0.75, `Certificate-Manager`
  3.1.3 instalados. Perfil de build `tv-5.5` disponível.
- **Três falhas pelo caminho, todas corrigidas:**
  1. Primeira versão do `scripts/tizen.sh` montava volume em `~/.tizen-state`, caminho que
     o toolchain não usa — extensões instaladas em runtime (`--rm`) seriam perdidas.
     Corrigido: extensões em build time; volumes em `~/tizen-studio-data` e `~/.sdb`.
  2. Extensões não instalavam por falta de `rpm2cpio`/`cpio` (são RPMs), com **exit code 0**.
  3. Depois, por falta de `libkf5itemmodels5`/`libkf5kiowidgets5`/`libkchart2`, também
     com **exit code 0**.
- **Validação:** guard no Containerfile confere que cada pacote saiu de `ni`, falhando o
  build caso contrário.
- **Rollback:** `podman rmi tizen-tv:6.1 && podman volume rm tizen-studio-data tizen-sdb`
- **Risco de recuperação:** nenhum — nada tocado no device nem no host.
- **Registro:** [runbooks/e3-toolchain-container.md](runbooks/e3-toolchain-container.md)

---

## 2026-11-06 — E2 (tentativa 1): Developer Mode ligado, SDB recusado

- **Degrau:** 2 (configuração suportada da TV)
- **Hipótese:** ligar o Developer Mode e fixar `developerIP` na estação abre a 26101 para SDB.
- **Executado por:** usuário, pelo controle remoto.
- **Resultado observado:** **parcialmente bem-sucedido.**
  - `developerMode`: `"0"` → `"1"` ✅
  - porta `26101`: fechada → **aberta** ✅
  - `developerIP`: `"0.0.0.0"` → **`"<TV_IP>"`** ❌ — é o IP da *própria TV*, não da
    estação (`<HOST_IP>`)
  - `sdb connect <TV_IP>:26101` → `failed to connect`; `sdb devices` vazio
- **Validação:** critério de aceite do runbook **não atingido** (2 de 3 campos).
- **Conclusão (confiança: Provável):** a TV trata `developerIP` como **allowlist** de host.
  A porta 26101 abre com o Developer Mode, mas só aceita conexão do IP registrado. Porta
  aberta ≠ conexão autorizada.
- **Ação corretiva:** refazer o passo 6 informando `<HOST_IP>`. O runbook ganhou um aviso
  destacado nesse campo e uma tabela de diagnóstico.
- **Rollback:** não necessário — o estado atual é seguro e reversível pelo mesmo menu.
  Developer Mode segue ligado; desligar ao fim da sessão (`docs/security.md`).
- **Risco de recuperação:** nenhum.

---

## 2026-11-06 — E2 (tentativa 2): mesmo resultado; mecanismo de rejeição confirmado

- **Resultado:** `developerIP` permanece com o IP da própria TV. `sdb connect` segue
  `failed to connect`.
- **Evidência nova:** teste de socket cru — a TV aceita o TCP vindo da estação e fecha em
  ~0,01 s sem enviar byte algum. Descarta filtro de pacotes e serviço ausente; é rejeição
  na camada de aplicação. Mecanismo: **Confirmado**. Atribuição ao `developerIP`: Provável.
- **Correção de critério:** "porta 26101 aberta" foi removido como sinal de sucesso.
- **Bug próprio encontrado:** `scripts/tizen.sh` usava containers `--rm`, o que matava o
  servidor sdb entre comandos. Corrigido para container persistente.
- **Próximo:** power cycle de 60 s pela tomada (não standby) e leitura do valor exibido no
  campo Host PC IP, para separar "não salvou" de "salvou e a API reporta outra coisa".

---

## 2026-11-06 — E2 (tentativa 3): SUCESSO + E4 executado

- **O que destravou:** apagar o conteúdo do campo **Host PC IP** antes de digitar.
  Sobrescrever por cima não gravava. `developerIP` passou a refletir a estação.
- **Sem reboot:** o daemon aplicou o novo `developerIP` imediatamente. Socket mudou de
  "fecha em 0,02 s" para "mantida aberta". `sdb connect` passou; `sdb devices` lista a TV.
- **Hipótese do `developerIP` como allowlist: Confirmada.**
- **E4 (somente leitura) na sequência:** `platform_version:5.5` confirmado do device
  (incógnita 1 fechada), `cpu_arch:armv7`, **`sdbd_rootperm:disabled`**,
  **`rootonoff_support:disabled`**, **`intershell_support:disabled`**. 309 apps
  inventariados via `sdb shell 0 applist`.
- **Correção de documentação:** os comandos E4 que eu havia sugerido
  (`sdb shell cat /etc/info.ini`, `ls /usr/apps`) **não funcionam** — não há shell.
- **Impacto de escopo:** sem root e sem shell, desabilitar serviços/apps de sistema está
  fora de alcance. Objetivo 1 passa a depender de controle de rede, não do device.
- **Rollback:** Developer Mode segue ligado. Desligar ao fim da sessão.
- **Registro:** [runbooks/e4-sdb-readonly.md](runbooks/e4-sdb-readonly.md)

---

## 2026-11-06 — E5 (preparação): resolver log-only montado na estação; TV ainda não apontada

- **Degrau:** 1 (estação). O degrau 2 (DNS manual na TV) ainda não foi aplicado.
- **Hipótese:** com a TV apontando para um forwarder transparente, o log revela o
  conjunto de domínios da Samsung (ads, telemetria, ACR, update) sem alterar o
  comportamento da TV.
- **Passos exatos:** `scripts/dns-logonly.sh start`; teste
  `dig @<HOST_IP> -p 5300 samsung.com`.
- **Resultado observado:** dnsmasq 2.92 sem root em `<HOST_IP>:5300`, encaminhando para
  `<GATEWAY_IP>`; query de teste respondida e logada em `evidence/raw-dns-<data>.log`
  (gitignored). **Confirmado.**
- **Achados da estação:** porta <1024 indisponível sem root
  (`ip_unprivileged_port_start = 1024`); 53 fechada na zona `FedoraWorkstation`. Daí o
  redirect 53→5300 por rich rule runtime, filtrada pela origem `<TV_IP>`.
- **Correção:** a entrada "PENDENTE — E5" anterior tinha texto copiado do E2 (Host PC IP);
  substituída por esta.
- **Pendente (usuário):** `fw-up` (sudo) e DNS manual na TV. Runbook:
  [runbooks/e5-dns-logonly.md](runbooks/e5-dns-logonly.md).
- **Rollback:** TV → DNS automático; `fw-down`; `stop`. Testado antes? `stop`/`start`
  sim; `fw-up`/`fw-down` não (exige sudo).
- **Risco de recuperação:** baixo. Pior caso: estação offline deixa a TV sem DNS até
  reverter no menu.

---

## 2026-11-07 — E9 (boot frio, tentativa 1): abriu no Smart Hub — inconclusivo

- **Passos:** TV tirada da tomada ~12:24 e religada.
- **Observado:** a TV subiu no Smart Hub. Último heartbeat do E8 12:24:35; nenhum
  `/e8/boot` depois → no boot frio o app em background **não** é reiniciado
  (Confirmado, 1 amostra).
- **Por que inconclusivo:** o log mostra o E8 em background (`hidden:true`) desde
  08:48:52 até o desligamento — ele **não** era o app em primeiro plano. O teste de
  "Executar automaticamente o último app" exige o E8 na frente no momento do corte, e
  o estado da opção no menu não foi registrado.
- **Complemento (usuário):** no corte o app na frente era o **YouTube**, e a TV voltou no
  Smart Hub, não no YouTube. Ou a opção "último app" estava desligada, ou ela **não se
  aplica após corte de energia** — a distinguir na tentativa 2 (opção conferida ligada).
- **Achado E5:** logo após religar, a TV resolve `log-ingestion-sa.samsungacr.com`
  (ACR — Automatic Content Recognition, pelo nome: **Provável**).

---

## 2026-11-07 — E9 (standby longo): processo sobrevive à noite e volta ao ligar

- **Degrau:** 3 (app próprio instalado; nada no sistema).
- **Hipótese:** em standby longo o Tizen mantém o processo do E8 congelado (como nos 98 s),
  em vez de encerrá-lo.
- **Passos exatos:** E8 (`E8BgTest01`) em background; TV desligada pelo controle às
  ~23:31 de 06/11; ligada às ~08:47 de 07/11. Coleta via `report-sink.py`
  (`evidence/raw-tv-report-20261106.log`).
- **Resultado observado:**
  - Último evento antes do standby 23:30:57; primeiro depois 08:47:32 → `/e9/wake
    "gap de 33384 s"` (9 h 16 min). Mesmo processo (sem `/e8/boot` antes do wake):
    **congelado, não encerrado** — Confirmado (1 amostra).
  - `/e8/front` pedido 08:47:36, `ok` 08:47:39, `visibility hidden:false` 08:47:39.
  - `online` **não** disparou desta vez (no standby de 98 s disparou). O gap de relógio
    é o sinal confiável; `online` fica como redundante.
  - No power-on sobem de novo `samsung-analytics`, `built-in-app-upgrader`,
    `samsung-service-manager`, `AirPlayWebApp`.
  - Durante o dia, com a TV ligada, o polling mostra serviços de terceiros (Spotify,
    Disney+, Prime companion, TV Plus deeplinker) subindo em ciclos de ~9 min — insumo
    para o E5.
- **Não medido:** tempo do botão até a home (só do wake). Pendente: boot frio.
- **Rollback:** `scripts/tv-app.sh uninstall experiments/e8-background`.

---

## 2026-11-06 — E8/E9: voltar para a home — captura impossível, power-on funciona

- **Degrau:** 3 (app de experimento `E8BgTest01`). Runbook:
  [runbooks/e8-background-boot.md](runbooks/e8-background-boot.md).
- **Requisito registrado:** só controle remoto; power-on na nossa home é mandatório.
- **Resultado:** captura de tecla em background **impossível**; listeners de estado de
  app **mudos**; serviço `on-boot` abre UI **congelada** (removido do pacote — risco de
  repetir no boot). Retorno quando o app de conteúdo fecha **funciona**, mas apps nem
  sempre fecham (Netflix suspende). **Power-on funciona** em standby de 98 s: processo
  congela, e ao ligar `online` + salto de relógio disparam `launch(self)`.
- **Erros próprios:** (1) li uma linha antiga do log como "UI aberta pelo serviço" —
  corrigido ao revisar a linha do tempo; (2) reinstalei o E8 enquanto o usuário testava,
  invalidando uma rodada; (3) dois `pkill -f` com padrão que casava o próprio shell.
- **Pendente:** standby de uma noite; boot frio + "último app".

---

## 2026-11-06 — tv-app v0.3 (E7): apps reais — listar, curar, abrir

- **Degrau:** 3 (nosso app). Rollback: `tv-app.sh uninstall src/tv-app/dist`.
- **Medido no device** (report-sink; bruto em `evidence/raw-tv-report-20261106.log`):
  - `getAppsInfo` devolve **todos os 310 apps** a um app nosso, sem filtro, em **~3 s**.
  - `show` **não basta** como filtro: 180 "visíveis", incluindo serviços internos
    (`AdPlayer`, `AgingApp`), stubs `cobalt-app-*`, entradas `-dummy`. Mas é
    **necessário**: sem ele entram `AirPlayWebApp`, `PrivacyChoices` etc.
  - `tizen.application.launch` **abre apps de terceiros**: HBO Max 584 ms, Netflix
    116 ms, `ok: true`. Sem bloqueio de privilégio.
  - **BACK no app aberto volta ao Smart Hub; Home abre o menu Samsung** sobre o app
    (observação do usuário). A nossa home não é retomada — confirma o limite de
    `architecture.md` ("mais um app"). **Confirmado.**
  - Ícones: 12 de 14 carregam (`/opt/usr/apps/...` legível pelo nosso app). **Netflix e
    Prime Video falham**, e o ícone do pacote não serve (mesmo caminho / vazio). Causa
    (inexistente vs. sem permissão) indeterminável: `sdb pull` é bloqueado para qualquer
    arquivo em `/opt/usr/apps/`.
  - Abertura: execute → `/boot` = **3,2 s**, dos quais ~0,4 s são nossos (JS em 247 ms
    após a navegação, render 126 ms, cache hit). **~2,8 s são a plataforma subindo o
    runtime web** — fora do alcance do código.
- **Implementado:** curadoria padrão (`data/curate.ts`: loja sem serviços + allowlist de
  pré-instalados; `adplatform.*` sempre fora), cache local (`data/appsCache.ts`), foco
  inicial no primeiro app, pulso visual no OK. 24 testes.
- **Erros próprios:** (1) regras derivadas só dos `show=true` e aplicadas sobre todos —
  entrou `adplatform.ADPlayer` ("adplatform" tem 10 caracteres). Corrigido + teste com
  os casos reais. (2) package ID derivado cortando o app ID no primeiro ponto — errado
  para não-loja. Medição refeita.
- **Pendente (usuário):** limpar a fileira para só os apps de interesse — vira a
  configuração de visibilidade do objetivo 3.
- **Hipótese a medir:** reabrir com o app ainda em memória (multitasking) deve ser
  muito mais rápido que os 3,2 s a frio.

---

## 2026-11-06 — tv-app v0.2: motor de foco direcional validado no device

- **Degrau:** 3 (atualização do nosso app). Rollback: `tv-app.sh uninstall src/tv-app/dist`.
- **O que entrou:** `src/focus/geometry.ts` (navegação espacial pura), `manager.ts`
  (memória por grupo), ponte Preact, fileiras com rolagem por transform. 16 testes Vitest.
- **Regras:** horizontal só na mesma linha (para na borda); vertical em duas fases
  (linha mais próxima, depois alinhamento); memória por fileira tem precedência.
- **Validação no device** (sequência de foco do report-sink cruzada com as regras):
  borda horizontal, fileira curta, memória de grupo e teclas rápidas se comportaram como
  especificado. Usuário: "bem bom".
- **Achados:** (1) geometria entregue ao motor é lógica (`offsetLeft`, imune ao
  transform em transição) — sem isso, cliques rápidos decidiriam com posições
  intermediárias; (2) OK dispara a seleção, mas **sem feedback visual** — percebido como
  "não fez nada". A resolver com ação real (abrir app).

---

## 2026-11-06 — tv-app: esqueleto (ADR-0003) instalado no device

- **Degrau:** 3. Rollback: `scripts/tv-app.sh uninstall src/tv-app/dist` (mesmo mecanismo
  validado no E6).
- **Passos exatos:** `npm run check && npm run build:dev` em `src/tv-app`;
  `scripts/tv-app.sh install src/tv-app/dist` (2×); `run`.
- **Resultado observado:** `OtvHome001.home` instalado e aberto; boot report recebido:
  render inicial **94 ms**, 5 teclas extras registradas. Bundle de produção 11,8 KB
  (5,1 KB gz).
- **Achados do setup (ADR-0003 atualizado):**
  - **Preact 11 incompatível com o M69** (`queueMicrotask`, Chrome 71+). Fixado o 10.
  - stylelint validado com sonda: pega flex `gap` e `:focus-visible`, **não pega
    `aspect-ratio`**.
  - `tv-app.sh` quebrava na 2ª execução: o CLI reescreve o perfil de assinatura.
    Corrigido (zera senhas a cada execução).
- **Estado final:** app instalado no device (nosso, degrau 3).

---

## 2026-11-06 — Checklist de recuperação: auto-update confirmado desligado

- **Degrau:** 0 (leitura de menu, nada alterado).
- **Observado:** Suporte → Atualização de Software → **Atualização Automática:
  desligada**, confirmado pelo usuário no device (pela foto, o indicador do menu sozinho
  era ambíguo). Versão exibida no menu bate com o sufixo de `<TV_FIRMWARE>` — **sem update desde o
  discovery**.
- **Fecha** a pendência registrada no E6. Restam: fotos completas das telas de
  configuração e caminho de factory reset.

---

## 2026-11-06 — E6: hello-world assinado instalado, medido e removido

- **Degrau:** 3. Rollback testado: sim (desinstalação executada e verificada).
- **Pré-condição registrada:** usuário autorizou seguir. Atualização automática de firmware
  **não registrada explicitamente** como desligada — pendência da checklist de
  `rollback-strategy.md`, junto com o caminho de factory reset.
- **Hipótese:** o device instala um web app próprio via SDB; incerto se exigiria
  certificado Samsung (incógnita 9).
- **Passos exatos:** `tizen certificate` + `tizen security-profiles add` (assinatura Tizen
  comum); `scripts/tv-app.sh install|run|uninstall experiments/e6-hello`. Runbook:
  [runbooks/e6-hello-world.md](runbooks/e6-hello-world.md).
- **Resultado observado:**
  - Assinatura Tizen comum **aceita** — certificado Samsung desnecessário em Developer
    Mode. Incógnita 9 contornada.
  - `tizen install` falhou sem diagnóstico; `sdb shell 0 vd_appinstall` funcionou.
  - Update por cima (v0.1 → v0.2) funcionou.
  - Runtime: **Chromium 69.0.3497.106** confirmado do device; sem optional chaining,
    `??`, flex `gap`, `:focus-visible`; 1920×1080 dpr 1. Teclas mapeadas (setas, OK,
    BACK, coloridas, Play/Pause). Detalhes em `device-baseline.md`.
  - Primeira tentativa de uninstall com app ID: `failed[132]`. Com package ID: removido;
    applist 310 → **309** (igual ao E4).
- **Erro próprio:** o teste de flex gap da v0.1 (`CSS.supports`) dava falso positivo;
  corrigido na v0.2 com medição de layout.
- **Estado final:** app removido. Developer Mode segue ligado (política vigente).
- **Risco de recuperação:** nenhum residual.

---

## 2026-11-06 — E5 (coleta iniciada): TV apontada para o resolver

- **Degrau:** 2. `scripts/dns-logonly.sh fw-up` (2/2 regras ativas) e DNS manual na TV =
  `<HOST_IP>`. Foto da tela de IP Settings original tirada antes.
- **Resultado observado:** queries da TV chegando imediatamente — 180 nos primeiros
  minutos. Redirect 53→5300 por rich rule local com filtro de origem: **Confirmado**.
- **Primeira leitura (não é o mapa final):** domínios Samsung (`samsungqbe.com`,
  `samsungcloudsolution.com`, `samsungcloudcdn.com`) e `adgrx.com` (`tvx.`, `rtb.`) já
  aparecem, ao lado do tráfego dos apps (Netflix, YouTube, Disney/bamgrid). Atribuir
  `adgrx.com` à Samsung Ads: **Hipótese**, a confirmar com fonte.
- **Implicação parcial:** pelo menos parte da resolução respeita o DNS manual. Ainda não
  descarta resolver hardcoded para outros serviços.
- **Rollback:** TV → DNS automático; `fw-down`; `stop`.

---

## 2026-11-06 — Política: Developer Mode pode permanecer ligado

- **Decisão do usuário:** removida a regra "desligar o Developer Mode ao fim da sessão"
  (`security.md`, regra 2).
- **Base:** E2 confirmou que o `developerIP` funciona como allowlist (conexões de outro IP
  são fechadas em ~0,02 s sem handshake), e E4 confirmou sem root e sem shell.
- **Risco residual aceito:** um host que assuma `<HOST_IP>` (lease liberado, outro device
  ou spoofing) obtém acesso SDB — instalar/remover apps de terceiros. Superfície do
  próprio `sdbd` exposta na LAN. Ambos **Prováveis**, não testados.
- **Mantido:** `developerIP` fixado na estação com lease reservado (E1); 26101 nunca fora
  da LAN (regra 1).

---

<!-- Template para novas entradas:

## YYYY-MM-DD — <ID>: <título>

- **Degrau:**
- **Hipótese:**
- **Passos exatos:**
- **Resultado esperado:**
- **Resultado observado:**
- **Validação:**
- **Rollback:** (testado antes? sim/não)
- **Risco de recuperação:** (aceito por quem, quando)

-->
