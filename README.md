# GAS Clasp Projects Template

## 目的

GAS でスクリプトを作成するにあたり複数のプロジェクトを並行して開発したい場合に都度設定していた内容をすぐに使い始めれるようにテンプレート化し開発の効率化を図る

## ディレクトリ構成

```
gas_clasp_projects_template/
├── projects/
│   ├── project-a/
│   │   ├── .clasp.json      # プロジェクト固有のclasp設定
│   │   ├── appsscript.json  # GASマニフェストファイル
│   │   └── code.js          # GASコード
│   └── project-b/
│       └── ...
├── scripts/
│   └── clasp-runner.js      # 並列実行スクリプト
├── .github/
│   ├── actions/             # カスタムGitHub Actions
│   └── workflows/           # CI/CDワークフロー
└── package.json
```

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
| `yarn push` | 全プロジェクトを GAS に push（並列実行） |
| `yarn pull-all` | 全プロジェクトを GAS から pull（並列実行） |
| `clasp open --project ./projects/project-a` | GAS エディタを開く |

### 並列実行オプション

```bash
# 並列数を指定（デフォルト: 3）
PARALLEL_JOBS=5 yarn push-all

# 直接スクリプトを実行
node scripts/clasp-runner.js push --jobs 5
node scripts/clasp-runner.js pull --jobs 2
```

## GitHub Actions

| ワークフロー | ファイル | 説明 |
|-------------|----------|------|
| CI | `ci.yml` | push/PR 時に Lint と Format を実行 |
| Deploy | `projects_push.yaml` | 全プロジェクトを GAS に push（手動実行） |
| Pull | `projects_pull.yaml` | GAS から pull して PR 作成（手動実行） |

### 実行方法

1. GitHub の **Actions** タブを開く
2. ワークフローを選択 → **Run workflow**

## GitHub Secrets 設定

GitHub Actions で clasp を実行するには、以下のシークレットを設定してください。

### シークレットの取得方法

1. `clasp login` を実行
2. `~/.clasprc.json` から以下の値を取得

```json
{
  "token": {
    "access_token": "→ ACCESS_TOKEN",
    "refresh_token": "→ REFRESH_TOKEN",
    "id_token": "→ ID_TOKEN"
  },
  "oauth2ClientSettings": {
    "clientId": "→ CLIENT_ID",
    "clientSecret": "→ CLIENT_SECRET"
  }
}
```

### 設定手順

**Settings** > **Secrets and variables** > **Actions** > **New repository secret** で上記5つを追加

## トラブルシューティング

| 問題 | 解決方法 |
|------|----------|
| clasp login が失敗 | `clasp login --no-localhost` を試す |
| push/pull でエラー | `clasp login` で再認証、`.clasp.json` の scriptId を確認 |
| GitHub Actions が失敗 | Secrets の設定を確認、トークン期限切れなら再取得 |

## 参考

- [clasp 公式ドキュメント](https://developers.google.com/apps-script/guides/clasp)
- [clasp を使って GAS 開発環境を構築 | DevelopersIO](https://dev.classmethod.jp/articles/vscode-clasp-setting/)
