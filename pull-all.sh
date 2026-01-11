#!/bin/bash
set -eu

# 結果を追跡する配列
declare -a success_projects=()
declare -a failed_projects=()

# "projects/*/*" の各ディレクトリに対して
for project in $(find "$(pwd)/projects" -mindepth 1 -maxdepth 3 -type d); do
  # .clasp.json が直下にあるか確認
  if [ -f "$project/.clasp.json" ]; then
    echo "Executing clasp pull in: $project"
    if (cd "$project" && clasp pull); then
      success_projects+=("$project")
    else
      echo "Error: clasp pull failed in $project"
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
