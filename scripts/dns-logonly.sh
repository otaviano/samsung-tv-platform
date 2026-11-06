#!/usr/bin/env bash
# E5 — resolver DNS em modo LOG-ONLY para mapear os domínios que a TV contata.
#
# Não bloqueia nada: é um forwarder puro para o resolver atual da LAN (<GATEWAY_IP>),
# sem cache, sem domain-needed/bogus-priv — a TV deve ver exatamente as mesmas respostas
# que vê hoje. Ver docs/runbooks/e5-dns-logonly.md.
#
# Desenho (degraus 1–2 da escada de rollback):
#   - dnsmasq roda SEM root, na porta 5300 de <HOST_IP>.
#   - Uma rich rule RUNTIME do firewalld (nunca --permanent) redireciona :53 -> :5300
#     apenas para pacotes com origem <TV_IP>. Reboot ou `fw-down` desfaz.
#   - A TV aponta para <HOST_IP> via DNS manual no menu de rede (só a TV é afetada).
#
# Uso:
#   scripts/dns-logonly.sh start      # sobe o dnsmasq em background
#   scripts/dns-logonly.sh fw-up      # (sudo) redirect 53->5300 só para a TV
#   scripts/dns-logonly.sh status     # processo, regra de firewall, contagem de queries
#   scripts/dns-logonly.sh tail       # acompanha queries da TV ao vivo
#   scripts/dns-logonly.sh summary    # domínios únicos consultados pela TV, por contagem
#   scripts/dns-logonly.sh fw-down    # (sudo) remove o redirect
#   scripts/dns-logonly.sh stop       # derruba o dnsmasq
#
# Log bruto em evidence/raw-dns-<data>.log — gitignored, contém IPs da LAN.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${REPO_ROOT}/device.env"
: "${TV_IP:?defina TV_IP em device.env}"
: "${HOST_IP:?defina HOST_IP em device.env}"
: "${GATEWAY_IP:?defina GATEWAY_IP em device.env}"
: "${WIFI_IFACE:?defina WIFI_IFACE em device.env}"

PORT="${DNS_LOGONLY_PORT:-5300}"
RUN_DIR="${XDG_RUNTIME_DIR:-/tmp}/samsung-tv-dns"
PID_FILE="${RUN_DIR}/dnsmasq.pid"
LOG_FILE="${DNS_LOG_FILE:-${REPO_ROOT}/evidence/raw-dns-$(date +%Y%m%d).log}"

rule() { # $1 = udp|tcp
  printf 'rule family="ipv4" source address="%s" forward-port port="53" protocol="%s" to-port="%s"' \
    "$TV_IP" "$1" "$PORT"
}

zone() { firewall-cmd --get-zone-of-interface="$WIFI_IFACE"; }

running() { [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; }

case "${1:-}" in
  start)
    if running; then echo "dnsmasq já rodando (pid $(cat "$PID_FILE"))"; exit 0; fi
    ip -4 -br addr show "$WIFI_IFACE" | grep -qw "$HOST_IP" || {
      echo "ERRO: $WIFI_IFACE não tem HOST_IP de device.env — lease da estação mudou? (E1)" >&2
      exit 1
    }
    mkdir -p "$RUN_DIR" "$(dirname "$LOG_FILE")"
    # --conf-file=/dev/null: ignora /etc/dnsmasq.conf; toda a config está aqui.
    # --user: sem root não há para quem trocar; evita o default "nobody".
    dnsmasq \
      --conf-file=/dev/null \
      --port="$PORT" \
      --listen-address="$HOST_IP" \
      --bind-interfaces \
      --no-resolv --no-hosts \
      --server="$GATEWAY_IP" \
      --cache-size=0 \
      --log-queries=extra \
      --log-facility="$LOG_FILE" \
      --pid-file="$PID_FILE" \
      --user="$(id -un)"
    sleep 0.5
    running || { echo "ERRO: dnsmasq não subiu; ver $LOG_FILE" >&2; exit 1; }
    echo "dnsmasq log-only em ${HOST_IP}:${PORT} -> ${GATEWAY_IP} (pid $(cat "$PID_FILE"))"
    echo "log: $LOG_FILE"
    ;;
  stop)
    if running; then kill "$(cat "$PID_FILE")"; rm -f "$PID_FILE"; echo "dnsmasq parado"
    else echo "dnsmasq não estava rodando"; fi
    ;;
  fw-up)
    z="$(zone)"
    for p in udp tcp; do sudo firewall-cmd --zone="$z" --add-rich-rule="$(rule $p)"; done
    echo "redirect 53->${PORT} ativo para origem TV (runtime; some no reboot)"
    ;;
  fw-down)
    z="$(zone)"
    for p in udp tcp; do sudo firewall-cmd --zone="$z" --remove-rich-rule="$(rule $p)" || true; done
    ;;
  status)
    if running; then echo "dnsmasq: rodando (pid $(cat "$PID_FILE"))"; else echo "dnsmasq: parado"; fi
    n="$(firewall-cmd --zone="$(zone)" --list-rich-rules | grep -c "to-port=\"${PORT}\"" || true)"
    echo "regras de redirect ativas: ${n}/2"
    if [ -f "$LOG_FILE" ]; then
      echo "queries da TV em $(basename "$LOG_FILE"): $(grep -c "query\[.*from ${TV_IP}\$" "$LOG_FILE" || true)"
    fi
    ;;
  tail)
    tail -F "$LOG_FILE" | grep --line-buffered "query\[.*from ${TV_IP}\$"
    ;;
  summary)
    # Formato da linha (log-queries=extra):
    #   <data> dnsmasq[pid]: <serial> <ip>/<porta> query[A] <nome> from <ip>
    files=("${REPO_ROOT}"/evidence/raw-dns-*.log)
    grep -h "query\[.*from ${TV_IP}\$" "${files[@]}" \
      | awk '{ for (i=1;i<=NF;i++) if ($i ~ /^query\[/) { print $(i+1); break } }' \
      | tr 'A-Z' 'a-z' | sort | uniq -c | sort -rn
    ;;
  *)
    sed -n '2,25p' "$0"; exit 1
    ;;
esac
