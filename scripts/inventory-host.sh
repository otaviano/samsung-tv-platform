#!/usr/bin/env bash
# Inventário da estação de desenvolvimento. Somente leitura, não altera nada.
# Uso: scripts/inventory-host.sh
set -uo pipefail

h() { printf '\n=== %s ===\n' "$1"; }

h "OS"
cat /etc/os-release 2>/dev/null | grep -E '^(NAME|VERSION)=' || true
uname -srm

h "Memória"
free -h | head -2

h "Java"
java -version 2>&1 | head -3 || echo "(ausente)"
ls -1 /usr/lib/jvm 2>/dev/null || true

h "Node / .NET"
node -v 2>&1 || echo "node (ausente)"
npm -v 2>&1 || echo "npm (ausente)"
dotnet --list-sdks 2>&1 | head -5 || echo "dotnet (ausente)"

h "Toolchain Tizen"
for c in tizen sdb; do
  printf '%-6s ' "$c"
  command -v "$c" || echo "(ausente)"
done
ls -d ~/tizen-studio 2>/dev/null || echo "sem ~/tizen-studio"

h "Containers"
for c in podman docker distrobox; do
  printf '%-10s ' "$c"
  command -v "$c" >/dev/null 2>&1 && "$c" --version 2>&1 | head -1 || echo "(ausente)"
done

h "Rede"
ip -4 -br addr show
ip route show default

h "DNS"
resolvectl status 2>/dev/null | sed -n '1,12p' || cat /etc/resolv.conf
