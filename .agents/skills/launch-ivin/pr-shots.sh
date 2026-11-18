#!/usr/bin/env bash
set -euo pipefail
[ $# -gt 0 ] || { echo "usage: $0 <png>..." >&2; exit 1; }

shots_branch=pr-screenshots
dir=$(git branch --show-current | tr / -)
[ -n "$dir" ] || { echo "run it from the pull request's branch" >&2; exit 1; }
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)

# A separate index, so the checkout and its staged changes stay untouched.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export GIT_INDEX_FILE=$tmp/index
parent=
if git fetch -q origin "$shots_branch" 2>/dev/null; then
  parent=$(git rev-parse FETCH_HEAD)
  git read-tree "$parent"
fi
for f in "$@"; do
  git update-index --add --cacheinfo "100644,$(git hash-object -w "$f"),$dir/$(basename "$f")"
done
commit=$(git commit-tree "$(git write-tree)" ${parent:+-p "$parent"} -m "chore: screenshots for $dir")
git push -q origin "$commit:refs/heads/$shots_branch"

for f in "$@"; do
  name=$(basename "$f")
  echo "![${name%.*}](https://raw.githubusercontent.com/$repo/$commit/$dir/$name)"
done
