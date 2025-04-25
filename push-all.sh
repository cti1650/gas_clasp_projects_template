#!/bin/bash
set -eu

# 現在のブランチを取得
branch=$(git rev-parse --abbrev-ref HEAD) || exit

# master ブランチ以外は拒否
if [ "$branch" != "master" ]; then
  echo "Can't push because it's not master branch"
  exit 1
fi

# projects/*/* の中で .clasp.json があるディレクトリだけを対象
for project in $(find "$(pwd)/projects" -mindepth 1 -maxdepth 3 -type d); do
  if [ -f "$project/.clasp.json" ]; then
    echo "Executing clasp push in: $project"
    (cd "$project" && clasp push)
  else
    echo "Skipping (no .clasp.json): $project"
  fi
done
