# dbt データリネージュ可視化ツール調査

調査日: 2026-03-06

---

## 1. CLIベースのdbtリネージュ可視化ツール

### dbt docs (公式)

- **リポジトリ**: dbt-core に内蔵
- **コマンド**: `dbt docs generate` + `dbt docs serve`
- **概要**: dbt公式のドキュメント生成・サーバー機能。manifest.jsonとcatalog.jsonを生成し、静的HTMLサイトとしてリネージュDAGを表示する
- **特徴**:
  - モデル間のリネージュをDAGで可視化
  - ブラウザベースのUI（ローカルサーバー）
  - モデルのドキュメント、カラム情報、テスト情報も表示
  - `--select` でフィルタリング可能
- **制限**: カラムレベルリネージュは非対応。UIのカスタマイズ性が低い

### dbt-meshify

- **リポジトリ**: https://github.com/dbt-labs/dbt-meshify
- **PyPI**: `dbt-meshify`
- **概要**: dbt-labs公式のCLIツール。dbtプロジェクトをメッシュ（複数プロジェクト）構成に分割するためのツール
- **特徴**:
  - モデル間の依存関係を分析してプロジェクト分割を提案
  - グループ化、アクセス制御の設定を自動化
  - リネージュ情報を分析に活用
- **制限**: リネージュの「可視化」が主目的ではなく、プロジェクト構造の再編成が主目的

### dbt-osmosis

- **リポジトリ**: https://github.com/z3z1ma/dbt-osmosis
- **PyPI**: `dbt-osmosis`
- **概要**: dbtのYAMLスキーマファイルを自動管理するCLIツール
- **特徴**:
  - カラムのドキュメントを上流モデルから自動的に伝播
  - スキーマファイル（YAML）の自動整理・リファクタリング
  - `dbt-osmosis server` でWebベースのSQL実行環境を提供
  - カラムレベルの伝播を意識した設計
- **制限**: 可視化よりもスキーマ管理が主目的

### dbt-power-user (VS Code拡張)

- **概要**: VS Code上でdbtのリネージュを視覚的に表示する拡張機能
- **特徴**:
  - エディタ内でモデルのリネージュDAGを表示
  - カラムレベルリネージュに対応（dbt 1.6+ のunit test機能と連携）
  - SQL自動補完、モデルジャンプ
- **制限**: VS Code専用。CLIツールではない

### Elementary

- **リポジトリ**: https://github.com/elementary-data/elementary
- **PyPI**: `elementary-data`
- **概要**: dbtネイティブのデータ観測（data observability）ツール
- **特徴**:
  - データ品質モニタリング、異常検知
  - `edr report` でHTMLレポート生成（リネージュ含む）
  - Slackやメールへのアラート送信
  - dbtテストの結果をダッシュボードで可視化
- **制限**: リネージュ可視化は付随的機能。主目的はデータ品質監視

### dbt-checkpoint / dbt-project-evaluator

- **dbt-project-evaluator**: dbt-labs公式のdbtパッケージ。リネージュのベストプラクティス違反を検出する
  - 直接のソース参照がないモデル、中間モデルが適切にステージングされているか等をチェック
  - リネージュの「分析」だけで「可視化」は行わない

---

## 2. カラムレベルリネージュを提供するOSSツール

### SQLGlot

- **リポジトリ**: https://github.com/tobymao/sqlglot
- **PyPI**: `sqlglot`
- **概要**: 高性能なSQLパーサー/トランスパイラー。PythonでSQLを解析して抽象構文木(AST)を操作できる
- **特徴**:
  - `sqlglot.lineage` モジュールでカラムレベルリネージュを解析
  - 入力テーブル・カラムから出力カラムへのマッピングを追跡
  - 複数のSQL方言に対応（BigQuery, Snowflake, Postgres, DuckDB等）
  - dbt固有の構文（Jinja, ref(), source()）は非対応のため、コンパイル済みSQLを使う必要がある
- **使用例**:
  ```python
  import sqlglot
  from sqlglot.lineage import lineage

  result = lineage(
      column="col_name",
      sql="SELECT a.col_name FROM table_a a JOIN table_b b ON a.id = b.id",
      schema={"table_a": {"col_name": "VARCHAR", "id": "INT"}, "table_b": {"id": "INT"}}
  )
  ```

### SQLLineage

- **リポジトリ**: https://github.com/reata/sqllineage
- **PyPI**: `sqllineage`
- **概要**: SQLからテーブルレベルおよびカラムレベルのリネージュを抽出するPythonライブラリ
- **特徴**:
  - CLI (`sqllineage -e "SQL文"`) でリネージュを表示
  - `-l column` オプションでカラムレベルリネージュ
  - Webベースの可視化UI付き (`sqllineage -g` でGUIサーバー起動)
  - 内部的にsqlfluffやsqlglotをパーサーとして利用可能
- **制限**: dbt固有のJinja構文には非対応

### SQLMesh

- **リポジトリ**: https://github.com/TobikoData/sqlmesh
- **PyPI**: `sqlmesh`
- **概要**: dbtの代替となるデータ変換フレームワーク。カラムレベルリネージュをネイティブサポート
- **特徴**:
  - 自動的にカラムレベルリネージュを計算
  - Web UIでカラムリネージュをインタラクティブに表示
  - dbtプロジェクトをそのまま読み込むアダプターあり
  - 仮想環境（Virtual Data Environments）でのプレビュー
- **制限**: dbtとは別のフレームワーク。リネージュ機能だけの利用はやや大がかり

### OpenLineage

- **リポジトリ**: https://github.com/OpenLineage/OpenLineage
- **概要**: Linux Foundation傘下のデータリネージュ標準仕様（API仕様）
- **特徴**:
  - ジョブ実行時のリネージュメタデータを標準フォーマットで収集
  - dbt用のインテグレーションあり（`openlineage-dbt`）
  - Marquez等のメタデータストアと連携
  - カラムレベルリネージュのファセット（facet）をサポート
- **制限**: 実行時のリネージュ収集が主目的。静的解析による可視化ツールではない

### dbt Cloud (有償)

- dbt Cloud Enterprise版ではカラムレベルリネージュをネイティブサポート
- dbt Explorer（UI）でインタラクティブにカラムリネージュを表示可能
- OSSではない

---

## 3. dbt manifest.json / catalog.json の構造とリネージュ情報

### manifest.json

`dbt docs generate` または `dbt compile` / `dbt run` 実行時に `target/manifest.json` に生成される。

**主要なトップレベルキー**:

| キー | 説明 |
|------|------|
| `metadata` | dbtバージョン、プロジェクト名、生成日時等 |
| `nodes` | モデル、テスト、スナップショット、シード等の全ノード情報 |
| `sources` | ソースの定義情報 |
| `exposures` | エクスポージャーの定義情報 |
| `metrics` | メトリクスの定義情報 |
| `parent_map` | 各ノードの親（上流）ノードのリスト |
| `child_map` | 各ノードの子（下流）ノードのリスト |

**ノード（`nodes` 内の各エントリ）の主要フィールド**:

```json
{
  "unique_id": "model.project_name.model_name",
  "name": "model_name",
  "resource_type": "model",
  "depends_on": {
    "macros": ["macro.dbt.macro_name"],
    "nodes": ["model.project_name.upstream_model", "source.project_name.source.table"]
  },
  "compiled_code": "SELECT ... FROM ...",
  "columns": {
    "column_name": {
      "name": "column_name",
      "description": "...",
      "meta": {},
      "data_type": null,
      "tags": []
    }
  },
  "config": {
    "materialized": "table",
    "schema": "...",
    "tags": []
  },
  "refs": [{"name": "upstream_model", "package": null}],
  "sources": [["source_name", "table_name"]],
  "fqn": ["project_name", "staging", "model_name"],
  "path": "staging/model_name.sql",
  "database": "my_database",
  "schema": "my_schema"
}
```

**リネージュの取得方法**:

1. **`parent_map`**: `parent_map["model.project.model_a"]` で model_a の上流ノード一覧を取得
2. **`child_map`**: `child_map["model.project.model_a"]` で model_a の下流ノード一覧を取得
3. **`depends_on.nodes`**: 各ノード内の `depends_on.nodes` フィールドで直接的な依存関係を取得
4. **`refs` / `sources`**: ref() や source() の呼び出し情報

### catalog.json

`dbt docs generate` 実行時に `target/catalog.json` に生成される。データウェアハウスから実際のスキーマ情報を取得したもの。

**主要な構造**:

```json
{
  "metadata": { ... },
  "nodes": {
    "model.project.model_name": {
      "metadata": {
        "type": "TABLE",
        "schema": "my_schema",
        "name": "model_name",
        "database": "my_database",
        "owner": "..."
      },
      "columns": {
        "column_name": {
          "type": "STRING",
          "index": 1,
          "name": "column_name",
          "comment": null
        }
      },
      "stats": {
        "row_count": { "value": 1000, ... },
        "bytes": { "value": 50000, ... }
      }
    }
  },
  "sources": { ... }
}
```

- `catalog.json` にはリネージュ情報は含まれないが、実際のカラム型情報やテーブル統計を提供
- `manifest.json` と組み合わせることで、リネージュ + スキーマ情報の完全なビューを構築できる

---

## 4. ブラウザベースでリネージュを表示するOSSプロジェクト

### dbt-docs (公式)

- `dbt docs serve` でローカルブラウザにDAGを表示
- D3.jsベースのインタラクティブDAG
- モデル選択、フィルタリング、ドキュメント閲覧が統合

### SQLLineage Web UI

- `sqllineage -g` でFlaskベースのWebサーバーを起動
- テーブル/カラムリネージュをDAGとして可視化
- ただしdbt固有のプロジェクト構造には非対応

### SQLMesh Web UI

- `sqlmesh ui` でWebアプリケーションを起動
- カラムレベルリネージュをインタラクティブに表示
- dbtプロジェクトの読み込みにも対応

### Marquez

- **リポジトリ**: https://github.com/MarquezProject/marquez
- OpenLineage互換のメタデータストア + Web UI
- ジョブのリネージュDAGをブラウザで表示
- dbtとの連携はOpenLineage経由

### Datahub

- **リポジトリ**: https://github.com/datahub-project/datahub
- LinkedIn発のデータカタログ/ガバナンスプラットフォーム
- dbtインテグレーションでリネージュを取り込み可能
- Reactベースのリッチなリネージュ可視化UI
- カラムレベルリネージュ表示対応
- 大規模だがOSSとして利用可能

### Amundsen

- **リポジトリ**: https://github.com/amundsen-io/amundsen
- Lyft発のデータディスカバリー・カタログツール
- dbtインテグレーションあり
- テーブルレベルのリネージュ表示

### dbt-dag (軽量)

- 複数の小規模OSSプロジェクトが存在
- manifest.jsonを読み込んでシンプルなDAGを生成するスクリプト群
- Mermaid.js, Graphviz, vis.js 等を利用するものが多い

### Lightdash / Metabase (BIツール)

- dbt連携を持つOSS BIツール
- リネージュ可視化も部分的に対応
- BIが主目的のため、リネージュ特化ではない

---

## 5. Pythonでdbt artifactsをパースするライブラリ

### dbt-artifacts-parser

- **PyPI**: `dbt-artifacts-parser`
- **概要**: manifest.json, catalog.json, run_results.json, sources.json をPydanticモデルとしてパース
- **対応**: dbt v1〜v12のアーティファクトスキーマに対応
- **使用例**:
  ```python
  from dbt_artifacts_parser.parser import parse_manifest
  import json

  with open("target/manifest.json") as f:
      manifest_dict = json.load(f)
  manifest = parse_manifest(manifest_dict)

  for unique_id, node in manifest.nodes.items():
      print(unique_id, node.depends_on.nodes)
  ```

### dbt-core 内蔵のクラス

- dbt-coreをインポートして直接利用可能
- `dbt.contracts.graph.manifest.WritableManifest` 等
- ただしdbt-coreへの依存が重い

### 標準JSONパース（json / pydantic）

- manifest.jsonは標準JSONなので `json.load()` で読み込み、辞書として操作可能
- Pydanticで独自モデルを定義してバリデーションすることも容易
- 最も軽量なアプローチ

### networkx（グラフ処理）

- **PyPI**: `networkx`
- manifest.jsonの `parent_map` / `child_map` からNetworkXの有向グラフ（DiGraph）を構築可能
- グラフアルゴリズム（最短経路、サブグラフ抽出、トポロジカルソート等）を適用できる
- **使用例**:
  ```python
  import json
  import networkx as nx

  with open("target/manifest.json") as f:
      manifest = json.load(f)

  G = nx.DiGraph()
  for node_id, parents in manifest["parent_map"].items():
      for parent_id in parents:
          G.add_edge(parent_id, node_id)

  # node_id の上流を全て取得
  ancestors = nx.ancestors(G, "model.project.target_model")
  ```

### graphviz / pydot

- Graphvizフォーマットでリネージュグラフを出力
- PNG/SVG/PDF等への書き出しが可能
- CLIでの静的な可視化に適する

---

## まとめ: ツール選定の指針

| 用途 | 推奨ツール |
|------|-----------|
| 手軽にモデルリネージュを確認 | `dbt docs serve`（公式） |
| カラムレベルリネージュ（SQL解析） | SQLGlot (`sqlglot.lineage`) |
| カラムレベルリネージュ（UI付き） | SQLMesh / SQLLineage |
| Pythonでmanifestをパース | `dbt-artifacts-parser` or 標準 `json` + `networkx` |
| グラフの静的画像出力 | `networkx` + `graphviz` |
| 本格的なデータカタログとして | Datahub |
| データ品質も含めた統合ビュー | Elementary |

### 自作する場合の最小構成

1. `manifest.json` を `json.load()` で読み込み
2. `parent_map` / `child_map` から `networkx.DiGraph` を構築
3. カラムレベルリネージュは `compiled_code` を `sqlglot.lineage` で解析
4. 可視化は用途に応じて:
   - CLI: `rich` ライブラリでツリー表示 / Graphvizで画像出力
   - ブラウザ: D3.js / vis.js / Mermaid.js でDAG描画
   - ターミナル: `asciinet` 等でASCII DAG描画
