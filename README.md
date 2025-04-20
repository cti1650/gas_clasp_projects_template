# GAS Clasp Projects Template

## 目的

GAS でスクリプトを作成するにあたり複数のプロジェクトを並行して開発したい場合に都度設定していた内容をすぐに使い始めれるようにテンプレート化し開発の効率化を図る

## 開発方法

詳細は[Document](https://developers.google.com/apps-script/guides/clasp)を参照

[clasp を使って Google Apps Script の開発環境を構築してみた | DevelopersIO](https://dev.classmethod.jp/articles/vscode-clasp-setting/)  
[GAS を git 管理したいので、Clasp 環境を作る](https://zenn.dev/marusho/scraps/3579309aabf5eb)

### ログイン

```
clasp login
```

### 既存スクリプトを clone する

```
clasp clone {scriptId} --rootDir ./projects/project-c
```

### GAS を開く

```
clasp open --project ./projects/project-a
```

### スクリプトを push する

GitHub Actions で一括で Push するか以下のコマンドで個別 Push 可能

```
cd ./projects/project-a && clasp push && cd ../..
```

### スクリプトを pull する

GitHub Actions で一括で Pull するか以下のコマンドで個別 Pull 可能

```
cd ./projects/project-a && clasp pull && cd ../..
```

### 状況確認

#### バージョン一覧

```
clasp versions
```

#### デプロイ一覧

```
clasp deployments
```

### 更新処理

#### 新規バージョン発行

```
clasp version "new version"
```
