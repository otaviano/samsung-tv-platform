#!/usr/bin/env bash
# Varredura de pré-push: garante que nenhum dado sensível entrou no índice do git.
#
# Uso:  scripts/audit-secrets.sh
# Saída: 0 = limpo, 1 = vazamento detectado
#
# Este repo é PÚBLICO. Topologia de rede e identificação do device são sensíveis e
# existem nos documentos apenas como placeholders. Ver docs/security.md.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

FILES=$(git diff --cached --name-only 2>/dev/null)
[ -z "$FILES" ] && FILES=$(git ls-files)
[ -z "$FILES" ] && { echo "Nada a verificar."; exit 0; }

# Padrões genéricos (não contêm os próprios segredos, para o script poder ser versionado).
declare -A PATTERNS=(
  # 4 octetos obrigatórios nos três blocos, senão versões como "10.0.301" dão falso positivo
  [ipv4-rfc1918-10]='\b10(\.[0-9]{1,3}){3}\b'
  [ipv4-rfc1918-192]='\b192\.168(\.[0-9]{1,3}){2}\b'
  [ipv4-rfc1918-172]='\b172\.(1[6-9]|2[0-9]|3[01])(\.[0-9]{1,3}){2}\b'
  [ipv4-tailscale]='\b100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.[0-9]{1,3}\.[0-9]{1,3}\b'
  [mac-completo]='\b([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}\b'
  [uuid]='\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b'
  [modelo-samsung-tv]='\bUN[0-9]{2}[A-Z]{2}[0-9]{4}[A-Z]*\b'
  [firmware-samsung]='\bT-[A-Z0-9]{5,}-[0-9]{3,}\.[0-9]\b'
  [grupo-modelo]='\b[0-9]{2}_[A-Z0-9]+_(UHD|FHD|HD)_[A-Z0-9]+\b'
  [chave-privada]='-----BEGIN [A-Z ]*PRIVATE KEY-----'
  [token-generico]='\b(ghp|gho|github_pat|sk-ant|sk-)[A-Za-z0-9_-]{16,}'
)

# Falsos positivos aceitos: IPs de documentação (RFC 5737), MagicDNS do Tailscale,
# placeholders todo-zeros dos arquivos .example, e strings de versão do Tizen.
ALLOW='192\.0\.2\.|198\.51\.100\.|203\.0\.113\.|100\.100\.100\.100'
ALLOW="$ALLOW"'|(00:){5}00|0{8}-(0{4}-){3}0{12}|TIZEN-|tizen-|Tizen_SDK'

FOUND=0

# Camada 1 — literais exatos. Mais confiável que regex genérico: alguns identificadores
# (serial da TV, p.ex.) não têm formato previsível. Um valor por linha em
# scripts/.secret-values.local (gitignored). Comentários com # são ignorados.
LITERALS="scripts/.secret-values.local"
if [ -f "$LITERALS" ]; then
  while IFS= read -r val; do
    [ -z "$val" ] && continue
    case "$val" in \#*) continue ;; esac
    HIT=$(git grep -I -n -F -- "$val" -- $FILES 2>/dev/null || true)
    if [ -n "$HIT" ]; then
      echo "### VAZAMENTO [literal conhecido]"
      echo "$HIT"
      echo
      FOUND=1
    fi
  done < "$LITERALS"
else
  echo "AVISO: $LITERALS não existe — só a camada de regex está ativa." >&2
  echo "       Crie-o a partir de scripts/.secret-values.local.example." >&2
  echo >&2
fi

# Camada 2 — regex por formato, pega o que ainda não é conhecido.
for name in "${!PATTERNS[@]}"; do
  HIT=$(git grep -I -nE "${PATTERNS[$name]}" -- $FILES 2>/dev/null \
        | grep -vE "$ALLOW" || true)
  if [ -n "$HIT" ]; then
    echo "### VAZAMENTO [$name]"
    echo "$HIT"
    echo
    FOUND=1
  fi
done

if [ "$FOUND" -eq 0 ]; then
  echo "LIMPO — nenhum dado sensível no que será versionado."
else
  echo "ABORTE O PUSH. Mova os valores para device.env ou *.local.md e use placeholders."
fi
exit "$FOUND"
