#!/usr/bin/env bash
# Deploy Fillim on the VPS: fast-forward the live checkout to a commit, install, build the Studio UI,
# restart the user-level `fillim` systemd service, and health-check it. Any failure rolls back to the
# commit that was live before and restarts that, so the site is never left on a broken build.
#
# Usage: scripts/deploy-vps.sh [<sha>]     (default: origin/main)
# Env:   FILLIM_DIR      live checkout       (default: /home/kunalkashyap8024/sop/products/SAAS/fillim)
#        FILLIM_SERVICE  systemd user unit   (default: fillim)
#        FILLIM_HEALTH   URL that must 200   (default: http://127.0.0.1:4848/api/saas/config)
set -euo pipefail

FILLIM_DIR="${FILLIM_DIR:-/home/kunalkashyap8024/sop/products/SAAS/fillim}"
FILLIM_SERVICE="${FILLIM_SERVICE:-fillim}"
FILLIM_HEALTH="${FILLIM_HEALTH:-http://127.0.0.1:4848/api/saas/config}"
export PATH="$HOME/.local/nodejs/bin:$HOME/.local/bin:$PATH"
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
# systemctl --user needs the user's bus when started from a runner service
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

cd "$FILLIM_DIR"
target="${1:-}"

# Never overwrite work someone left on the server: tracked files must be clean.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "::error::$FILLIM_DIR has uncommitted changes to tracked files; commit or stash them on the VPS first." >&2
  git status --short --untracked-files=no >&2
  exit 1
fi

prev="$(git rev-parse HEAD)"
git fetch --quiet origin main
target="${target:-$(git rev-parse origin/main)}"
echo "live: $prev  ->  target: $target"

build_and_restart() {
  pnpm install --frozen-lockfile --prefer-offline
  pnpm --filter openfilm build:ui
  systemctl --user restart "$FILLIM_SERVICE"
  for _ in $(seq 1 30); do
    sleep 2
    if curl -fsS -o /dev/null --max-time 5 "$FILLIM_HEALTH"; then
      echo "healthy: $FILLIM_HEALTH"
      return 0
    fi
  done
  echo "::error::$FILLIM_SERVICE did not become healthy at $FILLIM_HEALTH" >&2
  tail -n 40 "$HOME/.cloudflared/fillim.log" >&2 || true
  return 1
}

rollback() {
  echo "::warning::rolling back to $prev" >&2
  git reset --quiet --hard "$prev"
  build_and_restart || echo "::error::rollback build also failed; check the server by hand" >&2
  exit 1
}

if [ "$prev" != "$target" ]; then
  git merge --ff-only --quiet "$target" || { echo "::error::$target does not fast-forward from $prev" >&2; exit 1; }
fi

build_and_restart || rollback
echo "deployed $(git rev-parse --short HEAD)"
