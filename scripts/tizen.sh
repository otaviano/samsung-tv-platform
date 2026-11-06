#!/usr/bin/env bash
# Executa comandos do toolchain Tizen (tizen, sdb, package-manager-cli) dentro de um
# container PERSISTENTE, com a rede do host para o SDB alcançar a TV na LAN.
#
# Ver docs/decisions/0002-toolchain-tizen-em-container.md
#
# Uso:
#   scripts/tizen.sh sdb connect <TV_IP>:26101
#   scripts/tizen.sh sdb devices
#   scripts/tizen.sh sdb capability
#   scripts/tizen.sh shell            # bash interativo
#   scripts/tizen.sh stop             # derruba o container (encerra o sdb server)
#
# POR QUE PERSISTENTE: o `sdb` mantém um servidor em background (porta 26099) que guarda
# as conexões ativas. Com containers --rm, cada comando subia um servidor novo e vazio —
# um `sdb connect` seguido de `sdb devices` nunca veria o device, porque rodariam em
# processos sdb diferentes. Foi um bug real deste wrapper, corrigido aqui.
#
# PERSISTÊNCIA EM DISCO (sobrevive a `stop`):
#   ~/tizen-studio        imutável, vem da imagem
#   ~/tizen-studio-data   volume — perfis de certificado e keystore
#   ~/.sdb                volume — chaves do sdb
set -euo pipefail

IMAGE="${TIZEN_IMAGE:-tizen-tv:6.1}"
NAME="${TIZEN_CONTAINER:-tizen-tv-dev}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "${1:-}" = "stop" ]; then
  podman rm -f "$NAME" >/dev/null 2>&1 && echo "container $NAME removido" \
    || echo "container $NAME não estava rodando"
  exit 0
fi

if ! podman image exists "$IMAGE"; then
  echo "Imagem '$IMAGE' não existe. Rode:" >&2
  echo "  podman build -t $IMAGE -f infra/Containerfile infra/" >&2
  exit 1
fi

for v in tizen-studio-data tizen-sdb; do
  podman volume exists "$v" 2>/dev/null || podman volume create "$v" >/dev/null
done

# Sobe o container uma vez e reaproveita nas chamadas seguintes.
# --network host: o sdb precisa falar com a TV na LAN sem NAT.
# NUNCA publicar 26101/26099 para fora do host. Ver docs/security.md.
if ! podman container exists "$NAME" || \
   [ "$(podman inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" != "true" ]; then
  podman rm -f "$NAME" >/dev/null 2>&1 || true
  podman run -d --name "$NAME" \
    --network host \
    --userns keep-id \
    -v "${REPO_ROOT}:/work:z" \
    -v "tizen-studio-data:/home/tizen/tizen-studio-data:z" \
    -v "tizen-sdb:/home/tizen/.sdb:z" \
    -w /work \
    "$IMAGE" sleep infinity >/dev/null
fi

if [ $# -eq 0 ] || [ "${1:-}" = "shell" ]; then
  exec podman exec -it "$NAME" /bin/bash -l
fi

TTY_FLAG=()
[ -t 0 ] && [ -t 1 ] && TTY_FLAG=(-it)
exec podman exec "${TTY_FLAG[@]}" "$NAME" /bin/bash -lc 'exec "$@"' _ "$@"
