# Discovery report — Milestone 1

Data: 2026-11-06 · Autor: sessão de discovery assistida · Escopo: coleta passiva e
não-invasiva, estação Fedora + LAN. **Nenhuma mudança foi feita no device.**

Níveis de confiança: **Confirmado** (observado diretamente ou documentação oficial) ·
**Provável** (inferência forte com base de apoio) · **Hipótese** (plausível, sem evidência).

---

## 1. Estação de desenvolvimento

| Item | Valor | Confiança |
| --- | --- | --- |
| OS | Fedora 44, kernel 7.1.10-200.fc44.x86_64, x86_64 | Confirmado |
| RAM | 30 GiB | Confirmado |
| JDK | **somente** OpenJDK 25.0.4.1 (`java-25-openjdk`) | Confirmado |
| Node / npm | v26.3.1 / 11.16.0 | Confirmado |
| .NET SDK | 10.0.301 (+ ASP.NET Core 10.0.9) | Confirmado |
| Toolchain Tizen | **ausente** — sem `tizen`, sem `sdb`, sem `~/tizen-studio` | Confirmado |
| Containers | podman 5.8.4, flatpak 1.18.1 (docker ausente) | Confirmado |

### Achado 1.1 — Fedora não é um host suportado pelo Tizen Studio

As prerequisites oficiais listam apenas **"Ubuntu 14.x or higher"** como Linux suportado,
e **"Java Development Kit 1.8 or higher"**.

Atualização 2026-11-06, lendo o próprio instalador (`web-cli_Tizen_Studio_6.1_ubuntu-64.bin`):

- **O JDK vem embutido.** O wrapper descompacta `jdk/*` em `~/.package-manager/jdk` e só usa
  o Java do sistema com `--use-system-java`/`-s`. O OpenJDK 25 do host é **irrelevante** —
  hipótese do achado original agora **refutada**. Confiança: Confirmado.
- **O instalador aborta como root** (`if [ \`whoami\` = "root" ]`). Qualquer container
  precisa de usuário não-root. Confiança: Confirmado.
- **No Ubuntu ele só checa `grep` e `zip`.** A lista pesada de dependências é do branch
  Fedora — que, curiosamente, **existe** no script, apesar de a doc oficial listar só Ubuntu.
- Flags reais (arquivo `HELP`): `--show-license`, `--accept-license`, `--no-java-check`.
- Existe uma variante **`web-cli`** além da `web-ide`: toolchain sem GUI. Isso **elimina**
  o atrito de X11/Wayland que motivava metade do risco da ADR-0002.

Mitigação adotada: `podman` + Ubuntu 24.04 + instalador `web-cli`, `--network host` para o
SDB alcançar a LAN. Implementado em `infra/Containerfile`. Ver ADR-0002.

### Achado 1.2 — versão do toolchain a usar

Tizen Studio **6.1** é a versão corrente no portal. TVs 2020 exigem **"TV Extension 5.5 or
higher"**. Também relevante: a criação de certificados exige **Samsung Certificate Extension
≥ 2.0.73** (versões anteriores deixaram de funcionar após setembro de 2025) — ou seja, não
reaproveitar tutoriais antigos para a etapa de assinatura.

**Resolvido (2026-11-06).** Inspeção direta de
`https://download.tizen.org/sdk/extensions/tv_extensions/pkg_list_ubuntu-64`:
o canal corrente serve **apenas `TV-SAMSUNG-Public` → "TV Extensions-10.0"**. Em
`snapshots/`, o mais antigo disponível é **7.0.0 (dez/2022)**. **Não existe mais extensão
da era 5.5.** Confiança: Confirmado.

Consequências:

1. O requisito oficial "TV Extension 5.5 or higher" é satisfeito pela 10.0 — para **web
   app**, o alvo de plataforma é declarado no `config.xml` (`required_version`), não pela
   versão da extensão.
2. **O emulador será 10.0 e não representa o Chromium M69 do device.** Testar no emulador
   dá falso positivo em tudo que importa aqui. Validação é no hardware real — reforça E6.
3. A Certificate Extension está disponível em `https://download.tizen.org/sdk/extensions/`,
   até **2.0.75** — acima do piso de 2.0.73.

**Refinamento importante (2026-11-06, após instalar).** "Não existe extensão 5.5" vale para
o *pacote TV Extension*, e isso não impede targetar 5.5:

- O baseline do Tizen Studio instala **`platforms/tizen-5.5/`** contendo `common`, `mobile`,
  **`tv`** e **`tv-samsung`**. Confiança: Confirmado (inspeção do filesystem).
- O `tizen` CLI expõe o perfil de build **`tv-5.5`** (`tizen list web-project`), junto com
  `tv-2.4` até `tv-9.0`. Ou seja, **build e empacotamento para 5.5 são suportados**.
- O que *não* existe em 5.5 são os **templates de projeto Samsung**: eles só aparecem como
  `tv-samsung-3.0` e `tv-samsung-10.0`. Irrelevante — template é scaffolding, não runtime.
- O que continua valendo: **o emulador é 10.0 e não emula o M69**. Essa é a limitação real,
  não a capacidade de targetar 5.5.

### Achado 1.3 — o package manager mente no exit code

`package-manager-cli.bin install` **retorna exit code 0 mesmo quando a instalação falha**.
Observado duas vezes: primeiro com `rpm2cpio`/`cpio` ausentes, depois com as libs KF5
ausentes. Em ambos os casos o log trazia `** Error ** Failed to install the following
packages automatically` e os pacotes seguiam como `ni` (not installed) — com exit 0.

Dependências de OS que o package manager exige e **tenta instalar sozinho via apt**,
falhando por não ser root (ele roda como usuário não-privilegiado):

| Pacote Ubuntu 24.04 | Para quê |
| --- | --- |
| `cpio`, `rpm2cpio` | as extensões Samsung são distribuídas em **RPM** |
| `libkf5itemmodels5`, `libkf5kiowidgets5`, `libkchart2` | exigidas pelo package manager |

Mitigação implementada: pré-instalar tudo como root no `infra/Containerfile` e **verificar
explicitamente** que os pacotes saíram de `ni`, falhando o build se não. Sem esse guard um
build quebrado passaria como verde — foi exatamente o que aconteceu na primeira tentativa.

---

## 2. Rede

| Item | Valor | Confiança |
| --- | --- | --- |
| Sub-rede | `<LAN_SUBNET>`, gateway `<GATEWAY_IP>` | Confirmado |
| Gateway | OUI `00:1A:3F` → <GATEWAY_VENDOR> | Confirmado |
| DNS atual | `<GATEWAY_IP>` (o próprio roteador), sem DoT, DNSSEC indisponível | Confirmado |
| Estação | `<HOST_IP>` via `wlo1` (Wi-Fi) | Confirmado |
| Tailscale | ativo, `<TAILSCALE_IP>`, DNS `100.100.100.100` | Confirmado |

### Achado 2.1 — o DNS do roteador é o ponto de controle natural

Todo o LAN resolve pelo `<GATEWAY_IP>`. Isso favorece o plano de filtragem DNS: um resolver
próprio (Pi-hole/AdGuard/Unbound) anunciado por DHCP, com fallback para o roteador. Rollback
= reverter uma opção de DHCP, sem tocar na TV.

Observação: a TV está em **Wi-Fi**, não cabeada. Se ela ignorar o DNS do DHCP (alguns
firmwares Samsung têm fallback hardcoded para `8.8.8.8`), será preciso redirect/bloqueio de
saída na porta 53 no roteador. **Hipótese não testada** neste modelo.

Nota: o Tailscale já oferece caminho remoto seguro para a API futura — não há motivo para
expor nada do LAN à internet. Ver `docs/security.md`.

### Achado 2.2 — identificação do device sem scan

A TV foi localizada **sem port scan**: cache ARP (`ip neigh`) + lookup de OUI na base local
`hwdata`. `<TV_IP>` e `<STALE_IP>` compartilham o mesmo MAC — o `.215` é lease antigo
(STALE, não responde). O IP é DHCP: **reservar lease fixo** antes de qualquer trabalho de SDB.

---

## 3. Device

Fatos completos em [device-baseline.md](device-baseline.md). Aqui, só o que muda o plano.

### Achado 3.1b — `developerIP` é allowlist, não só metadado (2026-11-06)

Com Developer Mode `"1"` e **26101 aberta**, `sdb connect` ainda falha se o `developerIP`
não for o IP de origem da conexão. Observado com `developerIP: "<TV_IP>"` (a própria TV)
e conexão partindo de `<HOST_IP>`: `failed to connect`.

**Evidência direta do mecanismo** (socket cru, 2026-11-06): a TV **aceita** o handshake TCP
vindo de `<HOST_IP>` e **fecha a conexão em ~0,01 s sem enviar nenhum byte**.

```
TCP conectado, origem: ('<HOST_IP>', 33878)
TV FECHOU a conexão após 0.01s sem enviar nada
```

Isso descarta filtro de pacotes (um `DROP`/`REJECT` não completaria o handshake) e descarta
serviço ausente. O padrão accept-then-immediate-close é **rejeição na camada de aplicação**:
o daemon aceita, compara o IP de origem com o `developerIP` registrado, e derruba.

Consequência operacional: **"porta 26101 aberta" não é critério de sucesso do E2.** O
critério é `developerIP` == IP da estação. O runbook foi corrigido para verificar isso
*antes* do reboot, já que reboot com o valor errado é tempo perdido.

Consequência de projeto: o IP da estação é **parte da configuração do device**. Lease DHCP
fixo para a estação não é higiene opcional — é pré-requisito funcional. Já incorporado em E1.

**Confirmado em 2026-11-06.** Com `developerIP` corrigido para o IP da estação, o
comportamento do socket inverteu na hora: de *fecha em 0,02 s* para *mantida aberta
aguardando handshake*. `sdb connect` passou, e `sdb devices` lista o device.

Dois detalhes operacionais que valem registro:

- **Não foi preciso rebootar** após corrigir o `developerIP`. O daemon aplicou
  imediatamente. O reboot só foi necessário na habilitação inicial do Developer Mode.
- O campo **Host PC IP** não gravou nas duas primeiras tentativas. A terceira, apagando o
  conteúdo anterior antes de digitar, funcionou.

### Achado 3.1 — Developer Mode está DESLIGADO (estado inicial, 2026-11-06)

```
developerMode: "0"
developerIP:   "0.0.0.0"
```

Porta **26101 (SDB) fechada/filtrada** — consistente. Os passos 4–6 do milestone (SDB,
versão do Tizen, APIs suportadas, constraints de instalação) estão **bloqueados** até o
Developer Mode ser habilitado, e isso exige **interação física com o controle remoto**
(Apps → sequência numérica), não é acionável remotamente. Reversível: desligar no mesmo menu.

**Atualização 2026-11-06:** Developer Mode foi habilitado (tentativa 1 do E2). `developerMode`
= `"1"`, 26101 aberta, mas `developerIP` ficou incorreto — ver achado 3.1b e o change-log.

### Achado 3.2 — superfície de rede exposta

| Porta | Estado | O que é |
| --- | --- | --- |
| 8001 | aberta | REST + WebSocket em claro, **sem autenticação** no `GET /api/v2/` |
| 8002 | aberta | WebSocket seguro (wss), com token auth |
| 9197 | aberta | UPnP MediaRenderer (descritor DLNA) |
| 26101 | fechada | SDB — fechada porque devmode está off |

`:8001/ms/1.0/` retorna 404 — o endpoint DIAL legado não está nesse path neste firmware.

### Achado 3.3 — serial exposto sem autenticação (privacidade)

`GET http://<tv>:9197/dmr` devolve, sem nenhuma credencial, o `serialNumber` e o `UDN`,
e repete o serial dentro de `sec:ProductCap`. Qualquer dispositivo no LAN consegue o serial
da TV. Não é uma vulnerabilidade explorável por si, mas é um identificador estável e
correlacionável — e é exatamente o dado que o handoff manda não publicar. Reforça a decisão
de manter `evidence/raw-*` fora do git.

### Achado 3.4 — grupo de modelo e plataforma

O `modelName` do device mapeia para um lineup que a documentação oficial de TV Model Groups
coloca em **`20TV_BASIC1`** (grupo de entrada dos modelos 2020). Consequências documentadas:

- **Tizen 5.5** é a plataforma dos modelos 2020. *Confirmado pela documentação por ano de
  modelo; ainda não lido do device.*
- Web engine **Chromium M69**, V8; HTTP/2, Fetch, ReadableStream, WebSocket, TLS 1.2.
- User agent esperado: `Mozilla/5.0 (SMART-TV; LINUX; Tizen 5.5) AppleWebKit/537.36 (KHTML,
  like Gecko) 69.0.3497.106.1/5.5 TV Safari/537.36`.
- **Multitasking é suportado** em `20TV_PREMIUM`, `20TV_STANDARD` e `20TV_BASIC1` — este
  device está incluído. (`20TV_BASIC2` não é.) Relevante para o app de home continuar
  residente.

Implicação direta para `src/tv-app`: alvo é **Chromium 69**. Sem optional chaining nativo
confiável, sem `??`, cuidado com `ResizeObserver`/`IntersectionObserver` v2. Target de build
≈ ES2017, com polyfills explícitos. Nada de assumir baseline moderno.

### Achado 3.5 — DRM reportado como ausente

`isSupport` traz `DMP_DRM_PLAYREADY: false` e `DMP_DRM_WIDEVINE: false`, embora a doc da
plataforma 2020 liste PlayReady 4.2 e Widevine 15.2. **Provável** que esse payload descreva
as capacidades do *canal de controle remoto*, não do player da plataforma. Não tirar
conclusão sobre playback a partir disso. Irrelevante para o escopo atual (home launcher).

---

## 4. Restrições do handoff — status de validação

| Afirmação a validar | Status |
| --- | --- |
| Tizen ≠ Android; APK/launcher Android não se aplicam | **Confirmado** — `OS: Tizen`, `Y2020` |
| App custom não substitui o Smart Hub nem suprime ads fora da própria UI | **Provável** — nenhuma API pública de substituição de home existe na doc Samsung TV; a confirmar com a doc de TV Extension 5.5 |
| Ocultar app no launcher ≠ desinstalar/desabilitar app de sistema | **Confirmado** — 309 apps inventariados; sem root não há como desabilitá-los |
| SDB não dá root | **Confirmado** — `sdbd_rootperm:disabled`, `rootonoff_support:disabled` |
| Controle de background/serviços restrito | **Confirmado** — sem root e sem shell (`intershell_support:disabled`) |

---

## 4b. Achado 3.5 — o que o SDB permite, e o que não (2026-11-06)

`sdb capability`, com SDB finalmente conectado. **Isto redefine o escopo viável do projeto.**

| Capability | Valor | Consequência |
| --- | --- | --- |
| `platform_version` | `5.5` | Tizen 5.5 **confirmado do device** |
| `cpu_arch` | `armv7` | ARM 32-bit |
| `sdbd_rootperm` | **disabled** | **sem root** |
| `rootonoff_support` | **disabled** | root **não é alternável** |
| `intershell_support` | **disabled** | **sem shell arbitrário** |
| `filesync_support` | pushpull | push/pull de arquivos ok |
| `pkgcmd_debugmode` | enabled | instalar/remover app próprio ok |

### Sem shell: o que funciona no lugar

`sdb shell "cat /etc/info.ini"` e `sdb shell "ls /usr/apps"` **retornam vazio** — não há
shell. O runbook foi corrigido; sugeri esses comandos antes de ter o device na mão.

O que funciona são os comandos embutidos do `sdbd`:

```bash
./scripts/tizen.sh sdb shell 0 applist   # inventário de apps
```

Inventário coletado: **309 apps** — 134 `org.tizen.*`, 130 `com.samsung.*`, ~30 de
terceiros, 44 com "service" no nome. Bruto em `evidence/raw-applist-*.txt` (gitignored).

### Impacto nos objetivos do projeto

| Objetivo | Viabilidade após este achado |
| --- | --- |
| 1. Reduzir ads/telemetria/background | **Reduzido.** Sem root e sem shell, desabilitar serviços de sistema está fora de alcance em firmware de varejo. O lever real passa a ser **controle de rede (DNS)**, não o device. |
| 2. Home custom minimalista | **Inalterado.** App Tizen próprio, instalável via `pkgcmd_debugmode`. |
| 3. Ocultar apps | **Parcialmente.** Ocultar na *nossa* UI: sim. Desinstalar/desabilitar app de sistema Samsung: **não**, sem root. |
| 4. Agente de recomendação | **Inalterado.** Fora do device. |

Isto **confirma** a restrição que o handoff listava como hipótese ("SDB não dá root") e
rebaixa a expectativa do objetivo 1. Honestidade sobre isso agora evita semanas gastas
tentando desabilitar serviços que o firmware não permite desabilitar.

## 5. Incógnitas abertas

1. ~~Versão exata do Tizen lida do device.~~ **Resolvida: `platform_version:5.5`.**
2. ~~Developer Mode é habilitável neste firmware?~~ **Resolvida: sim**, pelo painel Apps
   com a sequência `12345`. O campo **Host PC IP** é o ponto crítico, e **não é preciso
   rebootar** após corrigi-lo — o daemon aplica na hora (só a habilitação inicial pediu
   reboot).
3. ~~Tizen Studio 6.1 ainda entrega TV Extension compatível com plataforma 5.5?~~ **Resolvida** — só 10.0; sem emulador fiel ao M69 (achado 1.2).
4. Tizen Studio funciona em container Ubuntu sob podman no Fedora 44, com SDB alcançando a LAN?
5. A TV respeita o DNS entregue por DHCP, ou tem fallback hardcoded?
6. Existe API/configuração suportada que altere a home da TV, ou o app custom é
   necessariamente "só mais um app"?
7. `smartHubAgreement: "true"` — revogar esse consentimento reduz telemetria de forma
   observável? Como medir (captura no resolver DNS)?
8. ~~Subcomandos reais do `package-manager-cli` para ativar repositório headless?~~
   **Resolvida** — `extra --list [--detail]`, `extra --add -n <nome> -r <addr>`,
   `extra -act|-dact <índice>`, `install [--accept-license] [--no-java-check] <pkg>[,...]`.
   E o `--add` nem era necessário: o repo **"Samsung Tizen TV SDK" já vem pré-registrado**
   (índice 3) e ativo, assim como a **Certificate Extension 2.0.75** (índice 1).
9. ~~Como criar o perfil de certificado de distribuição Samsung **sem GUI**?~~
   **Contornada (E6, 2026-11-06)** — para instalar via SDB com Developer Mode ligado, o
   device **aceita assinatura Tizen comum** (autor via `tizen certificate` + distribuidor
   Tizen público do SDK). Certificado Samsung não foi necessário. Continua em aberto para
   qualquer distribuição fora do modo de desenvolvimento. Registro do fluxo Samsung, lido
   do jar do `cert-add-on` (não executado): OAuth em `account.samsung.com` com retorno em
   `http://localhost`, CSRs enviados a `svdca.samsungqbe.com/apis/v3/{authors,distributors}`.

## 6. Próximos experimentos (em ordem, cada um reversível)

| # | Experimento | Rollback | Risco |
| --- | --- | --- | --- |
| E1 | Reservar lease DHCP fixo para a TV **e para a estação** no roteador | Remover reserva | Nenhum |
| E2 | Habilitar Developer Mode pelo menu da TV, apontando para `<HOST_IP>` | Desligar no mesmo menu | Baixo, reversível |
| E3 | Instalar Tizen Studio 6.1 + TV Extension em container Ubuntu via podman | Apagar o container | Nenhum no device |
| E4 | `sdb connect` + comandos somente-leitura (`capability`, `shell cat /etc/info.ini`) para fixar a versão do Tizen e o inventário de apps | Desconectar | Baixo |
| E5 | Resolver DNS próprio em modo **log-only** (sem bloquear) para mapear os domínios que a TV contata | Reverter opção de DHCP | Baixo |
| E6 | Hello-world Tizen assinado, instalado e removido — valida o ciclo completo de deploy | `sdb uninstall` | Baixo |

E1 e E3 não dependem de ninguém e podem começar já. E2 depende do usuário com o controle
na mão. E4–E6 dependem de E2 e E3.

**Correção (2026-11-06):** E1 passou a incluir o lease da **estação**, não só da TV. O
Developer Mode fixa `developerIP` no IP do host; se o `<HOST_IP>` da estação mudar por
DHCP, a TV recusa a conexão SDB e E2 tem de ser refeito. E1 virou pré-requisito de E2,
não um experimento paralelo. Runbook: `docs/runbooks/e2-developer-mode.md`.

**Status de E3 (2026-11-06):** `infra/Containerfile` escrito e em build; wrapper em
`scripts/tizen.sh`. Pendente: confirmar os subcomandos reais do `package-manager-cli`
para ativar o repositório de extensão (ver incógnita 8).

## 7. Fontes

- [General Specifications](https://developer.samsung.com/smarttv/develop/specifications/general-specifications.html)
- [TV Model Groups](https://developer.samsung.com/smarttv/develop/specifications/tv-model-groups.html)
- [Web Engine Specifications](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html)
- [Multitasking](https://developer.samsung.com/smarttv/develop/guides/fundamentals/multitasking.html)
- [Retrieving Platform Information](https://developer.samsung.com/smarttv/develop/guides/fundamentals/retrieving-platform-information.html)
- [Installing TV SDK](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html)
- [Prerequisites](https://developer.samsung.com/smarttv/develop/tools/prerequisites.html)
- [Tizen 5.5 Public M3 release notes](https://docs.tizen.org/platform/release-notes/tizen-5-5-m3/)
