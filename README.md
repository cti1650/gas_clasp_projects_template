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
│       ├── .clasp.json
│       ├── appsscript.json
│       └── code.js
├── .github/
│   ├── actions/             # カスタムGitHub Actions
│   └── workflows/           # CI/CDワークフロー
├── push-all.sh              # 全プロジェクト一括push
├── pull-all.sh              # 全プロジェクト一括pull
├── push-updated.sh          # 変更があったプロジェクトのみpush
└── package.json
```

## 開発方法

詳細は[Document](https://developers.google.com/apps-script/guides/clasp)を参照

- [clasp を使って Google Apps Script の開発環境を構築してみた | DevelopersIO](https://dev.classmethod.jp/articles/vscode-clasp-setting/)
- [GAS を git 管理したいので、Clasp 環境を作る](https://zenn.dev/marusho/scraps/3579309aabf5eb)

### 初期設定

```bash
yarn install
```

clasp をインストールしていない場合は clasp のインストールが必要

```bash
npm install -g @google/clasp
```

### ログイン

```bash
clasp login
```

## 新規プロジェクトの追加

### 方法1: 既存のGASスクリプトをcloneする

```bash
# scriptIdはGASエディタのURLから取得
# https://script.google.com/home/projects/{scriptId}/edit
clasp clone {scriptId} --rootDir ./projects/project-name
```

### 方法2: 新規GASプロジェクトを作成する

```bash
mkdir -p ./projects/project-name
cd ./projects/project-name
clasp create --title "Project Name" --rootDir .
```

### 方法3: 手動で設定ファイルを作成する

1. プロジェクトディレクトリを作成

```bash
mkdir -p ./projects/project-name
```

2. `.clasp.json` を作成

```json
{
  "scriptId": "your_script_id",
  "rootDir": "."
}
```

3. `appsscript.json` を作成

```json
{
  "timeZone": "Asia/Tokyo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

4. コードファイルを作成

```bash
touch ./projects/project-name/code.js
```

## コマンド一覧

### GAS を開く

```bash
clasp open --project ./projects/project-a
```

### スクリプトを push する

一括で Push する (GitHub Actions でも実行可能)

```bash
yarn push-all
```

変更があったプロジェクトのみ Push する

```bash
yarn push
```

以下のコマンドで個別 Push 可能

```bash
cd ./projects/project-a && clasp push && cd ../..
```

### スクリプトを pull する

一括で Pull する (GitHub Actions でも実行可能)

```bash
yarn pull-all
```

以下のコマンドで個別 Pull 可能

```bash
cd ./projects/project-a && clasp pull && cd ../..
```

### 状況確認

#### バージョン一覧

```bash
clasp versions
```

#### デプロイ一覧

```bash
clasp deployments
```

### 更新処理

#### 新規バージョン発行

```bash
clasp version "new version"
```

## GitHub Secrets 設定

GitHub Actions で clasp push/pull を実行するには、以下のシークレットを設定してください。

### シークレットの取得方法

1. ローカルで `clasp login` を実行
2. `~/.clasprc.json` を開き、以下の値を取得

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

### 必要なシークレット一覧

| シークレット名   | 説明                       |
| ---------------- | -------------------------- |
| ACCESS_TOKEN     | OAuth アクセストークン     |
| REFRESH_TOKEN    | OAuth リフレッシュトークン |
| ID_TOKEN         | OAuth ID トークン          |
| CLIENT_ID        | OAuth クライアント ID      |
| CLIENT_SECRET    | OAuth クライアントシークレット |

### シークレットの設定手順

1. GitHub リポジトリの **Settings** > **Secrets and variables** > **Actions** を開く
2. **New repository secret** をクリック
3. 上記の各シークレットを追加

## トラブルシューティング

### clasp login が失敗する場合

```bash
# サーバーレス環境（SSHなど）の場合
clasp login --no-localhost
```

### push/pull でエラーが発生する場合

1. `clasp login` で再認証
2. `.clasp.json` の `scriptId` が正しいか確認
3. GAS側でスクリプトが存在するか確認

### GitHub Actions が失敗する場合

1. GitHub Secrets が正しく設定されているか確認
2. トークンが期限切れの場合は `clasp login` で再取得
3. Actions のログでエラー詳細を確認
