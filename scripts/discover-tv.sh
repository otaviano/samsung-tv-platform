#!/usr/bin/env bash
# Descoberta não-invasiva de uma Samsung Smart TV na LAN.
#
# Somente leitura: consulta endpoints documentados e o cache ARP do kernel.
# NÃO faz port scan de range, NÃO altera nada no device.
#
# Uso: scripts/discover-tv.sh [IP]
#      Sem IP, procura no cache ARP por OUIs da Samsung.
#
# ATENÇÃO: a saída contém serial e DUID. Redirecione para evidence/raw-*.json
# (gitignored) e nunca para um arquivo versionado.
set -uo pipefail

OUI_DB=""
for f in /usr/share/hwdata/oui.txt /usr/share/arp-scan/ieee-oui.txt; do
  [ -f "$f" ] && OUI_DB="$f" && break
done

find_tv() {
  echo "Procurando OUIs Samsung no cache ARP (sem scan ativo)..." >&2
  [ -z "$OUI_DB" ] && { echo "Base OUI local ausente (instale hwdata)." >&2; return 1; }
  ip neigh show | awk '$4=="lladdr"{print $1, $5}' | while read -r ip mac; do
    p=$(echo "$mac" | tr -d ':' | tr 'a-z' 'A-Z')
    key="${p:0:2}-${p:2:2}-${p:4:2}"
    if grep -qiE "^($key|${p:0:6})" "$OUI_DB" && \
       grep -iE "^($key|${p:0:6})" "$OUI_DB" | grep -qi samsung; then
      echo "$ip"
    fi
  done | head -1
}

TV="${1:-$(find_tv)}"
[ -z "${TV:-}" ] && { echo "Nenhuma TV Samsung encontrada. Passe o IP explicitamente." >&2; exit 1; }
echo "# TV alvo: $TV" >&2

echo "=== REST /api/v2/ ==="
curl -s -m 5 "http://$TV:8001/api/v2/"
echo

echo "=== Portas documentadas ==="
for port in 8001 8002 9197 26101; do
  printf '%-6s ' "$port"
  timeout 3 bash -c "echo > /dev/tcp/$TV/$port" 2>/dev/null \
    && echo "aberta" || echo "fechada/filtrada"
done

echo "=== UPnP MediaRenderer :9197/dmr ==="
curl -s -m 5 "http://$TV:9197/dmr"
echo

echo "=== Resumo de estado ==="
curl -s -m 5 "http://$TV:8001/api/v2/" \
  | grep -oE '"(modelName|model|OS|developerMode|developerIP|PowerState|networkType|resolution)":"[^"]*"' \
  || echo "(sem resposta)"
