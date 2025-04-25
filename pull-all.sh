#!/bin/bash
set -eu

# "projects/*/*" の各ディレクトリに対して
for project in $(find "$(pwd)/projects" -mindepth 1 -maxdepth 3 -type d); do
  # .clasp.json が直下にあるか確認
  if [ -f "$project/.clasp.json" ]; then
    echo "Executing clasp pull in: $project"
    (cd "$project" && clasp pull)
  else
    echo "Skipping (no .clasp.json): $project"
  fi
done
