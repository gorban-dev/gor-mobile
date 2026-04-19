#!/usr/bin/env bash
# gor-mobile curl installer.
#
#   curl -fsSL https://raw.githubusercontent.com/gorban-dev/gor-mobile/main/install.sh | bash
#
# Clones the CLI to ~/.gor-mobile/core/ and symlinks the binary.

set -euo pipefail

GOR_MOBILE_REPO="${GOR_MOBILE_REPO:-https://github.com/gorban-dev/gor-mobile.git}"
GOR_MOBILE_REF="${GOR_MOBILE_REF:-main}"
GOR_MOBILE_HOME="${GOR_MOBILE_HOME:-$HOME/.gor-mobile}"
GOR_MOBILE_CORE="$GOR_MOBILE_HOME/core"
BIN_DIR="${BIN_DIR:-/usr/local/bin}"
SYMLINK="$BIN_DIR/gor-mobile"

info() { printf "\033[36m[info]\033[0m %s\n" "$*"; }
err()  { printf "\033[31m[err]\033[0m  %s\n" "$*" >&2; exit 1; }

for bin in git curl jq; do
    command -v "$bin" >/dev/null 2>&1 || err "Missing dependency: $bin"
done

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

chmod +x "$GOR_MOBILE_CORE/bin/gor-mobile"

# Symlink into BIN_DIR. Fall back to ~/.local/bin if /usr/local/bin is unwritable.
if ! mkdir -p "$BIN_DIR" 2>/dev/null || ! touch "$BIN_DIR/.gor-mobile-write-probe" 2>/dev/null; then
    BIN_DIR="$HOME/.local/bin"
    mkdir -p "$BIN_DIR"
    SYMLINK="$BIN_DIR/gor-mobile"
    info "Using $BIN_DIR (add it to your PATH if not already)"
fi
rm -f "$BIN_DIR/.gor-mobile-write-probe" 2>/dev/null || true

ln -sf "$GOR_MOBILE_CORE/bin/gor-mobile" "$SYMLINK"
info "Symlinked $SYMLINK"

info "Done. Next:"
printf "  \$ gor-mobile init\n"
