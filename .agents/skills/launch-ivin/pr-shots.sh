#!/usr/bin/env bash
set -euo pipefail
[ $# -gt 0 ] || { echo "usage: $0 <png>..." >&2; exit 1; }

store=pr-screenshots
dir=$(git branch --show-current | tr / -)
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)

# A separate index, so the checkout and its staged changes stay untouched.
export GIT_INDEX_FILE=$(mktemp -u)
trap 'rm -f "$GIT_INDEX_FILE"' EXIT
parent=
if git fetch -q origin "$store" 2>/dev/null; then
  parent=$(git rev-parse FETCH_HEAD)
  git read-tree "$parent"
fi
for f in "$@"; do
  git update-index --add --cacheinfo "100644,$(git hash-object -w "$f"),$dir/$(basename "$f")"
done
commit=$(git commit-tree "$(git write-tree)" ${parent:+-p "$parent"} -m "chore: screenshots for $dir")
git push -q origin "$commit:refs/heads/$store"

for f in "$@"; do
  name=$(basename "$f")
  echo "![${name%.*}](https://raw.githubusercontent.com/$repo/$commit/$dir/$name)"
done
