# samsung-tv-platform

Customização de uma Samsung Smart TV (<TV_MODEL>, 2020) preservando um caminho
de rollback confiável.

## Objetivos

1. Reduzir publicidade, recomendações, telemetria e atividade de background da Samsung,
   onde for técnica e seguramente possível.
2. Construir uma home de TV própria, minimalista.
3. Ocultar apps indesejados dessa experiência; investigar se algum pode ser desabilitado
   ou impedido de iniciar com segurança.
4. Depois, um agente de recomendação pessoal sobre dados de preferência/histórico
   controlados pelo usuário.

Projeto de engenharia/reverse-engineering — não é um exercício de ajuste de configurações.

## Estado atual

**Milestone 1 — Technical Discovery: em andamento.**
Inventário da estação e identificação do device concluídos. Veja
[docs/discovery-report.md](docs/discovery-report.md).

Bloqueio ativo: Developer Mode está desligado na TV e exige interação física com o
controle remoto — ver [docs/runbooks/e2-developer-mode.md](docs/runbooks/e2-developer-mode.md).
Nada de SDB até lá.

Toolchain (E3): `infra/Containerfile` + `scripts/tizen.sh`.

## Mapa do repositório

| Caminho | Conteúdo |
| --- | --- |
| `docs/device-baseline.md` | Fatos do hardware/firmware do device |
| `docs/discovery-report.md` | Evidências, níveis de confiança, incógnitas, próximos experimentos |
| `docs/architecture.md` | Direção arquitetural (hipóteses de trabalho) |
| `docs/rollback-strategy.md` | Rollback como requisito de primeira classe |
| `docs/security.md` | Regras de exposição, segredos e superfície de rede |
| `docs/change-log.md` | Log de toda mudança/experimento feito no device |
| `docs/runbooks/` | Procedimentos passo a passo, com validação e rollback |
| `docs/decisions/` | ADRs |
| `infra/Containerfile` | Toolchain Tizen isolado (ADR-0002) |
| `scripts/` | Coleta reprodutível e não-invasiva |
| `src/tv-app/` | App Tizen (runtime na TV) |
| `src/api/` | Control plane ASP.NET Core |
| `src/agent/` | Agente de recomendação (fase posterior) |
| `evidence/` | Saídas brutas datadas das coletas (raw-* é gitignored) |

## Setup local

```bash
cp device.env.example device.env           # preencha com os valores do seu ambiente
cp scripts/.secret-values.local.example scripts/.secret-values.local
git config core.hooksPath .githooks        # bloqueia push com dado sensível
podman build -t tizen-tv:6.1 -f infra/Containerfile infra/
```

## Regras não-negociáveis

- Nenhuma mudança sem rollback conhecido ou risco de recuperação explicitamente aceito.
- Repositório **público**: topologia de rede e modelo+firmware aparecem só como
  placeholders (`<TV_IP>`, `<TV_MODEL>`, …). Valores reais em `device.env` e
  `docs/device-identifiers.local.md`, ambos fora do git. Ver `docs/security.md`.
- Serial, DUID/UDN, MAC e TVkey do device **nunca** entram no git.
- `scripts/audit-secrets.sh` roda como hook de pre-push e barra vazamentos.
- SDB e portas de debug nunca expostas à internet.
- Separar fato confirmado de hipótese em toda documentação.
