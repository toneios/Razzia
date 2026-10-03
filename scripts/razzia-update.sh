#!/usr/bin/env bash
# Run inside the Razzia container, outside a live game.
set -Eeuo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Run as root inside the Razzia container.' >&2; exit 1; fi
if [[ ! -f /etc/razzia-as-event.conf ]]; then echo 'Create /etc/razzia-as-event.conf as documented in docs/as-event-proxmox.md.' >&2; exit 1; fi
# This file is managed by the local root administrator.
source /etc/razzia-as-event.conf
: "${RAZZIA_REPOSITORY:?Missing RAZZIA_REPOSITORY}"
: "${RAZZIA_BRANCH:?Missing RAZZIA_BRANCH}"
: "${RAZZIA_WEB_ROOT:?Set RAZZIA_WEB_ROOT to the existing nginx root}"
RAZZIA_RELEASES=/opt/razzia-as-event/releases
RAZZIA_CURRENT=/opt/razzia-as-event/current
RAZZIA_DROPIN=/etc/systemd/system/razzia.service.d/90-as-event.conf
RAZZIA_CONFIG=/opt/razzia-config
[[ $RAZZIA_WEB_ROOT =~ ^/[a-zA-Z0-9_./-]+$ && $RAZZIA_WEB_ROOT != *..* ]] || { echo 'Unsupported web root path.' >&2; exit 1; }
[[ -f $RAZZIA_WEB_ROOT/index.html && -f $RAZZIA_CONFIG/game.json ]] || { echo 'Existing web root or configuration not found; nothing changed.' >&2; exit 1; }
for cmd in git pnpm node nginx systemctl curl flock; do command -v "$cmd" >/dev/null; done
[[ $(node -p 'Number(process.versions.node.split(".")[0]) >= 24') == true ]] || { echo 'Node.js 24+ required.' >&2; exit 1; }
[[ -x /usr/bin/node ]] || { echo '/usr/bin/node is required by the existing service.' >&2; exit 1; }
exec 9>/run/lock/razzia-as-event.lock
flock -n 9 || { echo 'Another update is running.' >&2; exit 1; }
nginx -t
# Refuse an unrelated directory: it must be an actual nginx root directive.
nginx -T 2>/dev/null | awk '$1 == "root" {gsub(/;/,"",$2); print $2}' | grep -Fx -- "$RAZZIA_WEB_ROOT" >/dev/null || { echo 'RAZZIA_WEB_ROOT does not match an nginx root directive.' >&2; exit 1; }
systemctl is-active --quiet razzia || { echo 'The existing razzia service must be running.' >&2; exit 1; }
mkdir -p "$RAZZIA_RELEASES"
RAZZIA_STAGE=$(mktemp -d "$RAZZIA_RELEASES/release-XXXXXXXX")
echo "Building $RAZZIA_REPOSITORY ($RAZZIA_BRANCH) in $RAZZIA_STAGE; the running version is unchanged."
git clone --depth 1 --single-branch --branch "$RAZZIA_BRANCH" "$RAZZIA_REPOSITORY" "$RAZZIA_STAGE"
cd "$RAZZIA_STAGE"
pnpm install --frozen-lockfile
pnpm build
pnpm exec tsc --noEmit -p packages/socket/tsconfig.json
pnpm exec tsc --noEmit -p packages/web/tsconfig.app.json
[[ -s packages/socket/dist/index.cjs && -s packages/web/dist/index.html ]]
# Configuration and branding stay outside releases. Useful for preview as well.
ln -s "$RAZZIA_CONFIG" "$RAZZIA_STAGE/config"
chmod a+rx /opt/razzia-as-event "$RAZZIA_RELEASES" "$RAZZIA_STAGE"
chmod -R a+rX "$RAZZIA_STAGE/packages/web/dist"
if [[ ${1:-} != --activate ]]; then
  echo "Build verified at $RAZZIA_STAGE. Nothing activated. Run razzia-update --activate outside a game to deploy."
  exit 0
fi
RAZZIA_OLD_CURRENT=$(readlink "$RAZZIA_CURRENT" || true)
RAZZIA_OLD_WEB=$(readlink "$RAZZIA_WEB_ROOT" || true)
RAZZIA_WEB_MOVED=0
RAZZIA_HAD_DROPIN=0
RAZZIA_WEB_PREVIOUS="${RAZZIA_WEB_ROOT}.before-as-event"
mkdir -p "$(dirname "$RAZZIA_DROPIN")"
if [[ -f $RAZZIA_DROPIN ]]; then cp "$RAZZIA_DROPIN" "$RAZZIA_STAGE/previous-service.conf"; RAZZIA_HAD_DROPIN=1; fi
if [[ ! -L $RAZZIA_WEB_ROOT && -e $RAZZIA_WEB_PREVIOUS ]]; then echo "Refusing to overwrite $RAZZIA_WEB_PREVIOUS" >&2; exit 1; fi
atomic_link() { ln -s "$1" "$2.new-$$"; mv -Tf "$2.new-$$" "$2"; }
rollback() {
  local result=$?
  trap - ERR INT TERM
  echo 'Activation failed; restoring the previous application.' >&2
  if [[ -n $RAZZIA_OLD_CURRENT ]]; then atomic_link "$RAZZIA_OLD_CURRENT" "$RAZZIA_CURRENT"; else rm -f "$RAZZIA_CURRENT"; fi
  if [[ $RAZZIA_WEB_MOVED == 1 ]]; then rm -f "$RAZZIA_WEB_ROOT"; mv "$RAZZIA_WEB_PREVIOUS" "$RAZZIA_WEB_ROOT";
  elif [[ -n $RAZZIA_OLD_WEB ]]; then atomic_link "$RAZZIA_OLD_WEB" "$RAZZIA_WEB_ROOT"; fi
  if [[ $RAZZIA_HAD_DROPIN == 1 ]]; then cp "$RAZZIA_STAGE/previous-service.conf" "$RAZZIA_DROPIN"; else rm -f "$RAZZIA_DROPIN"; fi
  systemctl daemon-reload
  systemctl restart razzia || true
  exit "${result:-1}"
}
trap rollback ERR INT TERM
atomic_link "$RAZZIA_STAGE" "$RAZZIA_CURRENT"
if [[ ! -L $RAZZIA_WEB_ROOT ]]; then mv "$RAZZIA_WEB_ROOT" "$RAZZIA_WEB_PREVIOUS"; RAZZIA_WEB_MOVED=1; fi
atomic_link "$RAZZIA_CURRENT/packages/web/dist" "$RAZZIA_WEB_ROOT"
cat > "$RAZZIA_DROPIN" <<EOF
[Service]
WorkingDirectory=$RAZZIA_CURRENT/packages/socket
Environment=CONFIG_PATH=$RAZZIA_CONFIG
Environment=SOCKET_PORT=3001
ExecStart=
ExecStart=/usr/bin/node $RAZZIA_CURRENT/packages/socket/dist/index.cjs
EOF
systemctl daemon-reload
systemctl restart razzia
RAZZIA_HEALTHY=0
for attempt in {1..15}; do
  if curl -fsS --max-time 2 'http://127.0.0.1:3001/ws/?EIO=4&transport=polling' | grep -q '^0'; then RAZZIA_HEALTHY=1; break; fi
  sleep 1
done
[[ $RAZZIA_HEALTHY == 1 ]]
systemctl is-active --quiet razzia
trap - ERR INT TERM
echo "Activated $(git rev-parse --short HEAD). Configuration preserved at $RAZZIA_CONFIG. Refresh all browsers."
