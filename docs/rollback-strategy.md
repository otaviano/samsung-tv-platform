# Rollback strategy

Rollback é requisito de primeira classe. **Nenhuma mudança sem rollback conhecido ou risco
de recuperação explicitamente aceito pelo usuário.**

## Escada de reversibilidade

Trabalhar sempre do degrau mais baixo para cima. Não subir um degrau sem necessidade provada.

| Degrau | Classe de mudança | Reversibilidade | Exemplos |
| --- | --- | --- | --- |
| 0 | Observação passiva | Total, nada muda | `ip neigh`, `GET /api/v2/`, UPnP, logs do resolver |
| 1 | Configuração de rede fora da TV | Total, fora do device | reserva de DHCP, resolver DNS próprio, regras de firewall |
| 2 | Configurações suportadas da TV pelo menu | Total, pelo mesmo menu | Developer Mode, consentimentos de privacidade, desativar Smart Hub autostart |
| 3 | Apps próprios instalados via SDB | `sdb uninstall` | app de home custom |
| 4 | Alterações em apps/serviços de sistema | **Parcial ou nenhuma** | desabilitar app Samsung, mexer em serviço |
| 5 | Firmware, service menu, factory reset, privilege escalation | **Fora de escopo** | — |

Degraus 4 e 5 exigem aceite explícito e registrado do usuário, caso a caso. O degrau 5 está
vedado durante todo o discovery.

## Protocolo por experimento

Todo experimento é registrado em [change-log.md](change-log.md) com:

1. **Hipótese** — o que se espera e por quê
2. **Degrau** da escada acima
3. **Passos exatos** — comandos/cliques literais, reproduzíveis
4. **Resultado esperado**
5. **Validação** — como medir objetivamente se funcionou
6. **Passos de rollback** — testados *antes* de aplicar, quando possível
7. **Risco de recuperação** — o que acontece no pior caso, e foi aceito?

## Baseline de recuperação

Antes de subir para o degrau 3:

- [ ] Fotografar/registrar todas as telas de configuração relevantes da TV (estado original)
- [ ] Registrar a string de firmware atual (`<TV_FIRMWARE>`) para detectar mudança
- [ ] Registrar o inventário de apps instalados (via SDB, somente leitura)
- [ ] Confirmar que **auto-update de firmware está desligado** — um update silencioso
      invalida todas as conclusões do discovery
- [ ] Documentar o caminho de factory reset (como último recurso conhecido, não como etapa)

## Regra de ouro

Se um experimento não tem rollback testado e não é um dos degraus 0–2, ele não é executado
na sessão em que foi concebido. Dorme, é revisado, e só então roda.
