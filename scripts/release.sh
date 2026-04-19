#!/usr/bin/env bash
# scripts/release.sh — cut a new tag and print release notes.
#
# Usage:
#   ./scripts/release.sh <new-version>      # e.g. 0.2.0
#
# - Bumps GOR_MOBILE_VERSION in lib/constants.sh
# - Commits the bump
# - Tags v<new-version>
# - Prints the tarball URL + formula command

set -euo pipefail

NEW="${1:-}"
if [[ -z "$NEW" ]]; then
    echo "usage: $0 <new-version>" >&2
    exit 1
fi
if ! [[ "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Version must be SemVer (X.Y.Z), got: $NEW" >&2
    exit 1
fi

cd "$(git rev-parse --show-toplevel)"

if [[ -n "$(git status --porcelain)" ]]; then
    echo "Working tree is dirty — commit or stash first" >&2
    exit 1
fi

sed -i.bak -E "s/^GOR_MOBILE_VERSION=\".*\"/GOR_MOBILE_VERSION=\"$NEW\"/" lib/constants.sh
rm -f lib/constants.sh.bak

git add lib/constants.sh
git commit -m "chore: release v$NEW"
git tag "v$NEW"

TARBALL="https://github.com/gorban/gor-mobile/archive/refs/tags/v${NEW}.tar.gz"
echo
echo "Tagged v$NEW. Push with:"
echo "  git push && git push --tags"
echo
echo "Then regenerate the brew formula:"
echo "  ./scripts/build-formula.sh $NEW '$TARBALL' > ../homebrew-gor-mobile/Formula/gor-mobile.rb"
