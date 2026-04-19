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
  desc     "Android development CLI — superpowers-style workflow with local-LLM delegation"
  homepage "https://github.com/gorban-dev/gor-mobile"
  url      "$TARBALL_URL"
  sha256   "$SHA"
  version  "$VERSION"
  license  "MIT"

  depends_on "git"
  depends_on "jq"
  depends_on "python@3.12"

  def install
    libexec.install Dir["*"]
    (bin/"gor-mobile").write_env_script libexec/"bin/gor-mobile", GOR_MOBILE_ROOT: libexec.to_s
  end

  def caveats
    <<~EOS
      To finish setup, run:
        gor-mobile init

      For LM Studio integration, install the LM Studio desktop app from
      https://lmstudio.ai and run:
        lms get qwen/qwen3-coder-30b
        lms get google/gemma-4-26b-a4b
    EOS
  end

  test do
    assert_match "gor-mobile #{version}", shell_output("#{bin}/gor-mobile version")
  end
end
EOF
