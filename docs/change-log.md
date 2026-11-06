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
