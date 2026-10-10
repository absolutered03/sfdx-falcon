#!/usr/bin/env bash
# One command to run Platform Changelog on your machine: npm run local
#
#   npm run local                     database, schema, seed, fetch, full release notes, build, start
#   npm run local -- --summarize 10   also have the model write up to 10 entries (needs ANTHROPIC_API_KEY;
#                                     these publish to your local feed, about $0.01 to $0.30 depending on model)
#   npm run local -- --dev            start with hot reload (next dev) instead of a production build
#   npm run local -- --skip-fetch     reuse what is already in the database (fast restart)
#
# Needs Node 20+ and either Docker (for the bundled Postgres) or a DATABASE_URL in .env
# pointing at a Postgres you run yourself. On Windows, run it from WSL or Git Bash.
set -euo pipefail
cd "$(dirname "$0")/.."

SUMMARIZE=0; DEV=0; FETCH=1
while [ $# -gt 0 ]; do
  case "$1" in
    --summarize) SUMMARIZE="${2:-10}"; shift ;;
    --dev) DEV=1 ;;
    --skip-fetch) FETCH=0 ;;
    *) echo "unknown option: $1"; exit 2 ;;
  esac
  shift
done
PORT="${PORT:-3000}"
step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mxx %s\033[0m\n' "$*"; exit 1; }

step "Checking Node"
command -v node >/dev/null || fail "Node 20 or later is required: https://nodejs.org"
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || fail "Node 20 or later is required (found $(node -v))"

step "Writing .env (first run only)"
if [ ! -f .env ]; then
  PASS="$(node -e 'console.log(require("crypto").randomBytes(9).toString("base64url"))')"
  sed -e "s#^DATABASE_URL=.*#DATABASE_URL=postgres://pcl:pcl@localhost:5433/platformchangelog#" \
      -e "s#^ADMIN_PASSWORD=.*#ADMIN_PASSWORD=${PASS}#" \
      -e "s#^\# SITE_URL=.*#SITE_URL=http://localhost:${PORT}#" \
      .env.example > .env
  echo "created .env (admin password generated; add ANTHROPIC_API_KEY there to enable summaries)"
else
  echo ".env exists, keeping it"
fi
set -a; . ./.env; set +a

step "Starting Postgres"
db_ready() { node -e '
  const u = new URL(process.env.DATABASE_URL);
  require("net").connect(Number(u.port || 5432), u.hostname).on("connect", () => process.exit(0)).on("error", () => process.exit(1));' 2>/dev/null; }
if db_ready; then
  echo "database reachable at ${DATABASE_URL%%@*}@..."
elif command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  docker compose up -d --wait db || fail "could not start the Postgres container (docker compose up db)"
else
  fail "No database at DATABASE_URL and Docker is not running. Start Docker Desktop, or point DATABASE_URL in .env at your own Postgres."
fi
for _ in $(seq 1 30); do db_ready && break; sleep 1; done
db_ready || fail "database did not come up at DATABASE_URL"

step "Installing dependencies"
npm ci --no-audit --no-fund --loglevel=error

step "Creating tables"
npx drizzle-kit push --force

step "Loading sources and tools"
npm run --silent seed

if [ "$FETCH" = 1 ]; then
  step "Fetching sources (summaries: ${SUMMARIZE})"
  if [ "$SUMMARIZE" != 0 ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo "--summarize needs ANTHROPIC_API_KEY in .env; fetching without summaries"; SUMMARIZE=0
  fi
  MAX_LLM_CALLS_PER_RUN="$SUMMARIZE" npm run --silent ingest || echo "ingest reported errors (one broken feed never stops the run); continuing"

  step "Pulling full release notes and typing every line"
  # A GitHub token raises the API limit from 60 to 5,000 requests an hour. Optional.
  if [ -z "${GITHUB_TOKEN:-}" ] && command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
    export GITHUB_TOKEN="$(gh auth token)"; echo "using your gh login for GitHub API requests"
  fi
  npm run --silent rebuild:releases -- --refetch
fi

step "Running unit tests"
npm test --silent 2>&1 | grep -E "^# (pass|fail)" || true

if [ "$DEV" = 1 ]; then
  step "Starting dev server"
  echo "open http://localhost:${PORT}   admin: http://localhost:${PORT}/admin  user ${ADMIN_USER}  password ${ADMIN_PASSWORD}"
  exec npx next dev -p "$PORT"
fi
step "Building"
npm run --silent build
step "Starting"
echo "open http://localhost:${PORT}   admin: http://localhost:${PORT}/admin  user ${ADMIN_USER}  password ${ADMIN_PASSWORD}"
echo "stop with ctrl-c; the database keeps running (docker compose stop db to stop it)"
exec npx next start -p "$PORT"
