#!/bin/bash
set -eu

# 結果を追跡する配列
declare -a success_projects=()
declare -a failed_projects=()

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
    if (cd "$project" && clasp push); then
      success_projects+=("$project")
    else
      echo "Error: clasp push failed in $project"
      failed_projects+=("$project")
    fi
  else
    echo "Skipping (no .clasp.json): $project"
  fi
done

# 結果サマリーを出力
echo ""
echo "========== Summary =========="
echo "Success: ${#success_projects[@]} project(s)"
for p in "${success_projects[@]}"; do
  echo "  ✓ $p"
done

if [ ${#failed_projects[@]} -gt 0 ]; then
  echo ""
  echo "Failed: ${#failed_projects[@]} project(s)"
  for p in "${failed_projects[@]}"; do
    echo "  ✗ $p"
  done
  exit 1
fi

echo "============================="
