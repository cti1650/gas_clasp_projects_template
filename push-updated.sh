#!/bin/bash
set -eu

# 結果を追跡する配列
declare -a success_projects=()
declare -a failed_projects=()
declare -a pushed_dirs=()

# 現在のブランチを取得
branch=$(git rev-parse --abbrev-ref HEAD) || exit

# master ブランチ以外は拒否
if [ "$branch" != "master" ]; then
  echo "Can't push because it's not master branch"
  exit 1
fi

# 一時的に core.quotePath を無効にする
# これにより、git diff の出力で日本語ファイル名がエスケープされずに表示されるようになる
OLD_QUOTE_PATH=$(git config core.quotePath || echo "")
git config core.quotePath false

# 一時ファイルを作成
temp_changed_dirs=$(mktemp)

# スクリプト終了時にクリーンアップ
cleanup() {
  rm -f "$temp_changed_dirs"
  if [ -n "$OLD_QUOTE_PATH" ]; then
    git config core.quotePath "$OLD_QUOTE_PATH"
  else
    git config --unset core.quotePath 2>/dev/null || true
  fi
}
trap cleanup EXIT

# 変更があったファイルのパスを取得
# --name-only はファイル名のみ、--diff-filter=d は削除されたファイルを除外
changed_files=$(git diff --name-only --diff-filter=d HEAD)

if [ -z "$changed_files" ]; then
  echo "No changes detected."
  exit 0
fi

for file in $changed_files; do
  # ファイルが projects/ ディレクトリ内にあるかチェック
  if [[ "$file" == projects/* ]]; then
    dir=$(dirname "$file")
    # projects/ の直下、またはそれ以下の任意の階層のディレクトリであれば対象
    if [[ "$dir" =~ ^projects/.*$ ]]; then
      echo "$dir" >> "$temp_changed_dirs"
    fi
  fi
done

# ユニークなディレクトリリストを取得
unique_dirs=$(sort -u "$temp_changed_dirs")

if [ -z "$unique_dirs" ]; then
  echo "No project changes detected."
  exit 0
fi

# 各ディレクトリに対して処理を実行
while IFS= read -r project_dir; do
  # find コマンドを使って project_dir 内から .clasp.json を含む最も近いディレクトリを見つける
  clasp_json_path=$(find "$project_dir" -type f -name ".clasp.json" -print -quit)

  if [ -n "$clasp_json_path" ]; then
    clasp_project_root=$(dirname "$clasp_json_path")

    # 既にpushしたディレクトリはスキップ
    already_pushed=false
    for pushed in "${pushed_dirs[@]:-}"; do
      if [ "$pushed" = "$clasp_project_root" ]; then
        already_pushed=true
        break
      fi
    done

    if [ "$already_pushed" = true ]; then
      continue
    fi

    echo "Executing clasp push in: $clasp_project_root"
    if (cd "$clasp_project_root" && clasp push); then
      success_projects+=("$clasp_project_root")
    else
      echo "Error: clasp push failed in $clasp_project_root"
      failed_projects+=("$clasp_project_root")
    fi
    pushed_dirs+=("$clasp_project_root")
  else
    echo "Skipping (no .clasp.json found in or under): $project_dir"
  fi
done <<< "$unique_dirs"

# 結果サマリーを出力
echo ""
echo "========== Summary =========="
echo "Success: ${#success_projects[@]} project(s)"
for p in "${success_projects[@]:-}"; do
  [ -n "$p" ] && echo "  ✓ $p"
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
