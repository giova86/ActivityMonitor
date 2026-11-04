#!/bin/bash
# Monitor · MacBook Pro — avvio con stile terminale
# Uso: ./start.sh          (Ctrl+C per uscire)
set -e
cd "$(dirname "$0")"

PORT="${PORT:-5178}"
URL="http://localhost:${PORT}"

# ── colori (disattivati se output non su terminale) ────────────────────────
if [ -t 1 ]; then
  CY=$(printf '\033[38;2;86;199;245m')   # ciano  — come la CPU nella dashboard
  VI=$(printf '\033[38;2;160;139;255m')  # viola  — come la GPU
  FG=$(printf '\033[38;2;141;151;171m')  # grigio nebbia
  RD=$(printf '\033[38;2;255;107;107m')  # errore
  RS=$(printf '\033[0m')
else
  CY=""; VI=""; FG=""; RD=""; RS=""
fi

rule() { printf '%s\n' "${FG}────────────────────────────────────────────────────${RS}"; }

# ── prerequisiti ────────────────────────────────────────────────────────────
command -v macmon >/dev/null 2>&1 || { echo "${RD}✗ manca macmon${RS} — installalo con: brew install macmon"; exit 1; }
[ -d node_modules ] || npm install
[ -d dist ] || npm run build

# ── dati macchina (le stesse fonti della dashboard) ─────────────────────────
chip=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Apple Silicon")
cores=$(sysctl -n hw.ncpu 2>/dev/null || echo "?")
mem_gb=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824 ))
host=$(hostname -s)
macos="macOS $(sw_vers -productVersion 2>/dev/null || echo '?')"

banner() {
  echo
  printf '%s\n'   "  ${CY}◆${RS}  ${CY}M A C${RS}  ${VI}M O N I T O R${RS}"
  rule
  printf '%s\n'   "  ${FG}${chip} · ${cores} core · ${mem_gb} GB${RS}"
  printf '%s\n'   "  ${FG}${host} · ${macos}${RS}"
  rule
}

# ── se è già attivo, niente secondo server: solo browser ───────────────────
if curl -sf -m 1 "${URL}/healthz" >/dev/null 2>&1; then
  banner
  printf '  %s▲ server già attivo%s  %s\n\n' "$VI" "$RS" "$URL"
  open "$URL"
  exit 0
fi

# ── avvio ───────────────────────────────────────────────────────────────────
banner
node server/index.js &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM

# aspetto il primo health check (max ~5 s)
ready=""
for _ in $(seq 1 20); do
  if curl -sf -m 1 "${URL}/healthz" >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.25
done

if [ -z "$ready" ]; then
  echo "  ${RD}✗ il server non risponde su ${URL}${RS} — controlla i messaggi qui sopra"
  exit 1
fi

printf '  %s▶%s  %-22s %s\n' "$CY" "$RS" "$URL" "${FG}aperta nel browser${RS}"
printf '  %s▶%s  %-22s %s\n' "$CY" "$RS" "Ctrl+C" "chiude tutto"
echo
open "$URL"

wait "$SERVER_PID" 2>/dev/null || true
