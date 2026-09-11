# GAS Clasp Projects Template

## 目的

GAS でスクリプトを作成するにあたり複数のプロジェクトを並行して開発したい場合に都度設定していた内容をすぐに使い始めれるようにテンプレート化し開発の効率化を図る

## ディレクトリ構成

```
gas_clasp_projects_template/
├── projects/
│   ├── project-a/
│   │   ├── .clasp.json       # プロジェクト固有のclasp設定
│   │   ├── .claspignore      # push対象から除外するファイル（例: *.test.js）
│   │   ├── appsscript.json   # GASマニフェストファイル
│   │   ├── code.js           # GASコード
│   │   └── code.test.js      # ローカルユニットテスト（node:vm でGASグローバルをモック）
│   └── project-b/
│       └── ...
├── scripts/
│   └── clasp-runner.js      # 並列実行スクリプト
├── .github/
│   ├── actions/             # カスタムGitHub Actions
│   └── workflows/           # CI/CDワークフロー
└── package.json
```

> `.claspignore` は clasp の cwd（＝各プロジェクトディレクトリ）基準で解決される。リポジトリ直下に置いても各プロジェクトには効かないため、テストファイルなど push 対象から外したいファイルがある場合はプロジェクトごとに `.claspignore` を置くこと。

## セットアップ

```bash
yarn install
npm install -g @google/clasp  # 未インストールの場合
clasp login
```

## 新規プロジェクトの追加

### 既存のGASスクリプトをclone

```bash
clasp clone {scriptId} --rootDir ./projects/project-name
```

> scriptId は GAS エディタの URL から取得: `https://script.google.com/home/projects/{scriptId}/edit`

### 新規GASプロジェクトを作成

```bash
mkdir -p ./projects/project-name && cd ./projects/project-name
clasp create --title "Project Name" --rootDir .
```

## コマンド一覧

| コマンド | 説明 |
|----------|------|
| `yarn push-all` | 全プロジェクトを GAS に push（並列実行） |
| `yarn push` | **未コミットの変更があるプロジェクトのみ** GAS に push |
| `yarn pull-all` | 全プロジェクトを GAS から pull（並列実行） |
| `yarn pull` | 全プロジェクトを GAS から pull（並列実行） |
| `yarn test` | `code.test.js` のユニットテストを実行 |
| `yarn lint` / `yarn lint:ci` | ESLint（`lint` は自動修正あり、`lint:ci` はチェックのみ） |
| `yarn format` / `yarn format:ci` | Prettier（`format` は書き込みあり、`format:ci` はチェックのみ） |
| `yarn clasp list` | 利用可能なプロジェクト一覧を表示 |
| `clasp open --project ./projects/project-a` | GAS エディタを開く |

push / push-updated（`yarn push`）は、実行前に**現在ログイン中の clasp アカウント**を表示し、
アクセス権のない scriptId は失敗ではなく**スキップ**として扱う（1プロジェクトの権限が無くても他は push される）。

### 個別プロジェクトの操作

```bash
# 利用可能なプロジェクト一覧
yarn clasp list

# 特定プロジェクトのみ push
yarn clasp push -p project-a --force
yarn clasp push -p project-a -p project-b --force

# 特定プロジェクトのみ pull
yarn clasp pull -p project-a

# 未コミットの変更があるプロジェクトのみ push（-p でさらに絞り込みも可能）
yarn clasp push-updated --force
```

### ローカルテスト

`SpreadsheetApp` 等の GAS グローバルに依存しない純粋関数（文字列整形・フィルタリング等）は、
`node:vm` で GAS ファイルを読み込みモックを注入することでローカルにテストできる。
`projects/project-a/code.test.js` をサンプルとして参照すること。

```bash
yarn test
```

テストファイル（`*.test.js`）は各プロジェクトの `.claspignore` に `**/*.test.js` を記載することで
GAS への push 対象から除外している。

### 並列実行オプション

```bash
# 並列数を指定（デフォルト: 3）
PARALLEL_JOBS=5 yarn push-all

# 直接スクリプトを実行
node scripts/clasp-runner.js push --jobs 5 --force
node scripts/clasp-runner.js push-updated --jobs 5 --force
node scripts/clasp-runner.js pull --jobs 2
```

## Git フック

`yarn install`（`prepare` スクリプト）で `simple-git-hooks` により以下が自動設定される。

| フック | 内容 |
|--------|------|
| pre-commit | staged ファイルに ESLint / Prettier（`lint-staged`）、[secretlint](https://github.com/secretlint/secretlint) によるシークレット検出を実行 |
| commit-msg | [commitlint](https://commitlint.js.org/)（`@commitlint/config-conventional`）でコミットメッセージを検証 |

コミットメッセージは `feat: `, `fix: `, `docs: ` 等の [Conventional Commits](https://www.conventionalcommits.org/) 形式に従うこと。
検出ルールは `.secretlintrc.json`、コミットメッセージ規約は `commitlint.config.js` を参照。

## GitHub Actions

| ワークフロー | ファイル | 説明 |
|-------------|----------|------|
| CI | `ci.yml` | push/PR 時に Lint（チェックのみ）・Format（チェックのみ）・テストを実行 |
| Deploy | `projects_push.yaml` | 全プロジェクトを GAS に push（手動実行） |
| Pull | `projects_pull.yaml` | GAS から pull して PR 作成（手動実行） |

### 実行方法

1. GitHub の **Actions** タブを開く
2. ワークフローを選択 → **Run workflow**

## GitHub Secrets 設定

GitHub Actions で clasp を実行するには、以下のシークレットを設定してください。

clasp（google-auth-library の `UserRefreshClient`）が認証に使うのは `client_id` / `client_secret` /
`refresh_token` の3つのみ。`access_token` はリフレッシュ時に必ず Google から再取得され、`id_token` も
リフレッシュ結果の保存先としてしか使われないため、この2つは登録不要（`~/.clasprc.json` に含めても
起動直後に破棄・再取得される）。

### シークレットの取得方法

1. `clasp login` を実行
2. `~/.clasprc.json` から以下の値を取得

```json
{
  "token": {
    "refresh_token": "→ REFRESH_TOKEN"
  },
  "oauth2ClientSettings": {
    "clientId": "→ CLIENT_ID",
    "clientSecret": "→ CLIENT_SECRET"
  }
}
```

### 設定手順

**Settings** > **Secrets and variables** > **Actions** > **New repository secret** で上記3つ
（`REFRESH_TOKEN` / `CLIENT_ID` / `CLIENT_SECRET`）を追加

## トラブルシューティング

| 問題 | 解決方法 |
|------|----------|
| clasp login が失敗 | `clasp login --no-localhost` を試す |
| push/pull でエラー | `clasp login` で再認証、`.clasp.json` の scriptId を確認 |
| GitHub Actions が失敗 | Secrets の設定を確認、トークン期限切れなら再取得 |

## 参考

- [clasp 公式ドキュメント](https://developers.google.com/apps-script/guides/clasp)
- [clasp を使って GAS 開発環境を構築 | DevelopersIO](https://dev.classmethod.jp/articles/vscode-clasp-setting/)
