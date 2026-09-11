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
npm install
npm install -g @google/clasp@3.4.1  # 未インストールの場合
clasp login
```

GitHub Actions 側は `.github/actions/clasp_init` で clasp を **3.4.1 に固定**している。
ローカルもバージョンを揃えておくと、CI との挙動差による事故を避けられる。

なお `scripts/clasp-runner.js` は clasp 2.x / 3.x の**双方で動作する**（サブコマンド名の差は
実行時にバージョンを検出して吸収している）ため、既存環境の clasp が 2.x でもそのまま使える。

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

| コマンド                               | 説明                                                            |
| -------------------------------------- | --------------------------------------------------------------- |
| `npm run push-all`                     | 全プロジェクトを GAS に push（並列実行）                        |
| `npm run push`                         | **未コミットの変更があるプロジェクトのみ** GAS に push          |
| `npm run pull-all`                     | 全プロジェクトを GAS から pull（並列実行）                      |
| `npm run pull`                         | 全プロジェクトを GAS から pull（並列実行）                      |
| `npm run push-dir -- <パス>`           | 指定パス配下のプロジェクトのみ push                             |
| `npm run pull-dir -- <パス>`           | 指定パス配下のプロジェクトのみ pull                             |
| `npm run open-dir -- <パス>`           | 指定パス配下のプロジェクトをブラウザで開く                      |
| `npm test`                             | `code.test.js` のユニットテストを実行                           |
| `npm run lint` / `npm run lint:ci`     | ESLint（`lint` は自動修正あり、`lint:ci` はチェックのみ）       |
| `npm run format` / `npm run format:ci` | Prettier（`format` は書き込みあり、`format:ci` はチェックのみ） |
| `npm run clasp -- list`                | 利用可能なプロジェクト一覧を表示                                |

push / push-updated（`npm run push`）は、実行前に**現在ログイン中の clasp アカウント**を表示し、
アクセス権のない scriptId は失敗ではなく**スキップ**として扱う（1プロジェクトの権限が無くても他は push される）。

> [!IMPORTANT]
> `npm run clasp` にオプションを渡す場合は、スクリプト名の直後に **`--` が必須**。
> `--` を省くと `-p` や `--force` を npm 自身のオプションとして解釈してしまい、
> **エラーにならずにオプションが欠落したまま実行される**（`--force` が無視される等）。
>
> ```bash
> npm run clasp -- push -p project-a --force   # ✅ 正しく渡る
> npm run clasp push -p project-a --force      # ❌ push project-a として実行される
> ```

### 個別プロジェクトの操作

```bash
# 利用可能なプロジェクト一覧
npm run clasp -- list

# 特定プロジェクトのみ push
npm run clasp -- push -p project-a --force
npm run clasp -- push -p project-a -p project-b --force

# 特定プロジェクトのみ pull
npm run clasp -- pull -p project-a

# 未コミットの変更があるプロジェクトのみ push（-p でさらに絞り込みも可能）
npm run clasp -- push-updated --force
```

### パス指定での操作（`*-dir`）

`-p <プロジェクト名>` はディレクトリ名の一致で絞り込むため、階層が深くなると同名プロジェクトを
区別できない。`*-dir` 系は `projects/` からの**相対パス**で対象を解決するため、プロジェクト単体でも
カテゴリ単位でもまとめて指定できる。

```bash
# プロジェクト単体
npm run push-dir -- project-a
npm run pull-dir -- project-a

# カテゴリを指定すると、その配下の全プロジェクトが対象になる
npm run push-dir -- corporate-it
```

指定したパス自身が `.clasp.json` を持つ場合はそれ単体が対象になり、持たない場合は配下を探索して
見つかった `.clasp.json` をすべて対象にする。

### GAS エディタ / Web App をブラウザで開く

```bash
npm run open-dir -- project-a            # Apps Script エディタ（既定）
npm run open-dir -- project-a --script   # 同上（明示指定）
npm run open-dir -- project-a --webapp   # デプロイ済み Web App
```

`--webapp` は開くデプロイを対話的に選択するため、**ターミナル（TTY）から実行する必要がある**。
パイプ経由など TTY でない場合、`--script` は URL の出力にフォールバックし、`--webapp` はエラーになる。

コンテナ（バインド元のスプレッドシート等）を開く `open-container` は `.clasp.json` の `parentId` を
必要とするが、`clasp clone` は `parentId` を書き込まないため未対応。

### ローカルテスト

`SpreadsheetApp` 等の GAS グローバルに依存しない純粋関数（文字列整形・フィルタリング等）は、
`node:vm` で GAS ファイルを読み込みモックを注入することでローカルにテストできる。
`projects/project-a/code.test.js` をサンプルとして参照すること。

```bash
npm test
```

テストファイル（`*.test.js`）は各プロジェクトの `.claspignore` に `**/*.test.js` を記載することで
GAS への push 対象から除外している。

### 並列実行オプション

```bash
# 並列数を指定（デフォルト: 3）
PARALLEL_JOBS=5 npm run push-all

# 直接スクリプトを実行
node scripts/clasp-runner.js push --jobs 5 --force
node scripts/clasp-runner.js push-updated --jobs 5 --force
node scripts/clasp-runner.js pull --jobs 2
```

## Git フック

`npm install`（`prepare` スクリプト）で `simple-git-hooks` により以下が自動設定される。

| フック     | 内容                                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| pre-commit | staged ファイルに ESLint / Prettier（`lint-staged`）、[secretlint](https://github.com/secretlint/secretlint) によるシークレット検出を実行 |
| commit-msg | [commitlint](https://commitlint.js.org/)（`@commitlint/config-conventional`）でコミットメッセージを検証                                   |

コミットメッセージは `feat: `, `fix: `, `docs: ` 等の [Conventional Commits](https://www.conventionalcommits.org/) 形式に従うこと。
検出ルールは `.secretlintrc.json`、コミットメッセージ規約は `commitlint.config.js` を参照。

## GitHub Actions

| ワークフロー | ファイル             | 説明                                                                    |
| ------------ | -------------------- | ----------------------------------------------------------------------- |
| CI           | `ci.yml`             | push/PR 時に Lint（チェックのみ）・Format（チェックのみ）・テストを実行 |
| Deploy       | `projects_push.yaml` | 全プロジェクトを GAS に push（手動実行）                                |
| Pull         | `projects_pull.yaml` | GAS から pull して PR 作成（手動実行）                                  |

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

| 問題                  | 解決方法                                                 |
| --------------------- | -------------------------------------------------------- |
| clasp login が失敗    | `clasp login --no-localhost` を試す                      |
| push/pull でエラー    | `clasp login` で再認証、`.clasp.json` の scriptId を確認 |
| GitHub Actions が失敗 | Secrets の設定を確認、トークン期限切れなら再取得         |

## 参考

- [clasp 公式ドキュメント](https://developers.google.com/apps-script/guides/clasp)
- [clasp を使って GAS 開発環境を構築 | DevelopersIO](https://dev.classmethod.jp/articles/vscode-clasp-setting/)
