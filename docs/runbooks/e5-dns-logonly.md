# E5 — Resolver DNS em modo log-only

**Objetivo:** mapear todos os domínios que a TV resolve, **sem bloquear nada**, como base
para a futura allowlist do objetivo 1. Depois do E4, controle de rede é o único caminho
real para reduzir ads/telemetria (sem root, sem shell).

**Degraus:** 1 (resolver e firewall na estação) + 2 (DNS manual no menu da TV).
**Developer Mode não é necessário** — indiferente para este experimento.

## Desenho

```
TV ──udp/tcp 53──► <HOST_IP>:53 ──(firewalld, só origem <TV_IP>)──► :5300 dnsmasq ──► <GATEWAY_IP>
                                                                       │
                                                         evidence/raw-dns-<data>.log
```

| Decisão | Motivo |
| --- | --- |
| DNS manual **na TV**, não opção de DHCP no roteador | Afeta só a TV; rollback pelo mesmo menu; o resto da LAN não depende da estação |
| dnsmasq **sem root** na 5300 | Rootless não abre porta <1024 (`net.ipv4.ip_unprivileged_port_start = 1024`) |
| Redirect 53→5300 por **rich rule runtime**, filtrada por origem `<TV_IP>` | Nada persiste: `fw-down` ou reboot desfaz; nenhum outro host é redirecionado |
| Upstream = `<GATEWAY_IP>`, `cache-size=0`, sem `bogus-priv`/`domain-needed` | A TV recebe as mesmas respostas de hoje — observação, não intervenção |

Observado na estação (2026-11-06): `systemd-resolved` escuta só em `127.0.0.53`/`127.0.0.54`
(sem conflito em `<HOST_IP>`); zona firewalld `FedoraWorkstation` libera 1025–65535 mas
não a 53; `dnsmasq 2.92` instalado. Teste local: `dig @<HOST_IP> -p 5300 samsung.com` →
resposta encaminhada e logada. **Confirmado.**

## Pré-condições

- [ ] `<HOST_IP>` reservado no DHCP (E1). Se a estação mudar de IP, a TV fica sem DNS.
- [ ] Estação ligada e **sem suspender** durante a coleta (ver Riscos).

## Passos

```bash
scripts/dns-logonly.sh start     # dnsmasq em background; valida que wlo1 tem HOST_IP
scripts/dns-logonly.sh fw-up     # pede sudo; 2 rich rules (udp + tcp)
scripts/dns-logonly.sh status    # esperado: rodando, 2/2, queries da TV: 0
```

Na TV (caminho **Provável** — conferir no device e corrigir aqui se divergir):
**Configurações → Geral → Rede → Status da rede → Configurações de IP → Configuração de
DNS → Inserir manualmente → Servidor DNS = `<HOST_IP>`.** Antes de alterar, **fotografar a
tela de IP Settings** (estado original — baseline de recuperação).

```bash
scripts/dns-logonly.sh tail      # deve começar a mostrar queries em segundos
```

## Roteiro de coleta

Mínimo 24 h, cobrindo: boot frio (tomada), Smart Hub/home aberta, navegação pelas fileiras
de conteúdo patrocinado, 2–3 apps de streaming, entrada HDMI ativa, e **standby
noturno** (hipótese: a TV fala com a Samsung mesmo em standby). Anotar horários de cada
fase para correlacionar com o log.

```bash
scripts/dns-logonly.sh summary > evidence/raw-dns-summary-$(date +%Y%m%d).txt
```

O resumo fica `raw-*` (gitignored) até ser revisado: subdomínios podem carregar
identificadores do device. Só a versão revisada e classificada entra no git.

## Validação

| Observação | Interpretação |
| --- | --- |
| Queries da TV no log, Smart Hub funcional | **Sucesso.** Coleta válida |
| Smart Hub sem conteúdo, 0 queries no log | Redirect não funcionou. Diagnóstico: `sudo tcpdump -ni wlo1 port 53 and host <TV_IP>` — se os pacotes chegam, o problema é a regra; se não chegam, a TV não usa o DNS configurado |
| Smart Hub funcional, 0 queries | TV usa outro resolver (hardcoded, ou DNS IPv6 via RA) — reforça o risco aberto em `architecture.md` |
| Poucas queries, só alguns domínios | Possível resolver parcial: parte do tráfego vai por IP literal ou outro DNS. Hipótese, não conclusão |

Nota: dnsmasq aqui só escuta IPv4. Se a TV tiver IPv6 com DNS anunciado pelo roteador, uma
parte das queries pode não passar por nós. Não verificado neste device. **Hipótese.**

## Rollback (ordem)

1. Na TV: **Configuração de DNS → Obter automaticamente.** Validar: Smart Hub carrega.
2. `scripts/dns-logonly.sh fw-down` (ou reboot da estação — as regras são runtime).
3. `scripts/dns-logonly.sh stop`.

O passo 1 sozinho já restaura a TV por completo; 2 e 3 só limpam a estação.

## Riscos

- **Estação desligada/suspensa → a TV fica sem DNS.** Recursos smart param; sinal de antena
  e HDMI não dependem disso. Recuperação: rollback passo 1. Risco baixo, mas operacional:
  durante a coleta, desativar a suspensão automática da estação.
- Resolver aberto na LAN em `<HOST_IP>:5300` (a zona já libera 1025–65535). É um
  forwarder sem cache para o mesmo upstream do roteador — não amplia a superfície de
  forma relevante num LAN já tratado como semi-confiável.
