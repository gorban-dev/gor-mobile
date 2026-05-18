#!/usr/bin/env bash
# scripts/release.sh — cut a new tag and print release notes.
#
# Usage:
#   ./scripts/release.sh <new-version>      # e.g. 0.2.0
#
# - Bumps the version in package.json, src/constants.ts, and README.md
# - Rebuilds dist/ (committed alongside the bump)
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

# Bump version across all sources of truth.
sed -i.bak -E "s/\"version\": \".*\"/\"version\": \"$NEW\"/" package.json
sed -i.bak -E "s/^export const GOR_MOBILE_VERSION = \".*\";$/export const GOR_MOBILE_VERSION = \"$NEW\";/" src/constants.ts
sed -i.bak -E "s/\`v[0-9]+\.[0-9]+\.[0-9]+\`/\`v$NEW\`/" README.md
rm -f package.json.bak src/constants.ts.bak README.md.bak

# Rebuild dist/ so the tagged commit ships the matching artefact.
npm run build

git add package.json src/constants.ts README.md dist/
git commit -m "chore: release v$NEW"
git tag "v$NEW"

TARBALL="https://github.com/gorban-dev/gor-mobile/archive/refs/tags/v${NEW}.tar.gz"
echo
echo "Tagged v$NEW. Push with:"
echo "  git push && git push --tags"
echo
echo "The release workflow will regenerate the brew formula automatically."
