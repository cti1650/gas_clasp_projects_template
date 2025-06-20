#!/bin/bash
set -eu

# 現在のブランチを取得
branch=$(git rev-parse --abbrev-ref HEAD) || exit

# master ブランチ以外は拒否
if [ "$branch" != "master" ]; then
  echo "Can't push because it's not master branch"
  exit 1
fi

# 一時的に core.quotePath を無効にする
# これにより、git diff の出力で日本語ファイル名がエスケープされずに表示されるようになる
OLD_QUOTE_PATH=$(git config core.quotePath || echo "") # 現在の設定を取得 (設定がない場合を考慮)
git config core.quotePath false
# スクリプト終了時に元の設定に戻すことを保証
trap "git config core.quotePath ${OLD_QUOTE_PATH}; exit" EXIT # exit を追加して確実に終了

# 変更があったファイルのパスを取得
# --name-only はファイル名のみ、--diff-filter=d は削除されたファイルを除外
changed_files=$(git diff --name-only --diff-filter=d HEAD)

# 変更があったファイルの親ディレクトリのリストを一時ファイルに保存
# 同じディレクトリが複数回出てくる可能性があるので、sort -u でユニークにする
temp_changed_dirs=$(mktemp)
# trap の順序を調整: rm -f を先に実行してから git config を戻す
trap 'rm -f "$temp_changed_dirs" && git config core.quotePath ${OLD_QUOTE_PATH}; exit' EXIT

for file in $changed_files; do
  # ファイルが projects/ ディレクトリ内にあるかチェック
  if [[ "$file" == projects/* ]]; then
    dir=$(dirname "$file")
    # projects/ の直下、またはそれ以下の任意の階層のディレクトリであれば対象
    # projects/foo.js のようにファイル自身が projects/ 直下にある場合も dirname は projects になるが、
    # その場合は .clasp.json が見つからずにスキップされるため問題ない
    if [[ "$dir" =~ ^projects/.*$ ]]; then
      echo "$dir" >> "$temp_changed_dirs"
    fi
  fi
done

# ユニークなディレクトリリストを取得し、各ディレクトリに対して処理を実行
sort -u "$temp_changed_dirs" | while IFS= read -r project_dir; do
  # **変更点**: dirname を使ってプロジェクトのルートディレクトリを特定するのではなく、
  # find コマンドを使って project_dir 内から .clasp.json を含む最も近いディレクトリを見つける
  # -type f はファイル、-name はファイル名、-print -quit は最初に見つけたパスを出力して終了
  clasp_json_path=$(find "$project_dir" -type f -name ".clasp.json" -print -quit)

  if [ -n "$clasp_json_path" ]; then
    # .clasp.json が見つかったディレクトリを取得
    # 例: projects/foo/bar/hoge/.clasp.json が見つかった場合、projects/foo/bar/hoge を対象とする
    clasp_project_root=$(dirname "$clasp_json_path")
    
    echo "Executing clasp push in: $clasp_project_root"
    (cd "$clasp_project_root" && clasp push)
  else
    echo "Skipping (no .clasp.json found in or under): $project_dir"
  fi
done