# Architecture

> **Atualização 2026-11-06 (E4).** O device confirmou **Tizen 5.5**, **armv7**, e —
> decisivo — **sem root** (`sdbd_rootperm:disabled`) e **sem shell**
> (`intershell_support:disabled`). Desabilitar serviços ou apps de sistema Samsung está
> **fora de alcance** neste firmware. O objetivo de reduzir ads/telemetria depende agora
> de **controle de rede**, não do device. Ver `docs/runbooks/e4-sdb-readonly.md`.

**Status: direção de trabalho, não capacidades confirmadas.** Revisar após E2–E4 do
discovery. Fatos confirmados estão em [device-baseline.md](device-baseline.md).

## Princípio central

Separar **control plane** de **TV runtime**. A TV não depende da API para funcionar.

```
┌─────────────────────────┐        ┌──────────────────────────┐
│  TV runtime (Tizen 5.5) │        │  Control plane           │
│  src/tv-app             │        │  src/api (ASP.NET Core)  │
│                         │        │  Hostinger VPC           │
│  - UI de home própria   │ HTTPS  │  - preferências          │
│  - cache local          │◄──────►│  - catálogo              │
│  - funciona OFFLINE     │ (opc.) │  - histórico             │
└─────────────────────────┘        └───────────┬──────────────┘
                                               │ acesso escopado
                                   ┌───────────▼──────────────┐
                                   │  src/agent               │
                                   │  recomendação (fase 4)   │
                                   └──────────────────────────┘

        ┌──────────────────────────────────────────┐
        │  Network controls (fora do device)       │
        │  resolver DNS próprio + allowlist        │
        │  rollback = opção de DHCP                │
        └──────────────────────────────────────────┘
```

## TV runtime — `src/tv-app`

App web Tizen, TypeScript/HTML/CSS.

**Restrição dura confirmada: o alvo é Chromium M69** (Tizen 5.5, 2020). Isso define o build:

- target ≈ **ES2017**, sem optional chaining / nullish coalescing nativos (**medido no
  device**, E6)
- **sem `gap` em flexbox** e **sem `:focus-visible`** (medido, E6): espaçamento por margem
  ou grid; foco por classe própria
- `ResizeObserver` e `IntersectionObserver` v1 presentes (medido, E6)
- canvas da UI: **1920×1080, dpr 1**
- teclas coloridas e de mídia exigem `tvinputdevice.registerKey` + privilégio
  `tv.inputdevice`; códigos em `device-baseline.md`
- UA esperado: `... (SMART-TV; LINUX; Tizen 5.5) ... 69.0.3497.106.1/5.5 ...`
- navegação **por controle remoto**: foco direcional, sem hover, sem ponteiro.
  Área mínima de alvo e estado de foco visível são requisitos de acessibilidade aqui, não
  refinamento.

**A UI core deve ser utilizável com API e internet indisponíveis.** Cache local é a fonte
primária; a rede é enriquecimento.

O grupo deste modelo (`20TV_BASIC1`) **suporta multitasking** — a favor do app permanecer
residente. Ainda a validar na prática.

### Limite importante

Um app Tizen custom **não substitui o Smart Hub** nem suprime anúncios fora da própria UI.
Nenhuma API pública Samsung para troca de home foi identificada. Enquanto isso não for
refutado, o app é "mais um app" — e o ganho de "esconder apps" é escopado à nossa própria UI.
Supressão de ads fora dela depende de **controles de rede**, não do app. Ver incógnita 6 do
discovery report.

## Control plane — `src/api`

ASP.NET Core (estação já tem .NET SDK 10.0.301). Hostinger VPC. HTTPS + autenticação
obrigatórios.

Persistência: **SQLite** no protótipo; migrar para **PostgreSQL** quando houver estado
compartilhado real ou o agente entrar. Decidir via ADR quando o gatilho acontecer, não antes.

## Agent — `src/agent`

Serviço separado, fase posterior. Acesso **explícito e escopado** aos dados de preferência.
Nunca credenciais do device. Introduzir só quando o runtime e a API estiverem estáveis.

## Network controls — `infra`  ← principal lever do objetivo 1

O LAN resolve DNS pelo roteador `<GATEWAY_IP>`. Plano: resolver próprio anunciado por DHCP,
**começando em modo log-only** para mapear os domínios que a TV contata antes de bloquear
qualquer coisa. Allowlist, não blocklist cega. Rollback = reverter a opção de DHCP, sem
tocar na TV.

Risco aberto: firmwares Samsung podem ignorar o DNS do DHCP e usar fallback hardcoded.
Não verificado neste modelo.

## Caminho remoto

Tailscale já está ativo na estação. Para qualquer acesso remoto, é o caminho — não exposição
pública. SDB nunca sai do LAN.
