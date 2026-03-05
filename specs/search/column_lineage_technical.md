# カラムレベルデータリネージュ - 技術調査

## 1. SQLパーシングによるカラムリネージュの抽出

### 1.1 sqlglot

**概要**: sqlglotはPython製の高機能SQLパーサー/トランスパイラ。20以上のSQL方言をサポートし、カラムレベルリネージュの抽出機能を内蔵している。

**lineageモジュール (`sqlglot.lineage`)**:
- `lineage()` 関数がカラムレベルリネージュの中核
- 指定したカラムのソースカラムを再帰的にたどることが可能
- CTEやサブクエリにも対応

**基本的な使い方**:
```python
import sqlglot
from sqlglot.lineage import lineage

sql = """
SELECT
    a.id,
    a.name,
    b.amount
FROM table_a a
JOIN table_b b ON a.id = b.user_id
"""

# 特定カラムのリネージュを取得
result = lineage("amount", sql)
# result.source: ソースカラムの情報
# result.expression: 対応するSQL式
```

**`lineage()` 関数のシグネチャ**:
```python
def lineage(
    column: str | sqlglot.exp.Column,
    sql: str | sqlglot.exp.Expression,
    schema: dict | sqlglot.schema.Schema | None = None,
    sources: dict | None = None,
    dialect: str | None = None,
    **kwargs,
) -> Node
```

**返り値の `Node` 構造**:
- `name`: カラム名
- `expression`: SQL式
- `source`: ソーステーブル/CTE
- `downstream`: 下流ノードのリスト（木構造）

**スキーマ情報の提供**: スキーマ情報を与えることで `SELECT *` の展開やカラム解決の精度が向上する。
```python
schema = {
    "table_a": {"id": "INT", "name": "VARCHAR"},
    "table_b": {"user_id": "INT", "amount": "DECIMAL"},
}
result = lineage("amount", sql, schema=schema)
```

**利点**:
- 依存ライブラリなし（Pure Python）
- 多数のSQL方言に対応（BigQuery, Snowflake, DuckDB, Postgres等）
- AST操作が柔軟で、式の変換・最適化も可能
- 活発にメンテナンスされている（Tobiko Data社が開発）
- dbtのSQL（Jinja展開後）にも適用可能

**制限**:
- `SELECT *` の解決にはスキーマ情報が必要
- UDF（ユーザー定義関数）内のリネージュは追跡不可
- LATERAL FLATTEN等の一部の複雑な構文への対応が方言依存

### 1.2 sqllineage

**概要**: SQLのテーブルレベル・カラムレベルのリネージュ分析に特化したPythonライブラリ。

**主な機能**:
- テーブルレベルリネージュ（ソーステーブル → ターゲットテーブル）
- カラムレベルリネージュ（ソースカラム → ターゲットカラム）
- Web UIでのリネージュ可視化（組み込みのFlaskアプリ）
- CLIツール提供

**基本的な使い方**:
```python
from sqllineage.runner import LineageRunner

sql = """
INSERT INTO target_table
SELECT a.id, a.name, b.amount
FROM source_a a
JOIN source_b b ON a.id = b.user_id
"""

runner = LineageRunner(sql)

# テーブルレベルリネージュ
print(runner.source_tables())   # {source_a, source_b}
print(runner.target_tables())   # {target_table}

# カラムレベルリネージュ
for col_lineage in runner.get_column_lineage():
    print(f"{col_lineage.src} -> {col_lineage.tgt}")
```

**利点**:
- テーブル・カラム両レベルのリネージュ分析に対応
- 組み込みの可視化Web UI
- 複数SQLステートメントの一括解析に対応

**制限**:
- SQL方言のサポートが限定的（主にANSI SQL）
- 内部パーサーに `sqlfluff` を使用（sqlglotほど多方言対応ではない）
- 複雑なCTEやサブクエリで精度が落ちる場合がある
- メンテナンス頻度がsqlglotほど高くない

### 1.3 その他のSQLパーサー/ツール

| ツール | 特徴 | カラムリネージュ |
|--------|------|-----------------|
| **sqlfluff** | SQLリンター/フォーマッター。ASTへのアクセスが可能 | 直接のリネージュ機能なし。AST解析で実装は可能 |
| **python-sqlparse** | 軽量なSQLパーサー | リネージュ機能なし。トークナイザーレベルのみ |
| **Apache Calcite** | Java製SQL解析フレームワーク | リレーショナル代数ベースのカラムリネージュが可能 |
| **ZetaSQL** | Google開発のSQLアナライザ（BigQuery内部で使用） | C++製。カラム解決が高精度だがPython連携が難しい |
| **SQLMesh** | dbt代替ツール（Tobiko Data社）。内部でsqlglotを使用 | カラムレベルリネージュを標準搭載 |

**推奨**: sqlglotが最もバランスが良い。多方言対応、活発な開発、Pure Python、リネージュ機能内蔵の点で優れている。

---

## 2. dbtのmanifest.jsonに含まれるカラムレベル情報

### manifest.jsonの構造（カラム関連部分）

`manifest.json` は `dbt compile` / `dbt run` / `dbt parse` 実行時に `target/` ディレクトリに生成される。

**ノード定義内のカラム情報** (`nodes.<unique_id>`):
```json
{
  "nodes": {
    "model.my_project.my_model": {
      "columns": {
        "id": {
          "name": "id",
          "description": "Primary key",
          "meta": {},
          "data_type": null,
          "constraints": [],
          "quote": null,
          "tags": []
        },
        "user_name": {
          "name": "user_name",
          "description": "User's full name",
          "meta": {},
          "data_type": "varchar",
          "constraints": [],
          "quote": null,
          "tags": []
        }
      },
      "depends_on": {
        "macros": [],
        "nodes": ["model.my_project.upstream_model"]
      },
      "compiled_code": "SELECT id, user_name FROM ...",
      "raw_code": "SELECT id, user_name FROM {{ ref('upstream_model') }}"
    }
  }
}
```

**重要なフィールド**:
- `columns`: schema.ymlで定義されたカラム情報（定義済みのもののみ）
- `depends_on.nodes`: モデルレベルの依存関係（テーブルレベルリネージュ）
- `compiled_code`: Jinja展開後のSQL（SQLパーサーに入力可能）
- `raw_code`: 展開前のSQL
- `relation_name`: 実テーブル/ビュー名

**カラムレベルリネージュの限界**:
- manifest.jsonのカラム情報はschema.ymlで**明示的に定義されたカラムのみ**
- カラム間の依存関係（どのカラムがどのソースカラムから来たか）は manifest.json に**含まれない**
- テーブルレベルの依存関係（`depends_on`）のみが提供される

**カラムリネージュ構築のアプローチ**:
1. manifest.jsonから `compiled_code` を取得
2. `depends_on.nodes` でモデル間の依存グラフを構築
3. `compiled_code` をsqlglotでパースしてカラムレベルの依存関係を抽出
4. schema.ymlのカラム定義（`columns`）をメタデータとして付与

---

## 3. dbt-coreのカラムリネージュ関連機能

### 3.1 dbt-coreバージョンとmanifestスキーマの対応

| dbt-core バージョン | manifest schema | 主な変更点 |
|-------------------|----------------|-----------|
| 1.0 | v4 | manifest.json初期安定版 |
| 1.1 | v5 | metrics追加 |
| 1.2 | v6 | metrics v2 |
| 1.3 | v7 | `compiled_sql` → `compiled_code` にリネーム |
| 1.4 | v8 | exposures強化 |
| 1.5 | v9 | groups, access modifiers |
| 1.6 | v10 | semantic models, saved queries |
| 1.7 | v11 | unit tests |
| 1.8〜1.10 | v12 | microbatch incremental, fixtures |
| 1.11 | v12 | UDFサポート、catalogs.yml、Python 3.9サポート終了 |
| Fusion 2.0 | v20 | Rust製エンジン独自スキーマ |

**重要**: `compiled_sql` はdbt 1.3（manifest v7）で `compiled_code` にリネームされた。vizdbtでは両方のフィールド名を確認する必要がある。

### 3.2 dbt-core v1.11の変更点（カラムリネージュ関連）

dbt-core v1.11（2025年リリース）の主な変更点:

1. **manifest schemaはv12のまま**: v1.8〜v1.10と同じスキーマバージョン
2. **`run_started_at`がmanifestメタデータに追加**: タイムスタンプフィールドの追加
3. **`catalogs.yml`パーシング**: parse/seed/testコマンドでIceberg catalog統合向けのcatalogs.yml読み込みに対応
4. **UDF（ユーザー定義関数）サポート**: 新しいリソースタイプとしてUDFが追加
5. **カラムmeta/tagsの伝播**: configからテストへのカラムメタデータ・タグ伝播
6. **dbt_versionベースのmanifest JSONアップグレードフレームワーク**: state:modified誤検知の回避
7. **Python 3.9サポート終了**: Python 3.10以上が必須

**カラムレベルリネージュへの影響**:
- dbt-core v1.11でも**ネイティブなカラムレベルリネージュは含まれない**（Cloud/Fusion限定機能のまま）
- artifacts解析（Implementation B）アプローチは引き続き有効
- `catalogs.yml`はIceberg統合向けであり、カラムリネージュとは直接関係しない
- UDFサポートが追加されたが、sqlglot/polyglot-sqlでのUDF内リネージュ追跡は依然として困難

### 3.3 dbt 1.6+ の状況

**dbt Cloud**:
- dbt Cloud（有償版）ではdbt Explorer上でカラムレベルリネージュを可視化する機能が2024年にGA（Generally Available）となった
- dbt Cloudが内部的にSQLを解析してカラム間の依存関係を構築

**dbt-core（OSS版）**:
- dbt-core自体にはカラムレベルリネージュを直接生成する機能は**含まれていない**（v1.11時点でも変わらず）
- `dbt docs generate` で生成される `catalog.json` にはデータベースから取得した実カラム情報が含まれるが、カラム間リネージュは含まれない

### 3.4 vizdbtのmanifest互換性方針

LineageQueryServiceのImplementation B（artifacts解析）では以下を考慮:
- **manifest v7〜v12をサポート**（dbt 1.3〜1.11）
- `compiled_code` フィールドを参照（v7未満はサポート対象外）
- `catalog.json`は任意（存在すればスキーマ情報としてsqlglotに渡し精度向上）
- manifest v12のUDFリソースタイプは初期バージョンではスキップ可

### catalog.json

`dbt docs generate` 実行時に生成。データベースの `information_schema` から実際のカラム情報を取得する。

```json
{
  "nodes": {
    "model.my_project.my_model": {
      "columns": {
        "id": {
          "type": "INTEGER",
          "index": 1,
          "name": "id",
          "comment": null
        },
        "user_name": {
          "type": "VARCHAR",
          "index": 2,
          "name": "user_name",
          "comment": null
        }
      }
    }
  }
}
```

**catalog.jsonの利点**:
- schema.ymlに定義されていないカラムも含む（実テーブルの全カラム）
- データ型情報が正確（データベースから直接取得）
- sqlglotのスキーマ情報として利用可能

### カラムリネージュ構築の実践的フロー

```
1. dbt parse → manifest.json（compiled_code, depends_on）
2. dbt docs generate → catalog.json（全カラム情報 + データ型）
3. manifest.jsonからモデル間依存グラフを構築
4. 各モデルのcompiled_codeをsqlglotでパース
5. catalog.jsonのスキーマ情報を使ってカラム解決を高精度化
6. カラムレベル依存グラフを構築
```

### 関連OSSプロジェクト

- **SQLMesh**: dbt互換のデータ変換ツール。sqlglotベースでカラムレベルリネージュを標準搭載
- **dbt-osmosis**: dbtのschema.ymlを自動生成/管理するツール。カラム伝播のロジックを内蔵
- **piperider**: dbtプロジェクト向けのデータプロファイリングツール。リネージュ可視化機能あり

---

## 4. グラフ可視化のためのJavaScriptライブラリ

### 4.1 React Flow (reactflow.dev)

**概要**: React向けのノード/エッジベースのグラフ可視化ライブラリ。DAG（有向非巡回グラフ）の表示に最適。

**特徴**:
- Reactコンポーネントとして使用
- ノードのドラッグ&ドロップ
- ミニマップ、ズーム、パン
- カスタムノード/エッジの定義が容易
- 自動レイアウト（dagre, elkjs等と併用）

**カラムリネージュへの適性**: 高い
- カスタムノードでテーブル/カラムを表現可能
- エッジでカラム間の依存関係を表現
- インタラクティブ性が高い（ホバー、クリックでの絞り込み等）
- dbt Cloud Explorerもこの種のUIを採用

```jsx
// カスタムノードの例（テーブルノード）
const TableNode = ({ data }) => (
  <div className="table-node">
    <div className="table-header">{data.tableName}</div>
    {data.columns.map(col => (
      <Handle type="source" position="right" id={col.name} key={col.name}>
        <div className="column-row">{col.name}: {col.type}</div>
      </Handle>
    ))}
  </div>
);
```

### 4.2 Cytoscape.js

**概要**: グラフ理論に基づく汎用グラフ可視化ライブラリ。学術・分析用途に強い。

**特徴**:
- フレームワーク非依存（Vanilla JS）
- 豊富なレイアウトアルゴリズム（dagre, cose, breadthfirst等）
- グラフ分析関数（最短パス、中心性等）
- 拡張機能が充実

**カラムリネージュへの適性**: 中程度
- 複合ノード（親子構造）でテーブル+カラムを表現可能
- レイアウトが自動で整う
- 大規模グラフでもパフォーマンスが良い
- ただしカスタムUIの柔軟性はReact Flowに劣る

### 4.3 D3.js

**概要**: 低レベルのデータ可視化ライブラリ。SVG/Canvas直接操作。

**特徴**:
- 極めて高い自由度
- `d3-dag` モジュールでDAG可視化が可能
- 学習コストが高い

**カラムリネージュへの適性**: 高いが開発コスト大
- 完全にカスタムなUIを構築可能
- ただし、ノード/エッジのインタラクション等を一から実装する必要がある

### 4.4 ELK.js (Eclipse Layout Kernel)

**概要**: レイアウトエンジン。他のライブラリと組み合わせて使用。

**特徴**:
- 階層型レイアウトが非常に優秀
- ポート（カラム）単位でのエッジ接続をネイティブサポート
- React Flow + ELK.js の組み合わせが強力

**カラムリネージュへの適性**: 非常に高い（レイアウト専用）
- ポートベースのレイアウトはカラムリネージュに最適
- ノードの各カラムをポートとして定義し、ポート間をエッジで接続

### 4.5 比較表

| ライブラリ | React統合 | 自動レイアウト | カスタムUI | 学習コスト | カラムリネージュ適性 |
|-----------|-----------|--------------|-----------|-----------|-------------------|
| React Flow | ネイティブ | 外部（dagre/elk） | 高い | 低い | 非常に高い |
| Cytoscape.js | ラッパー必要 | 内蔵 | 中程度 | 中程度 | 高い |
| D3.js | ラッパー必要 | d3-dag | 最高 | 高い | 高い（開発コスト大） |
| ELK.js | 組み合わせ | 非常に優秀 | - | 中程度 | 最適（レイアウト） |

**推奨**: React Flow + ELK.js の組み合わせが最もバランスが良い。カスタムノードでテーブル/カラムを表現し、ELK.jsでポートベースの自動レイアウトを行う。

---

## 5. TUI（Terminal UI）でグラフを表示するアプローチ

### 5.1 Textual (textualize/textual)

**概要**: Python製のモダンなTUIフレームワーク。CSSベースのスタイリングが可能。

**特徴**:
- Richの上に構築されたTUIフレームワーク
- ウィジェットベースのUI構築
- CSSによるスタイリング
- 非同期対応
- マウス操作対応

**グラフ表示への適性**:
- Canvas/描画ウィジェットでASCII/Unicodeベースのグラフ表示が可能
- `Tree` ウィジェットでツリー構造の表示
- `DataTable` ウィジェットでテーブル情報の表示
- ただし、複雑なDAGの可視化は自前実装が必要

```python
from textual.app import App, ComposeResult
from textual.widgets import Tree, Header, Footer

class LineageApp(App):
    def compose(self) -> ComposeResult:
        yield Header()
        tree = Tree("Lineage")
        model = tree.root.add("model.orders")
        model.add_leaf("id <- source.raw_orders.id")
        model.add_leaf("amount <- source.raw_orders.amount")
        yield tree
        yield Footer()
```

### 5.2 Rich

**概要**: Python製のリッチテキスト出力ライブラリ。ターミナルでの美しい出力を実現。

**特徴**:
- テーブル、ツリー、パネル等の構造化出力
- シンタックスハイライト
- プログレスバー
- TUIフレームワークではなく、出力ライブラリ

**グラフ表示への適性**:
- `Tree` でツリー構造の表示が可能
- `Table` でカラム情報の表示
- インタラクティブ性はない（出力のみ）
- 簡易的なリネージュ表示には十分

```python
from rich.tree import Tree
from rich.console import Console
from rich.table import Table

console = Console()

tree = Tree("[bold]model.orders[/bold]")
branch = tree.add("[dim]id[/dim]")
branch.add("source.raw_orders.id")
branch = tree.add("[dim]amount[/dim]")
branch.add("stg.stg_payments.amount")

console.print(tree)
```

### 5.3 Asciinet / graph-cli 系

**ASCIIベースのグラフ描画**:
- Pythonの `asciinet` ライブラリでNetworkXグラフをASCIIアートとして描画
- ただし複雑なグラフには不向き

### 5.4 Graphviz（ターミナル出力）

- `graphviz` のDOT形式で定義し、Sixelプロトコル対応ターミナルで画像表示
- または `graph-easy` (Perl) でDOTグラフをASCII変換

```
# graph-easy によるASCII出力例
+------------+     +------------+
| source.raw | --> | stg.orders |
+------------+     +------------+
                        |
                        v
                   +----------+
                   | orders   |
                   +----------+
```

### 5.5 TUIアプローチの比較

| ツール | インタラクティブ | DAG表示 | 開発コスト | 表示品質 |
|--------|----------------|---------|-----------|---------|
| Textual | 高い（マウス対応） | 自前実装必要 | 中程度 | 高い |
| Rich | なし（出力のみ） | ツリーのみ | 低い | 中程度 |
| graph-easy | なし | DOT→ASCII変換 | 低い | 中程度 |
| Sixel+Graphviz | なし | 画像として表示 | 低い | 高い（ターミナル依存） |

**推奨**:
- **インタラクティブTUI**: Textual が最も有望。ただしDAGの自動レイアウトは自前実装が必要
- **簡易出力**: Rich の Tree + Table で十分な情報を提供できる
- **画像出力**: Graphviz + Sixel で高品質な可視化が可能（ターミナル依存）

---

## 6. 総合的な技術スタック推奨

### 推奨アーキテクチャ: TypeScript + Bun + Wasm

```
dbt artifacts (manifest.json + catalog.json)
    ↓
LineageQueryService インターフェース
├── Implementation A: dbt Fusion LSP（JSON-RPC over stdio、高精度）
└── Implementation B: artifacts解析（フォールバック）
    └── @polyglot-sql/sdk (Wasm) or sqlglot (Python) でカラムリネージュ抽出
    ↓
Bun HTTP Server (Hono等) - REST API
    ↓
React Flow + ELK.js (フロントエンド) - インタラクティブ可視化
```

### コアロジック（共通）
1. `manifest.json` からモデル依存グラフと `compiled_code` を取得（v7以前は`compiled_sql`）
2. `catalog.json` からスキーマ情報（全カラム + データ型）を取得（任意）
3. Fusion LSP検出時 → LSP経由で高精度カラムリネージュ取得
4. Fusion未検出時 → `@polyglot-sql/sdk` の `lineage()` でカラムレベル依存関係を解析
5. カラムレベルDAGを構築
6. UI層（React Flow + ELK.js）に渡して可視化

### 配布
- `bun build --compile` で単一バイナリとして配布
- フロントエンドアセットはバイナリに埋め込み
- Python環境不要でインストール・実行可能
