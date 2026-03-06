# vizdbt

dbt のデータリネージュをブラウザで可視化する CLI ツール。`vizdbt` コマンド一発でローカルブラウザにモデル DAG やカラムレベルリネージュを表示します。

## 特徴

- **ワンコマンド起動** - `vizdbt` だけでサーバー起動 + ブラウザオープン
- **カラムレベルリネージュ** - カラム間の依存関係を可視化（Phase 2）
- **単一バイナリ配布** - `bun build --compile` による単一バイナリ。Python/Node.js 環境不要
- **dbt 対応範囲** - model, source, seed, snapshot のリソースタイプに対応
- **対応 SQL ダイアレクト** - BigQuery, DuckDB

## クイックスタート

### インストール

```bash
# GitHub Releases からバイナリをダウンロード
curl -fsSL https://github.com/<owner>/vizdbt/releases/latest/download/vizdbt-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m) -o vizdbt
chmod +x vizdbt
sudo mv vizdbt /usr/local/bin/
```

### 使い方

```bash
# dbt プロジェクトのルートで実行（target/manifest.json を自動検出）
vizdbt

# manifest パスを指定
vizdbt --manifest path/to/manifest.json

# 特定モデルを中心に表示
vizdbt --select +stg_customers+
```

## CLI Options

| オプション | デフォルト | 説明 |
|-----------|----------|------|
| `--manifest <path>` | `target/manifest.json` | manifest.json のパス |
| `--port <number>` | `3456` | サーバーポート |
| `--select <selector>` | 全モデル | 表示するモデルの絞り込み（dbt selector 構文） |
| `--no-open` | - | ブラウザを自動で開かない |
| `--help` | - | ヘルプ表示 |
| `--version` | - | バージョン表示 |

## 開発

### 前提条件

- [Bun](https://bun.sh/) v1.2+

### セットアップ

```bash
bun install
cd ui && bun install
```

### コマンド

```bash
# バックエンド開発サーバー（ホットリロード）
bun run --watch src/index.ts -- --manifest path/to/manifest.json

# フロントエンド開発サーバー（Vite）
cd ui && bun run dev

# テスト
bun test

# 本番ビルド（単一バイナリ生成）
bun run build.ts

# 型チェック
bunx tsc --noEmit
```

## アーキテクチャ

```
┌─────────────────────────────────────────┐
│           vizdbt (単一バイナリ)            │
│                                           │
│  CLI (commander)                          │
│    ↓                                      │
│  Core Engine                              │
│    - ManifestParser (manifest.json解析)    │
│    - GraphBuilder (DAG構築)               │
│    ↓                                      │
│  HTTP Server (Bun.serve)                  │
│    - REST API (/api/*)                    │
│    - 静的ファイル配信 (embeddedFiles)      │
└─────────────┬─────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Browser UI                               │
│    React + React Flow + ELK.js            │
└─────────────────────────────────────────┘
```

## ロードマップ

| Phase | 内容 | 状態 |
|-------|------|------|
| Phase 1 | MVP: モデル DAG 表示 + CLI | 完了 |
| Phase 2 | カラムレベルリネージュ + 単一バイナリ配布 | 計画中 |
| Phase 3 | フィルタリング・検索・モデル詳細パネル・Fusion LSP 統合 | 計画中 |
| Phase 4 | パフォーマンス最適化（実測ベース） | 計画中 |

## ライセンス

MIT
