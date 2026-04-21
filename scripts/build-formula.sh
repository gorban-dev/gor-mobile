#!/usr/bin/env bash
# scripts/build-formula.sh — emit a Homebrew formula for the current tag.
#
# Usage:
#   ./scripts/build-formula.sh <version> <tarball-url>
#
# Prints the formula to stdout. Intended to be redirected into
# homebrew-gor-mobile/Formula/gor-mobile.rb by CI.

set -euo pipefail

VERSION="${1:-}"
TARBALL_URL="${2:-}"

if [[ -z "$VERSION" || -z "$TARBALL_URL" ]]; then
    echo "usage: $0 <version> <tarball-url>" >&2
    exit 1
fi

# Fetch tarball and compute sha256.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$TARBALL_URL" -o "$TMP/tarball.tgz"
SHA="$(shasum -a 256 "$TMP/tarball.tgz" | awk '{print $1}')"

cat <<EOF
class GorMobile < Formula
  desc     "Android-aware overlay installer for Claude Code — superpowers-style workflow"
  homepage "https://github.com/gorban-dev/gor-mobile"
  url      "$TARBALL_URL"
  sha256   "$SHA"
  version  "$VERSION"
  license  "MIT"

  depends_on "git"
  depends_on "node"

  def install
    libexec.install Dir["*"]
    cd libexec do
      system "npm", "install", "--production=false", "--no-audit", "--no-fund"
      system "npm", "run", "build"
    end
    (bin/"gor-mobile").write_env_script libexec/"bin/gor-mobile.mjs",
      GOR_MOBILE_ROOT: libexec.to_s
  end

  def caveats
    <<~EOS
      To finish setup, run:
        gor-mobile init
        gor-mobile doctor
    EOS
  end

  test do
    assert_match "gor-mobile #{version}", shell_output("#{bin}/gor-mobile version")
  end
end
EOF
