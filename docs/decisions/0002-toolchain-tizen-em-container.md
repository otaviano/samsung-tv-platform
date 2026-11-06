# ADR-0002: Rodar o toolchain Tizen em container Ubuntu

- **Status:** aceito (revisado 2026-11-06)
- **Data:** 2026-11-06

## Contexto

Fatos confirmados:

- A estação é **Fedora 44**. As prerequisites oficiais do Tizen Studio listam apenas
  **"Ubuntu 14.x or higher"** como Linux suportado.
- O único JDK presente é **OpenJDK 25**. Verificado no wrapper do instalador: o **JDK vem
  embutido** (descompacta `jdk/*` em `~/.package-manager/jdk`, só usa o do sistema com
  `--use-system-java`). O JDK do host é um não-problema. **Confirmado.**
- O instalador **aborta se executado como root**. **Confirmado** (`whoami` = root → exit).
- Existe a variante **`web-cli`**, sem GUI. Isso remove o risco de Eclipse/SWT e todo o
  atrito de X11/Wayland que era metade da justificativa original desta ADR.
- No Ubuntu o instalador checa apenas `grep` e `zip`.
- `podman` 5.8.4 já está disponível.

## Decisão (proposta)

Instalar Tizen Studio 6.1 + TV Extension dentro de um container Ubuntu LTS gerenciado por
podman, com acesso à rede do host para o SDB alcançar a TV na LAN. Não instalar o toolchain
diretamente no Fedora.

## Consequências

- O toolchain fica isolado e descartável — alinhado ao requisito de rollback.
- Um toolchain quebrado se resolve recriando o container, sem sujar o host.
- Sem GUI: usamos o instalador `web-cli`, então **não há** atrito de X11/Wayland. O custo
  é perder Device Manager e Certificate Manager gráficos — o caminho passa a ser
  `package-manager-cli` e `tizen certificate` por linha de comando.
- O SDB precisa de `--network host` para alcançar a TV na LAN sem NAT. A porta 26101
  **nunca** é publicada para fora do host.
- Versões do toolchain passam a ser reprodutíveis via Containerfile em `infra/`.

## Alternativas consideradas

- **Instalar direto no Fedora 44:** não suportado; falhas difíceis de diagnosticar e que
  se confundem com limitações do device.
- **VM Ubuntu completa:** funciona, mas pesada e com SDB atrás de mais uma camada de rede.
- **Só a CLI, sem Tizen Studio:** atraente, mas a criação de certificado Samsung
  (Certificate Extension ≥ 2.0.73) precisa ser validada por esse caminho antes de assumir.

## Rollback

`podman rm` no container e `podman rmi` na imagem. Zero impacto no host e no device.

## Pendente de validação

Resolvido quanto à extensão: o canal oficial serve só **TV Extensions-10.0** (sem 5.5).
Para web app isso é aceitável — o alvo de plataforma vai no `config.xml`. Mas o **emulador
10.0 não representa o Chromium M69** do device, então o emulador não entra no loop de
validação. Testar no hardware.

Resta confirmar os subcomandos do `package-manager-cli` para ativar repositório de extensão
de forma headless (incógnita 8).
