#!/usr/bin/env bash
# Ciclo de vida de um web app Tizen na TV: empacotar, instalar, executar, desinstalar.
# Ver docs/runbooks/e6-hello-world.md.
#
# Uso:
#   scripts/tv-app.sh package   <dir-do-app>   # gera <dir>/out/<PKGID>.wgt assinado
#   scripts/tv-app.sh install   <dir-do-app>   # package + vd_appinstall
#   scripts/tv-app.sh run       <dir-do-app>
#   scripts/tv-app.sh uninstall <dir-do-app>   # rollback do degrau 3
#   scripts/tv-app.sh installed <dir-do-app>   # está no applist?
#
# Contornos (achados do E6, 2026-11-06):
#  - O perfil de assinatura guarda senhas cifradas via secret-tool/libsecret, que não existe
#    no container -> o CLI cai num prompt interativo que usa System.console() e dá NPE sem
#    TTY. Solução: senhas VAZIAS no profiles.xml (força o prompt; nada fica salvo) e
#    `tizen package` dentro de `script` (pty), digitando as senhas. Senha cifrada sem
#    keyring = "Invalid password" direto, sem prompt.
#  - `tizen install` falha sem diagnóstico neste device; `sdb shell 0 vd_appinstall` (comando
#    embutido do sdbd) funciona. É ele que usamos.
#
# Assinatura: certificado de AUTOR Tizen (secrets/tizen-author.pw) + distribuidor Tizen
# público do SDK. Aceito pelo device com Developer Mode ligado (E6). Não serve para loja.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${REPO_ROOT}/device.env"
TIZEN="${REPO_ROOT}/scripts/tizen.sh"
PROFILE="${TIZEN_SIGN_PROFILE:-tizen-e6}"
# Senha do signer de distribuidor Tizen PÚBLICO que vem no SDK — não é segredo.
TIZEN_DIST_PW="tizenpkcs12passfordsigner"
REPORT_PORT="${REPORT_PORT:-8765}"

cmd="${1:-}"; app="${2:-}"
[ -n "$cmd" ] && [ -n "$app" ] || { sed -n '2,12p' "$0"; exit 1; }
app="$(cd "$app" && pwd)"
rel="${app#"${REPO_ROOT}"/}"
[ -f "$app/config.xml" ] || { echo "ERRO: $app/config.xml não existe" >&2; exit 1; }

pkgid="$(grep -o 'package="[^"]*"' "$app/config.xml" | head -1 | cut -d'"' -f2)"
appid="$(grep -o '<tizen:application id="[^"]*"' "$app/config.xml" | cut -d'"' -f2)"
target="${TV_IP}:26101"

sdb_() { "$TIZEN" sdb -s "$target" "$@"; }

package() {
  # Endpoint do report-sink, gerado fora do git (contém <HOST_IP>).
  printf "window.REPORT_URL = 'http://%s:%s';\n" "$HOST_IP" "$REPORT_PORT" > "$app/report-target.js"
  "$TIZEN" bash -lc '
    set -euo pipefail
    src="/work/$1"; profile="$2"; dist="$3"; pkgid="$4"
    pw="$(cat /work/secrets/tizen-author.pw)"
    build="$(mktemp -d)"; cp -r "$src"/. "$build"/; rm -rf "$build/out"
    tizen cli-config "profiles.path=$HOME/tizen-studio-data/profile/profiles.xml" >/dev/null
    # pty: o prompt de senha do CLI exige console. Com as senhas VAZIAS no profiles.xml
    # (de propósito — nada guardado), a ordem é: senha autor, "salvar? Y/N", senha
    # distribuidor, "salvar? Y/N". Respondemos N: a senha nunca é persistida pelo CLI.
    (sleep 6; printf "%s\n" "$pw"; sleep 2; printf "N\n"; sleep 2; printf "%s\n" "$dist"; sleep 2; printf "N\n"; sleep 15) \
      | script -qec "tizen package -t wgt -s $profile -- $build" /dev/null \
      | grep -E "Package File Location|rror" || true
    wgt="$(ls "$build"/*.wgt)"
    mkdir -p "$src/out"; cp "$wgt" "$src/out/$pkgid.wgt"; rm -rf "$build"
    echo "pacote: $1/out/$pkgid.wgt"
  ' _ "$rel" "$PROFILE" "$TIZEN_DIST_PW" "$pkgid"
}

case "$cmd" in
  package) package ;;
  install)
    package
    remote="/home/owner/share/tmp/sdk_tools/tmp/${pkgid}.wgt"
    sdb_ push "/work/${rel}/out/${pkgid}.wgt" "$remote" >/dev/null
    sdb_ shell 0 vd_appinstall "$pkgid" "$remote" | grep -v 'installing\[' || true
    ;;
  run)       sdb_ shell 0 execute "$appid" ;;
  # vd_appuninstall exige o PACKAGE id (com o app id: "uninstall failed[132]").
  uninstall) sdb_ shell 0 vd_appuninstall "$pkgid" | grep -v 'uninstalling\[' || true ;;
  installed) sdb_ shell 0 applist | grep -F "'${appid}'" || echo "não instalado: $appid" ;;
  *) sed -n '2,12p' "$0"; exit 1 ;;
esac
