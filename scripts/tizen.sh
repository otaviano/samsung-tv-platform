#!/usr/bin/env bash
# Executa comandos do toolchain Tizen (tizen, sdb, package-manager-cli) dentro do
# container, com a rede do host para o SDB alcançar a TV na LAN.
#
# Ver docs/decisions/0002-toolchain-tizen-em-container.md
#
# Uso:
#   scripts/tizen.sh sdb connect <TV_IP>:26101
#   scripts/tizen.sh sdb devices
#   scripts/tizen.sh sdb capability
#   scripts/tizen.sh tizen version
#   scripts/tizen.sh shell                 # bash interativo no container
#
# PERSISTÊNCIA — o container é --rm, então só sobrevive o que está em volume:
#   ~/tizen-studio        imutável, vem da imagem (Tizen Studio + TV Extension)
#   ~/tizen-studio-data   VOLUME — perfis de certificado e keystore
#   ~/.sdb                VOLUME — chaves do sdb, evita re-autorizar a cada conexão
# As extensões são instaladas em BUILD TIME (infra/Containerfile), não em runtime:
# instalar num container --rm jogaria o resultado fora.
set -euo pipefail

IMAGE="${TIZEN_IMAGE:-tizen-tv:6.1}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! podman image exists "$IMAGE"; then
  echo "Imagem '$IMAGE' não existe. Rode:" >&2
  echo "  podman build -t $IMAGE -f infra/Containerfile infra/" >&2
  exit 1
fi

for v in tizen-studio-data tizen-sdb; do
  podman volume exists "$v" 2>/dev/null || podman volume create "$v" >/dev/null
done

# --network host: o sdb precisa falar com a TV na LAN sem NAT.
# NUNCA publicar 26101 para fora do host. Ver docs/security.md.
ARGS=(
  --rm
  --network host
  --userns keep-id
  -v "${REPO_ROOT}:/work:z"
  -v "tizen-studio-data:/home/tizen/tizen-studio-data:z"
  -v "tizen-sdb:/home/tizen/.sdb:z"
  -w /work
)

if [ -t 0 ] && [ -t 1 ]; then
  ARGS+=(-it)
fi

if [ $# -eq 0 ] || [ "${1:-}" = "shell" ]; then
  exec podman run "${ARGS[@]}" "$IMAGE" /bin/bash -l
fi

exec podman run "${ARGS[@]}" "$IMAGE" /bin/bash -lc 'exec "$@"' _ "$@"
