# vizdbt 要件定義

## 1. プロジェクト概要

### 1.1 背景・課題
- CLIベース（claude code等）でのdbt開発スタイルが増加している
- VSCode拡張機能（特にdbt Power User）が提供するデータリネージュ機能はCLIベースでは利用できない
- 特にカラムレベルのデータリネージュはdbt開発において重要だが、ターミナル環境では代替手段がない

### 1.2 目的
- VSCode dbt拡張機能の主要機能（特にカラムレベルリネージュ）をCLI/ターミナル環境でも利用可能にする
- `vizdbt` コマンド一発でローカルブラウザにリネージュUIを表示する

### 1.3 スコープ
- カラムレベルリネージュの可視化
- モデルレベルDAG
- ブラウザUI

---

## 2. 機能要件

### 2.1 コア機能: カラムレベルリネージュ

#### F-001: カラムリネージュ解析
- dbt artifacts（manifest.json + catalog.json）からカラムレベルの依存関係を解析する
- **デフォルト**: @polyglot-sql/sdk（Rust→Wasm）でcompiled_codeをパースし、各カラムのソースを特定
- **高精度モード（オプション）**: dbt Fusion LSP経由で`get_column_lineage`を実行（Fusionバイナリ検出時に自動使用）
- 対応SQLダイアレクト: BigQuery, DuckDB

#### F-002: カラムリネージュ可視化
- モデルをノード、カラム間の依存をエッジとしてグラフ表示
- カラムクリックで上流・下流をハイライト表示
- Select Link（直接参照）とNon-Select Link（WHERE/JOIN等での参照）を区別表示

#### F-003: リネージュのフィルタリング
- 特定モデルを中心としたリネージュ表示（upstream/downstream指定可能）
- depth制限（例: 上流2ホップまで）
- dbt selector構文のサポート（`+model_name+`, `tag:xxx` 等）

### 2.2 モデルレベルDAG

#### F-004: モデルDAG表示
- manifest.jsonのparent_map/child_mapからモデル間のDAGを構築・表示
- ノードタイプ（model, source, seed, snapshot, exposure）を色分け表示
- materialization（table, view, incremental, ephemeral）を表示

### 2.3 モデル情報パネル

#### F-005: モデル詳細表示
- モデルクリック時にサイドパネルで詳細情報を表示:
  - カラム一覧（名前、型、description）
  - テスト一覧
  - SQLコード（compiled_code）
  - 依存モデル一覧

### 2.4 CLI

#### F-006: vizdbtコマンド
- `vizdbt` で現在のdbtプロジェクトのリネージュUIをブラウザで起動
- `vizdbt --select model_name` で特定モデルのリネージュを表示
- `vizdbt --port 8080` でポート指定
- `vizdbt --manifest path/to/manifest.json` でmanifestパスを指定

---

## 3. 非機能要件

### 3.1 パフォーマンス
- 100モデル規模のプロジェクトで起動3秒以内
- 500モデル規模でも10秒以内
- ブラウザUIのインタラクション（クリック、ズーム等）は即座に反応

### 3.2 互換性
- dbt-core 1.3以上に対応（manifest schema v7〜v12）
- macOS / Linux対応

### 3.3 インストール・運用
- 単一バイナリとして配布

---

## 4. 技術アーキテクチャ

### 4.1 全体構成

```
┌──────────────────────────────────────────────────┐
│ vizdbt (単一バイナリ: bun build --compile)        │
│                                                    │
│  ┌───────────────────────────────────────────────┐│
│  │ CLI (TypeScript / commander)                   ││
│  └───────────────────────────────────────────────┘│
│                      │                             │
│  ┌───────────────────────────────────────────────┐│
│  │ Core Engine (TypeScript)                       ││
│  │  - manifest.json / catalog.json パーサー       ││
│  │  - LineageQueryService インターフェース         ││
│  │    ├── FusionAdapter (Fusion LSP, 高精度)      ││
│  │    └── ArtifactsAdapter (フォールバック)        ││
│  │        └── @polyglot-sql/sdk (Rust→Wasm)       ││
│  └───────────────────────────────────────────────┘│
│                      │                             │
│  ┌───────────────────────────────────────────────┐│
│  │ Web Server (Bun)                                ││
│  │  - REST API (JSON)                             ││
│  │  - フロントエンド静的ファイル配信（埋込済み）   ││
│  └───────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│ Browser UI                                        │
│  - React + TypeScript                             │
│  - React Flow + ELK.js (DAG/リネージュ描画)      │
│  - Vite (ビルドツール)                            │
└──────────────────────────────────────────────────┘
```

### 4.2 技術スタック

| レイヤー | 技術 |
|---------|------|
| ランタイム | Bun |
| CLI | TypeScript + commander |
| SQLパース（デフォルト） | @polyglot-sql/sdk（Rust→Wasm） |
| SQLパース（高精度） | dbt Fusion LSP（オプション） |
| Webサーバー | Bun |
| フロントエンド | React + TypeScript |
| DAG描画 | React Flow + ELK.js |
| フロントエンドビルド | Vite |
| 配布 | bun build --compile（単一バイナリ） |

### 4.3 LineageQueryService

```typescript
interface LineageQueryService {
  getColumnLineage(modelId: string, columnName: string, depth?: number): Promise<ColumnLineageResult>;
  getModelLineage(selector: string, depth?: number): Promise<ModelLineageResult>;
}
```

- **FusionAdapter**: dbt Fusion LSP経由。高精度。Fusionバイナリ検出時に自動使用
- **ArtifactsAdapter**: @polyglot-sql/sdkによるartifacts解析。フォールバック

### 4.4 データフロー

```
1. ユーザーが `vizdbt` を実行
2. manifest.json / catalog.json を読み込み
3. dbt Fusion バイナリの検出を試行
4. カラムレベルリネージュを解析:
   a. Fusion検出 → LSP経由で get_column_lineage（高精度）
   b. Fusion未検出 → @polyglot-sql/sdk でcompiled_codeをパース
5. Bun HTTPサーバーを起動（埋込済みフロントエンドを配信）
6. ブラウザを自動オープン
7. フロントエンドがAPIからリネージュデータを取得して描画
```

---

## 5. API設計

### GET /api/models
モデル一覧を返す

### GET /api/models/{model_id}
モデルの詳細情報（カラム、テスト、SQL等）を返す

### GET /api/lineage/model?select={selector}&depth={n}
モデルレベルのリネージュグラフを返す

### GET /api/lineage/column?model={model_id}&column={column_name}&depth={n}
カラムレベルのリネージュグラフを返す

---

## 6. フェーズ分け

### Phase 1: MVP
- manifest.json読み込み + モデルDAG表示
- ブラウザUI（React Flow + ELK.js）
- `vizdbt` コマンドでサーバー起動 + ブラウザオープン
- 単一バイナリ配布

### Phase 2: カラムリネージュ
- catalog.json読み込み
- ArtifactsAdapter実装（@polyglot-sql/sdk）
- カラムリネージュの可視化UI

### Phase 3: 強化 + Fusion統合
- フィルタリング・検索機能
- モデル詳細パネル
- dbt selector構文サポート
- FusionAdapter実装

### Phase 4: パフォーマンス最適化
- 実測データに基づくボトルネック特定
- 必要箇所のRust/Wasmモジュール化

---

## 7. 先行事例との差別化

| ツール | 差別化ポイント |
|--------|--------------|
| dbt docs serve | カラムレベルリネージュなし。vizdbtはカラムレベル対応 |
| dbt Power User | VSCode限定。vizdbtはCLI/ターミナルから起動可能 |
| dbt Cloud Explorer | 有償。vizdbtは完全無料・ローカル実行 |
| dbt Fusion VSCode | VSCode拡張必須。vizdbtはブラウザUIで独立動作 |
| dbt-column-lineage-extractor | JSON/Mermaid出力のみ。vizdbtはインタラクティブUI |

---

## 8. 意思決定記録（ADR）

各技術選定の背景・比較・理由は以下のADRに記録:

- [ADR-001: 開発言語とランタイムの選択](./adr/001-language-and-runtime.md)
- [ADR-002: カラムリネージュエンジンの選択](./adr/002-column-lineage-engine.md)
- [ADR-003: 開発戦略（TypeScript MVP → 段階的Rust最適化）](./adr/003-development-strategy.md)
- [ADR-004: dbt manifest.json互換性方針](./adr/004-manifest-compatibility.md)
- [ADR-005: フロントエンド可視化ライブラリの選択](./adr/005-frontend-visualization.md)

---

## 9. 参考資料

### 調査ドキュメント
- [VSCode dbt拡張機能調査](./search/vscode_dbt_extensions.md)
- [既存リネージュツール調査](./search/existing_lineage_tools.md)
- [カラムリネージュ技術調査](./search/column_lineage_technical.md)
- [dbt Fusion調査](./search/dbt_fusion.md)
- [dbt Power Userカラムリネージュ実装調査](./search/dbt_power_user_column_lineage.md)
- [言語選択 技術調査](./search/language_selection.md)
- [フロントエンドフレームワーク選定](./search/frontend_framework.md)

### 外部リソース
- [React Flow](https://reactflow.dev/)
- [ELK.js](https://github.com/kieler/elkjs)
- [@polyglot-sql/sdk](https://www.npmjs.com/package/@polyglot-sql/sdk)
- [dbt Fusion](https://github.com/dbt-labs/dbt-fusion)
- [Hono](https://hono.dev/)
- [Bun](https://bun.sh/)
