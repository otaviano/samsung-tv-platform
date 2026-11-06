# E4 — Inventário somente-leitura via SDB

- **Degrau de reversibilidade:** 1 (somente leitura; nada escrito no device)
- **Pré-requisitos:** [E2](e2-developer-mode.md) e [E3](e3-toolchain-container.md)
- **Executado:** 2026-11-06

## Comandos

```bash
cd ~/source/repos/samsung-tv-platform && source device.env
./scripts/tizen.sh sdb connect "$TV_IP:26101"
./scripts/tizen.sh sdb devices
./scripts/tizen.sh sdb capability
./scripts/tizen.sh sdb shell 0 applist > evidence/raw-applist-$(date +%Y%m%d).txt
```

## O que o device permite

De `sdb capability`:

| Capability | Valor | Leitura |
| --- | --- | --- |
| `platform_version` | **5.5** | Tizen 5.5, confirmado do device |
| `cpu_arch` | **armv7** | ARM 32-bit |
| `profile_name` / `can_launch` | `tv` / `tv-samsung` | |
| `product_version` | 4.0 | versão do produto, ≠ plataforma |
| `sdbd_version` | 2.2.31 (`3.8.0_TV_REL`) | |
| `sdbd_rootperm` | **disabled** | **sem root** |
| `rootonoff_support` | **disabled** | root não é alternável |
| `intershell_support` | **disabled** | **sem shell arbitrário** |
| `appcmd_support` | disabled | |
| `pkgcmd_debugmode` | **enabled** | instalar/remover app próprio: ok |
| `filesync_support` | pushpull | `sdb push`/`pull`: ok |
| `secure_protocol` | enabled | |
| `multiuser_support` | enabled | apps do usuário sob uid 5001 |

## Sem shell — o que usar no lugar

`sdb shell "<comando>"` **retorna vazio**. Não há shell neste firmware. Funcionam os
comandos embutidos do `sdbd`, na forma `sdb shell 0 <cmd>`:

| Comando | Resultado |
| --- | --- |
| `sdb shell 0 applist` | lista de apps com nome e AppID |
| `sdb shell 0 vd_gpginfo` | vazio neste device |
| `sdb shell 0 debugmode` | vazio neste device |

## Inventário de apps

**309 apps.** Distribuição por namespace:

| Namespace | Qtd |
| --- | --- |
| `org.tizen.*` | 134 |
| `com.samsung.*` | 130 |
| terceiros (id alfanumérico) | ~30 |
| contendo "service" no nome | 44 |

Bruto em `evidence/raw-applist-*.txt` (**gitignored** — revela o que está instalado).

## Conclusão que muda o escopo

Sem root e sem shell, **desabilitar serviços ou apps de sistema Samsung está fora de
alcance** em firmware de varejo. Consequências:

- Objetivo 1 (reduzir ads/telemetria/background): o lever real é **controle de rede (DNS)**,
  não o device. Ver `docs/architecture.md`.
- Objetivo 3 (ocultar apps): viável **dentro da nossa UI**; desinstalar/desabilitar app
  Samsung, não.
- Objetivo 2 (home custom): inalterado — `pkgcmd_debugmode:enabled` permite instalar o
  app próprio.

## Próximo

E5 (resolver DNS em modo log-only) ganha prioridade sobre E6, por ser agora o principal
caminho para o objetivo 1.
