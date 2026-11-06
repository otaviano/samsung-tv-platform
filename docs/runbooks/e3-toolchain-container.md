# E3 — Toolchain Tizen em container

- **Degrau de reversibilidade:** 0 no device (nada é tocado na TV), 1 no host
- **Risco de recuperação:** nenhum. `podman rmi` + `podman volume rm` desfaz tudo.
- **Decisão:** [ADR-0002](../decisions/0002-toolchain-tizen-em-container.md)

## Por quê container

Fedora 44 não é host suportado (a doc oficial lista só "Ubuntu 14.x or higher"). Em vez de
brigar com isso no host — onde uma falha de toolchain se confunde com limitação do device —
o toolchain fica isolado e descartável.

## Build

```bash
cd ~/source/repos/samsung-tv-platform
podman build -t tizen-tv:6.1 -f infra/Containerfile infra/
```

Baixa ~270 MB de instalador mais as extensões. **Imagem final: 4.75 GB.** Leva alguns
minutos. O build falha explicitamente se alguma extensão não instalar — ver abaixo.

## Uso

```bash
./scripts/tizen.sh tizen version
./scripts/tizen.sh sdb version
./scripts/tizen.sh shell          # bash interativo
```

O repo é montado em `/work`. A rede é a do host (`--network host`), para o SDB alcançar
`<TV_IP>` sem NAT.

## O que persiste e o que não

| Caminho | Natureza |
| --- | --- |
| `~/tizen-studio` | **Imutável**, vem da imagem. Tizen Studio + TV Extension. |
| `~/tizen-studio-data` | Volume `tizen-studio-data` — perfis de certificado, keystore |
| `~/.sdb` | Volume `tizen-sdb` — chaves do sdb |

Extensões são instaladas em **build time**, não em runtime.

### Dois bugs reais do wrapper, corrigidos

1. **Volume no caminho errado.** A primeira versão montava `~/.tizen-state`, caminho que o
   toolchain não usa. Qualquer coisa instalada em runtime se perdia.
2. **Container `--rm` matava a sessão do sdb.** O `sdb` mantém um servidor em background
   (porta 26099) que guarda as conexões. Com `--rm`, cada comando subia um servidor novo e
   vazio — sintoma visível: todo comando reimprimia `* Server is not running *`, e um
   `sdb connect` seguido de `sdb devices` **nunca** veria o device, porque rodariam em
   processos sdb distintos.

Hoje o wrapper mantém um container nomeado (`tizen-tv-dev`) e usa `podman exec`.
`scripts/tizen.sh stop` o derruba; os volumes sobrevivem.

## Fatos verificados (2026-11-06)

- Instalador `web-cli_Tizen_Studio_6.1_ubuntu-64.bin`, sha256
  `7f33fe09eda4eb5d50463cf997e8f676d455060720470070ae1932994413aaf4`, pinado no Containerfile.
- Variante `web-cli` = **sem GUI**. Não há dependência de X11/Wayland.
- O instalador **aborta como root** → usuário não-root obrigatório.
- **JDK embutido** (`jdk/*` → `~/.package-manager/jdk`), salvo `--use-system-java`. O
  OpenJDK 25 do host não participa.
- No Ubuntu o instalador checa apenas `grep` e `zip` **para si mesmo**. As extensões
  precisam de mais (ver abaixo).
- Versões obtidas: **Tizen CLI 2.5.25**, **sdb 4.2.25**, Package Manager 0.5.67
  (auto-atualiza de 0.5.61 no primeiro uso).
- O repositório **"Samsung Tizen TV SDK" já vem pré-registrado** (`extra` índice 3) e ativo.
  Não é preciso `extra --add` — tentar adicionar dá erro de URL duplicada (inócuo).
  **Samsung Certificate Extension 2.0.75** também já vem (índice 1), acima do piso 2.0.73.

### Sintaxe real do package manager (do `--help`, não da doc)

```
extra --list [--detail]
extra --add -n <name> -r <address>
extra -act|-dact <index[,...]>
install [--accept-license] [--no-java-check] [-p <password>] <package name>[,...]
show-pkgs [--tree]
show-info
```

Pacotes do canal oficial (`pkg_list_ubuntu-64`):

| Pacote | Versão | Instalamos? |
| --- | --- | --- |
| `TV-SAMSUNG-Public` | 10.0.0 | sim (dependência) |
| `TV-SAMSUNG-Public-WebAppDevelopment` | 10.0.0 | sim |
| `TV-SAMSUNG-Extension-Tools` | 10.0.0 | sim |
| `TV-SAMSUNG-Extension-Resources` | 10.0.0 | sim (dependência) |
| `cert-add-on` | 2.0.75 | sim |
| `TV-SAMSUNG-Public-Emulator` | 10.0.0 | **não** — ver abaixo |

Instalar `TV-SAMSUNG-Public-WebAppDevelopment` arrasta `Certificate-Manager` 3.1.3 e
`WebIDE` 3.1.3 como dependências. `TV-SAMSUNG-Public` permanece `ni` por ser meta-pacote;
seus componentes (`TV-SAMSUNG-Public-Mandatory`, `tv-samsung-public-web-add-ons`, etc.)
são instalados.

### Dependências de OS — a pegadinha

O `package-manager-cli` exige pacotes do sistema, **tenta instalá-los sozinho via apt**,
falha por rodar como usuário não-privilegiado, e **retorna exit code 0 de qualquer jeito**:

| Pacote Ubuntu 24.04 | Por quê |
| --- | --- |
| `cpio`, `rpm2cpio` | as extensões Samsung vêm empacotadas em **RPM** |
| `libkf5itemmodels5`, `libkf5kiowidgets5`, `libkchart2` | exigidos pelo package manager |

Todos pré-instalados como root no Containerfile. E como o exit code é inconfiável, o build
**verifica explicitamente** que cada pacote saiu de `ni` e falha se não — sem isso, a
primeira tentativa teria passado como verde com zero extensões instaladas.

### Targetar Tizen 5.5 É possível — o emulador é que não serve

Não confundir as duas coisas:

- **Build/empacotamento para 5.5: suportado.** O baseline instala
  `platforms/tizen-5.5/{common,mobile,tv,tv-samsung}` e o CLI expõe o perfil **`tv-5.5`**
  (`tizen list web-project` lista `tv-2.4` … `tv-9.0`).
- **Templates de projeto Samsung** só existem como `tv-samsung-3.0` e `tv-samsung-10.0`.
  Irrelevante: template é scaffolding, não runtime.
- **Emulador: só 10.0.** Não emula o Chromium M69. Testar nele dá falso positivo exatamente
  nas incompatibilidades que importam. Por isso ficou fora da imagem, e por isso a validação
  é no hardware — reforça E6.

## Rollback

```bash
podman rmi tizen-tv:6.1
podman volume rm tizen-studio-data tizen-sdb
```

## Próximo

E3 entrega o toolchain, mas `sdb connect` só funciona depois de
[E2](e2-developer-mode.md). Com os dois prontos, seguir para E4.
