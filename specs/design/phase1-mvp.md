# Phase 1: MVP 設計書

## 1. ゴール

manifest.jsonを読み込み、モデルDAGをブラウザで表示する。`vizdbt`コマンド一発で起動。

```
vizdbt → manifest読み込み → HTTPサーバー起動 → ブラウザオープン → DAG表示
```

---

## 2. プロジェクト構造

```
vizdbt/
├── package.json
├── tsconfig.json
├── bunfig.toml
├── build.ts                          # ビルドスクリプト
│
├── src/
│   ├── index.ts                      # エントリポイント（CLI）
│   ├── cli.ts                        # CLI引数パース
│   ├── server.ts                     # Bun HTTPサーバー
│   │
│   ├── core/
│   │   ├── types.ts                  # 共有型定義（DbtProject含む）
│   │   ├── manifest-parser.ts        # manifest.jsonパーサー
│   │   └── graph-builder.ts          # DAGグラフ構築
│   │
│   └── api/
│       ├── router.ts                 # URLパースによるルーティング
│       └── handlers.ts              # APIハンドラ
│
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   │
│   └── src/
│       ├── main.tsx                  # Reactエントリポイント
│       ├── App.tsx                   # ルートコンポーネント
│       ├── types.ts                  # フロントエンド型定義
│       │
│       ├── api/
│       │   └── client.ts            # APIクライアント
│       │
│       ├── components/
│       │   ├── DagGraph.tsx          # React Flowグラフ
│       │   └── nodes/
│       │       └── ModelNode.tsx     # カスタムモデルノード
│       │
│       └── lib/
│           └── elk-layout.ts        # ELK.jsレイアウト計算
│
└── specs/                            # 既存ドキュメント
```

---

## 3. 型定義

### 3.1 共有型（バックエンド・フロントエンド共通）

```typescript
// src/core/types.ts

/** リソースタイプ（DAGに表示するもの） */
type DbtResourceType = "model" | "source" | "seed" | "snapshot";

/** マテリアライゼーション */
type DbtMaterialization = "view" | "table" | "incremental" | "ephemeral";

/** モデル情報（API応答用） */
interface DbtModelInfo {
  uniqueId: string;
  name: string;
  resourceType: DbtResourceType;
  materialization: DbtMaterialization | null;
  database: string | null;
  schema: string;
  description: string;
  tags: string[];
  dependsOn: string[];       // unique_id[]
  columns: DbtColumnInfo[];
  compiledCode: string | null;
}

/** カラム情報 */
interface DbtColumnInfo {
  name: string;
  dataType: string | null;
  description: string;
}

/** DAGノード（グラフ表示用） */
interface DagNode {
  id: string;                // unique_id
  name: string;
  resourceType: DbtResourceType;
  materialization: DbtMaterialization | null;
}

/** DAGエッジ（グラフ表示用） */
interface DagEdge {
  source: string;            // unique_id
  target: string;            // unique_id
}

/** モデルDAG応答 */
interface ModelLineageResponse {
  nodes: DagNode[];
  edges: DagEdge[];
}

/** プロジェクト全体のデータ */
interface DbtProject {
  metadata: {
    dbtVersion: string;
    projectName: string;
    adapterType: string | null;
  };
  models: Map<string, DbtModelInfo>;    // unique_id → モデル情報
  dag: { nodes: DagNode[]; edges: DagEdge[] };
}
```

**Note**: `exposure` はPhase 1では対象外。manifestの `exposures` フィールドからの読み込みはPhase 3で対応する。

### 3.2 manifest.jsonの読み込み型

```typescript
// src/core/manifest-parser.ts

/** manifest.jsonのトップレベル */
interface RawManifest {
  metadata: {
    dbt_schema_version: string;
    dbt_version: string;
    project_name: string | null;
    adapter_type: string | null;
  };
  nodes: Record<string, RawNode>;
  sources: Record<string, RawSource>;
  parent_map: Record<string, string[]>;
  child_map: Record<string, string[]>;
  // exposures: Phase 3で追加
}

/** manifest nodes内のモデル（seed, snapshotも同じ構造） */
interface RawNode {
  unique_id: string;
  name: string;
  resource_type: string;
  depends_on: { nodes: string[]; macros: string[] };
  config: { materialized?: string; enabled?: boolean; tags?: string[] };
  database: string | null;
  schema: string;
  description: string;
  tags: string[];
  columns: Record<string, { name: string; data_type: string | null; description: string }>;
  compiled_code?: string;   // v7+（v7未満はサポート対象外）
}

/** manifest sources */
interface RawSource {
  unique_id: string;
  name: string;
  source_name: string;
  resource_type: "source";
  database: string | null;
  schema: string;
  description: string;
  columns: Record<string, { name: string; data_type: string | null; description: string }>;
}
```

---

## 4. バックエンド設計

### 4.1 CLI（src/cli.ts）

```
vizdbt [options]

Options:
  --manifest <path>    manifest.jsonのパス（デフォルト: target/manifest.json）
  --port <number>      サーバーポート（デフォルト: 3456）
  --no-open            ブラウザを自動で開かない
  --select <selector>  表示するモデルの絞り込み（dbt selector構文準拠）
  --help               ヘルプ表示
  --version            バージョン表示
```

処理フロー:
1. CLI引数パース（commander）
2. manifest.jsonの存在チェック・読み込み
3. ManifestParserでパース → DbtProjectデータ構築
4. Bun HTTPサーバー起動
5. ブラウザ自動オープン（`Bun.spawn(["open", url])`、Linuxは`xdg-open`）

### 4.2 エラーハンドリング

| エラーケース | 対応 |
|-------------|------|
| manifest.jsonが見つからない | エラーメッセージ + `dbt compile` / `dbt parse` の実行を促す |
| JSONパースエラー | エラーメッセージ + ファイルパス表示 |
| manifest schemaがv7未満 | エラーメッセージ（dbt 1.3以上が必要）で終了 |
| ポートが使用中 | エラーメッセージ + `--port`オプションを案内 |

CLI終了コード: 正常=0、manifest未発見=1、パースエラー=2

### 4.3 ManifestParser（src/core/manifest-parser.ts）

manifest.jsonを読み込み、vizdbtの内部型に変換する。

処理:
1. `Bun.file(path).json()` でmanifest.jsonを読み込み
2. `metadata.dbt_schema_version` からスキーマバージョンを確認（v7未満はエラー終了）
3. `nodes` をイテレートし、`resource_type` が model/seed/snapshot のものを抽出
4. `sources` をイテレートし、sourceノードを抽出
5. `compiled_code` フィールドからコンパイル済みSQLを取得
6. `parent_map` からエッジを構築（DAGに含まれるノード間のみ）
7. `config.enabled === false` のノードは除外

**DAGエッジ構築のデータソース**: `parent_map` を使用する。`depends_on.nodes` でも構築可能だが、`parent_map` はmanifest側で正規化済みであり、テストノード等を含まないためDAG構築に適している。

### 4.4 GraphBuilder（src/core/graph-builder.ts）

DAGのフィルタリング・サブグラフ抽出を行う。

```
buildFullDag(project: DbtProject): ModelLineageResponse
  → 全ノード・全エッジを返す

buildFilteredDag(project: DbtProject, selector: string, depth?: number): ModelLineageResponse
  → 指定モデルを中心にupstream/downstreamをdepth分たどったサブグラフを返す
  → selectorはdbt selector構文準拠
  → Phase 1対応: モデル名、+model_name+（upstream/downstream）
  → Phase 3で拡張: tag:xxx、source:xxx、path:xxx 等
```

### 4.5 APIハンドラ（src/api/）

`fetch`ハンドラ内でURLパースによるルーティングを行う。`Bun.serve()`の`routes`オプションは動的パスパラメータ（`:id`）の対応が不確実なため、`URL`オブジェクトによるパスマッチングで実装する。

| エンドポイント | メソッド | 応答 | Phase 1 UI |
|---------------|---------|------|-----------|
| `/api/models` | GET | `DbtModelInfo[]` モデル一覧 | 未使用（API提供のみ） |
| `/api/models/:id` | GET | `DbtModelInfo` モデル詳細 | 未使用（API提供のみ） |
| `/api/lineage/model` | GET | `ModelLineageResponse` モデルDAG | DagGraph描画に使用 |
| `/*` | GET | フロントエンド静的ファイル | — |

**Note**: `/api/models`、`/api/models/:id` はPhase 1ではAPIのみ提供し、フロントエンドのUIは未実装。Phase 3のモデル詳細パネルで使用する。

クエリパラメータ:
- `/api/lineage/model?select=<selector>&depth=<n>`
- `select`省略時は全モデル
- selector例: `stg_customers`, `+stg_customers+`, `+stg_customers`

### 4.6 HTTPサーバー（src/server.ts）

```typescript
// 概略
Bun.serve({
  port: options.port,
  fetch(req) {
    const url = new URL(req.url);

    // API ルーティング
    if (url.pathname === "/api/lineage/model") return handleLineage(url, project);
    if (url.pathname === "/api/models") return handleModels(project);
    if (url.pathname.startsWith("/api/models/")) return handleModel(url, project);

    // 静的ファイル配信
    return serveStaticFile(url.pathname);
  },
});
```

開発時: `frontend/dist/` から配信
本番時: `Bun.embeddedFiles` から配信（`bun build --compile`後）

---

## 5. フロントエンド設計

### 5.1 コンポーネント構成

```
App
├── ヘッダー（プロジェクト名、モデル数表示）
└── DagGraph
    └── ReactFlow
        ├── ModelNode（カスタムノード） × N
        ├── Edge × M
        ├── MiniMap
        └── Controls（ズーム、フィット）
```

状態管理: `useState` / `useCallback` のみ。外部状態管理ライブラリは導入しない。

### 5.2 DagGraph（components/DagGraph.tsx）

React Flow Controlled方式で実装。

起動時の処理フロー:
1. `/api/lineage/model` からDAGデータ取得
2. DagNode[] → React Flow Node[] に変換（position: {x:0, y:0} で仮配置）
3. DagEdge[] → React Flow Edge[] に変換
4. ELK.jsで非同期レイアウト計算
5. 計算結果のpositionをノードに適用
6. `fitView` で全体表示

### 5.3 ModelNode（components/nodes/ModelNode.tsx）

カスタムノードの表示内容:

```
┌─────────────────────┐
│ 📊 stg_customers    │  ← アイコン + モデル名
│ model · view        │  ← リソースタイプ · materialization
└─────────────────────┘
   ●                ●     ← target Handle（左）, source Handle（右）
```

ノードタイプ別の色分け:
| リソースタイプ | 色 |
|--------------|-----|
| model | 青 |
| source | 緑 |
| seed | オレンジ |
| snapshot | 紫 |

### 5.4 ELK.jsレイアウト（lib/elk-layout.ts）

React非依存の純粋関数として実装。

```typescript
async function calculateLayout(
  nodes: Node[],
  edges: Edge[]
): Promise<Node[]>
```

ELK.jsオプション:
```
algorithm: 'layered'
direction: 'RIGHT'          // 左→右（dbtリネージュの標準方向）
spacing.nodeNode: 50        // ノード間の縦スペース
layered.spacing.nodeNodeBetweenLayers: 100  // レイヤー間の横スペース
```

Phase 2でカラムリネージュ追加時:
- ノードにELK.jsの`ports`を追加
- `portConstraints: 'FIXED_ORDER'` で各カラムのポート位置を固定
- `elkjs-multiple-handles`パターンをそのまま適用

### 5.5 APIクライアント（api/client.ts）

```typescript
const API_BASE = "";  // 同一オリジン

async function fetchLineage(select?: string, depth?: number): Promise<ModelLineageResponse>
async function fetchModels(): Promise<DbtModelInfo[]>
async function fetchModel(id: string): Promise<DbtModelInfo>
```

---

## 6. ビルド・配布

### 6.1 開発時

```bash
# バックエンド（ホットリロード）
bun run --watch src/index.ts -- --manifest path/to/manifest.json

# フロントエンド（Vite devサーバー）
cd frontend && bun run dev
```

開発時はVite devサーバー（ポート5173）→バックエンド（ポート3456）にプロキシ。

```typescript
// frontend/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:3456",
    },
  },
});
```

### 6.2 本番ビルド

```bash
# 1. フロントエンドビルド
cd frontend && bun run build    # → frontend/dist/

# 2. 単一バイナリ生成
bun build --compile --minify --bytecode src/index.ts --outfile vizdbt
```

ビルドスクリプト（`build.ts`）で以下を自動化:
1. `frontend/dist/` のビルド
2. dist内ファイルのimport文を自動生成（`src/generated/static-files.ts`）
3. `bun build --compile` 実行

### 6.3 静的ファイル埋め込み

```typescript
// src/server.ts（本番時）
import indexHtml from "../frontend/dist/index.html" with { type: "file" };
import appJs from "../frontend/dist/assets/index.js" with { type: "file" };
import appCss from "../frontend/dist/assets/index.css" with { type: "file" };

// Bun.embeddedFilesでルーティング
for (const file of Bun.embeddedFiles) {
  // ファイル名からパスを構築して静的ルートに登録
}
```

### 6.4 クロスプラットフォーム

```bash
bun build --compile --target=bun-darwin-arm64 src/index.ts --outfile vizdbt-macos-arm64
bun build --compile --target=bun-linux-x64 src/index.ts --outfile vizdbt-linux-x64
```

---

## 7. 依存パッケージ

### バックエンド（ルート package.json）

| パッケージ | 用途 |
|-----------|------|
| `commander` | CLI引数パース |
| `typescript` | 型チェック |

### フロントエンド（frontend/package.json）

| パッケージ | 用途 |
|-----------|------|
| `react` | UIライブラリ |
| `react-dom` | React DOM |
| `@xyflow/react` | グラフ描画 |
| `elkjs` | 自動レイアウト |
| `typescript` | 型チェック |
| `vite` | ビルドツール |
| `@vitejs/plugin-react` | Vite Reactプラグイン |

---

## 8. テスト方針

MVP段階での最低限のテスト。テストランナーは `bun test`（Bun組み込み）を使用。

| 対象 | テスト種別 | 内容 |
|------|----------|------|
| ManifestParser | 統合テスト | サンプルmanifest.json（v7, v12）を使ったパース検証 |
| GraphBuilder | ユニットテスト | サブグラフ抽出、depth制限、部分一致フィルタリング |
| APIハンドラ | 統合テスト | 各エンドポイントのレスポンス検証 |

テストデータ: `tests/fixtures/` にmanifest.jsonのサンプルを配置。

---

## 9. 設計判断メモ

### manifest.json再読み込み
Phase 1ではサーバー再起動で対応。ファイル監視による自動リロードは対応しない。

### カラム型情報の優先順位（Phase 2以降）
manifest.jsonの`columns`を優先。catalog.jsonは補完情報として利用（manifestに型情報がないカラムのみcatalogから取得）。

### v7未満のmanifest
サポート対象外（v7〜v12のみ）。v7未満を検出した場合はエラーメッセージを出して終了する。`compiled_sql`フォールバックは行わない。

### 大規模プロジェクト対応
500モデル超のReact Flow + ELK.jsレンダリングについては、Phase 1リリース後に実測してボトルネックを特定する。必要に応じてWeb Workerでのレイアウト計算を検討する（ADR-003の方針に従う）。

---

## 10. Phase 2への拡張ポイント

Phase 1の設計で、Phase 2（カラムリネージュ）への拡張を意識した箇所:

| 箇所 | Phase 1 | Phase 2拡張 |
|------|---------|------------|
| ModelNode | モデル名+タイプのみ表示 | カラム一覧 + 各カラムにHandle追加 |
| ELK.jsオプション | ノード単位のレイアウト | `ports`追加でポートベースレイアウト |
| API | `/api/lineage/model` のみ | `/api/lineage/column` 追加 |
| 型定義 | DagNode/DagEdge | ColumnLineageResult追加 |
| ManifestParser | DAG構築のみ | catalog.json読み込み + スキーマ情報抽出 |
| LineageQueryService | なし（DAGのみ） | インターフェース導入 + ArtifactsAdapter |
| 状態管理 | useState/useCallback | 複雑化すればuseReducer検討 |
