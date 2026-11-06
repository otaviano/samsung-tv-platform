# E6 — Hello-world assinado: empacotar, instalar, executar, desinstalar

**Objetivo:** validar o ciclo de deploy completo de um web app próprio no device e medir o
runtime web real (base técnica da home custom).
**Degrau:** 3. Rollback: desinstalar — **testado** (inventário volta a 309 apps).
**Pré-requisito:** Developer Mode ligado com `developerIP = <HOST_IP>`; `sdb devices`
listando a TV (E2/E4).

## Resultado (2026-11-06)

| Pergunta | Resposta | Confiança |
| --- | --- | --- |
| Precisa de certificado Samsung para instalar em Developer Mode? | **Não.** Assinatura Tizen comum é aceita | Confirmado |
| Instalar por cima (update) funciona? | Sim, v0.1 → v0.2 | Confirmado |
| Rollback | `vd_appuninstall <PKGID>` remove; applist volta de 310 para 309 | Confirmado |
| Runtime web | Chromium 69.0.3497.106, 1920×1080 — ver `device-baseline.md` | Confirmado |

## Uma vez por máquina: certificado de autor e perfil

```bash
head -c 24 /dev/urandom | base64 | tr -d '/+=' > secrets/tizen-author.pw   # gitignored
scripts/tizen.sh bash -lc '
  PW=$(cat /work/secrets/tizen-author.pw)
  tizen certificate -a e6author -p "$PW" -n e6author -c BR -f e6author
  tizen security-profiles add -n tizen-e6 \
    -a ~/tizen-studio-data/keystore/author/e6author.p12 -p "$PW"
  # Senhas VAZIAS no perfil: força o CLI a pedir a senha (ver "Armadilhas").
  sed -i -E "s/(distributor=\"[01]\" key=\"[^\"]*\" password=\")[^\"]*\"/\1\"/" \
    ~/tizen-studio-data/profile/profiles.xml'
```

Certificado e perfil ficam no volume `tizen-studio-data`. Perder o volume ou
`secrets/tizen-author.pw` = gerar outro certificado; apps assinados com o anterior
precisam ser desinstalados antes de reinstalar com o novo (**Provável**, não testado).

## Ciclo

```bash
python3 -I scripts/report-sink.py &              # opcional: recebe relatório/teclas do app
scripts/tv-app.sh install   experiments/e6-hello
scripts/tv-app.sh run       experiments/e6-hello
scripts/tv-app.sh uninstall experiments/e6-hello
scripts/tv-app.sh installed experiments/e6-hello # esperado: "não instalado"
```

`report-sink.py` escuta em `<HOST_IP>:8765`, aceita POST apenas de `<TV_IP>` e grava em
`evidence/raw-tv-report-<data>.log`. O endpoint vai para o app em `report-target.js`,
gerado no deploy e gitignored.

## Armadilhas encontradas

1. **Senha cifrada no perfil sem keyring.** `security-profiles add` cifra a senha via
   `secret-tool` (libsecret), ausente no container → `tizen package` falha com
   `Invaild password`, sem prompt.
2. **Prompt sem TTY.** Com a senha vazia ou em texto puro o CLI pede a senha usando
   `System.console()`, que é nulo sem TTY → `NullPointerException`. `tv-app.sh` roda o
   `tizen package` dentro de `script` (pty) e responde: senha do autor, `N`, senha do
   distribuidor, `N` (não salvar).
3. **`tizen install` falha sem diagnóstico** ("Failed to install Tizen application.").
   O comando embutido do sdbd `sdb shell 0 vd_appinstall <PKGID> <caminho-remoto>`
   funciona. Causa da falha do CLI: não investigada.
4. **`vd_appuninstall` exige o package ID** (`E6HelloTst`). Com o app ID
   (`E6HelloTst.e6hello`) retorna `uninstall failed[132]`.
5. **O CLI reescreve o perfil após cada package bem-sucedido**, apontando a senha para
   arquivos `.pwd` que não consegue criar sem keyring → a execução seguinte falha com
   `Invaild password`. `tv-app.sh` zera os campos antes de cada execução (validado com
   duas instalações seguidas, 2026-11-06).
6. **`CSS.supports('gap', …)` mente para flexbox.** Responde pelo gap de grid. Testar flex
   gap medindo layout.
