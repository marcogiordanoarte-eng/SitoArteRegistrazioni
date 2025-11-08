#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/save_snapshot.sh "descrizione-breve"
# Creates an annotated tag restore-YYYY-MM-DD-HHMMSS-<descrizione>
# And updates/creates the convenience tag baseline-current to the same commit.

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Run from inside the dashboard repo" >&2
  exit 1
fi

desc=${1:-snapshot}
ts=$(date +%F-%H%M%S)
tag="restore-${ts}-${desc}"
commit=$(git rev-parse --short HEAD)

echo "Creating snapshot tag: ${tag} at ${commit}" 

git tag -a "${tag}" -m "Snapshot: ${desc} @ ${commit}"

echo "Updating alias tag: baseline-current -> ${commit}" 
# Create or move baseline-current; if exists, delete and recreate to move it safely
if git rev-parse -q --verify refs/tags/baseline-current >/dev/null; then
  git tag -d baseline-current >/dev/null
fi

git tag -a baseline-current -m "Alias for ${tag}" "${commit}"

echo "Done. Tags pointing at HEAD:" 
git tag --points-at HEAD
