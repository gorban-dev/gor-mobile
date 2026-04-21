#!/usr/bin/env bash
# gor-mobile curl installer.
#
#   curl -fsSL https://raw.githubusercontent.com/gorban-dev/gor-mobile/main/install.sh | bash
#
# Clones the CLI to ~/.gor-mobile/core/, installs npm deps, builds dist/,
# and symlinks the binary.

set -euo pipefail

GOR_MOBILE_REPO="${GOR_MOBILE_REPO:-https://github.com/gorban-dev/gor-mobile.git}"
GOR_MOBILE_REF="${GOR_MOBILE_REF:-main}"
GOR_MOBILE_HOME="${GOR_MOBILE_HOME:-$HOME/.gor-mobile}"
GOR_MOBILE_CORE="$GOR_MOBILE_HOME/core"
BIN_DIR="${BIN_DIR:-/usr/local/bin}"
SYMLINK="$BIN_DIR/gor-mobile"

info() { printf "\033[36m[info]\033[0m %s\n" "$*"; }
err()  { printf "\033[31m[err]\033[0m  %s\n" "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || err "Missing dependency: git"
command -v curl >/dev/null 2>&1 || err "Missing dependency: curl"
command -v node >/dev/null 2>&1 || err "Missing dependency: node (install Node 20+: brew install node)"

NODE_MAJOR="$(node -p 'parseInt(process.versions.node.split(".")[0], 10)')"
if (( NODE_MAJOR < 20 )); then
    err "Node 20+ required (found v$(node -v)). Upgrade: brew upgrade node"
fi

command -v npm >/dev/null 2>&1 || err "Missing dependency: npm (bundled with node)"

info "Installing gor-mobile → $GOR_MOBILE_CORE"
mkdir -p "$GOR_MOBILE_HOME"

if [[ -d "$GOR_MOBILE_CORE/.git" ]]; then
    info "Already installed — pulling latest"
    git -C "$GOR_MOBILE_CORE" fetch --quiet origin
    git -C "$GOR_MOBILE_CORE" checkout --quiet "$GOR_MOBILE_REF"
    git -C "$GOR_MOBILE_CORE" pull --ff-only --quiet
else
    git clone --depth 1 --branch "$GOR_MOBILE_REF" "$GOR_MOBILE_REPO" "$GOR_MOBILE_CORE"
fi

info "Installing npm dependencies (this may take ~15s on first run)"
( cd "$GOR_MOBILE_CORE" && npm install --no-audit --no-fund --loglevel=error )

if [[ ! -f "$GOR_MOBILE_CORE/dist/cli.js" ]]; then
    info "Building dist/"
    ( cd "$GOR_MOBILE_CORE" && npm run build )
fi

chmod +x "$GOR_MOBILE_CORE/bin/gor-mobile.mjs"

# Symlink into BIN_DIR. Fall back to ~/.local/bin if /usr/local/bin is unwritable.
if ! mkdir -p "$BIN_DIR" 2>/dev/null || ! touch "$BIN_DIR/.gor-mobile-write-probe" 2>/dev/null; then
    BIN_DIR="$HOME/.local/bin"
    mkdir -p "$BIN_DIR"
    SYMLINK="$BIN_DIR/gor-mobile"
    info "Using $BIN_DIR (add it to your PATH if not already)"
fi
rm -f "$BIN_DIR/.gor-mobile-write-probe" 2>/dev/null || true

ln -sf "$GOR_MOBILE_CORE/bin/gor-mobile.mjs" "$SYMLINK"
info "Symlinked $SYMLINK"

info "Done. Next:"
printf "  \$ gor-mobile init\n"
