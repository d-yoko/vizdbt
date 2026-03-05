# VSCode dbt関連拡張機能 調査レポート

> 調査日: 2026-03-06
> 情報源: 2025年5月時点までの公開情報に基づく。最新の変更は反映されていない可能性がある。

---

## 1. 主要なdbt VSCode拡張機能一覧

### 1-1. dbt Power User（innoverio.vscode-dbt-power-user）

- **開発元**: AltimateAI（旧Innoverio）
- **対応**: dbt Core / dbt Cloud
- **ライセンス**: 基本機能は無料、一部機能はAltimateAIのSaaS連携が必要
- **GitHubリポジトリ**: https://github.com/AltimateAI/vscode-dbt-power-user

### 1-2. Wizard for dbt Core（dabortz.vscode-dbt-wizard）

- **開発元**: dabortz（個人開発者）
- **対応**: dbt Core専用
- **ライセンス**: オープンソース（MIT）
- **GitHubリポジトリ**: https://github.com/nicholasyager/vscode-dbt-wizard（後にメンテナンス状況が変動）

### 1-3. dbt Labs公式拡張機能（dbt-labs.dbt-language-server）

- **開発元**: dbt Labs
- **対応**: dbt Cloud専用（Cloud CLIベース）
- **ライセンス**: プロプライエタリ
- **備考**: dbt Cloud利用者向け。dbt Coreのみのユーザーは利用不可。

### 1-4. vscode-dbt（bastienboutonnet.vscode-dbt）

- **開発元**: Bastien Boutonnet
- **対応**: dbt Core
- **備考**: シンタックスハイライトやスニペットなど軽量な機能を提供。現在はメンテナンスが停滞気味。

---

## 2. 機能比較表

| 機能 | dbt Power User | Wizard for dbt Core | dbt Labs公式 |
|------|---------------|--------------------:|-------------|
| SQLオートコンプリート | ○ | ○ | ○ |
| モデル間リネージュ（DAG表示） | ○ | ○ | ○ |
| **カラムレベルリネージュ** | **○** | × | **○（dbt Cloud経由）** |
| SQLプレビュー/クエリ結果表示 | ○ | ○ | ○ |
| dbtコマンド実行（run/test/build） | ○ | ○ | ○ |
| ドキュメント（description）編集 | ○ | △（限定的） | ○ |
| Go to Definition（ref/source） | ○ | ○ | ○ |
| Jinjaテンプレートサポート | ○ | ○ | ○ |
| コンパイル済みSQL表示 | ○ | ○ | ○ |
| テスト結果表示 | ○ | ○ | ○ |
| dbt Cloud連携 | ○ | × | ○（必須） |
| AI機能（SQL生成等） | ○（AltimateAI） | × | △ |
| 無料利用 | △（基本無料） | ○ | ×（dbt Cloud必須） |

---

## 3. カラムレベルリネージュ機能の詳細

### 3-1. dbt Power User のカラムレベルリネージュ

#### 概要
dbt Power Userはカラムレベルのデータリネージュを提供する数少ない拡張機能の一つ。エディタ上で特定のカラムがどのソーステーブルのどのカラムに由来するかを視覚的に追跡できる。

#### 実装方式

1. **SQLパーシング（静的解析）**
   - SQLGlotライブラリ（Pythonベース）を使用してSQLの静的解析を実行
   - SELECT文のカラム式を解析し、各カラムがどのテーブル/CTEのどのカラムから派生しているかを特定
   - JOINやWHERE句を通じたカラム間の依存関係も追跡

2. **manifest.jsonの活用**
   - dbtが生成する `target/manifest.json` をパースしてモデル間の依存関係（ref/source）を取得
   - manifest.jsonには各モデルのノード情報、依存関係、カラム定義（schema.ymlで定義されたもの）が含まれる

3. **catalog.jsonの活用**
   - `dbt docs generate` で生成される `target/catalog.json` を使用
   - 実際のデータウェアハウスのスキーマ情報（カラム名、データ型）を取得
   - schema.ymlに未記載のカラムもcatalogから補完

4. **AltimateAI SaaS連携（オプション）**
   - より高精度なカラムリネージュ解析のため、AltimateAIのクラウドサービスと連携可能
   - 複雑なSQL（CASE文、ウィンドウ関数、UDF等）の解析精度が向上
   - この機能を使う場合はAltimateAIアカウントが必要

#### データソース

| データソース | 用途 | 必須/任意 |
|-------------|------|----------|
| `target/manifest.json` | モデル間依存関係、ノード情報 | 必須 |
| `target/catalog.json` | DWHスキーマ情報（カラム名・型） | 推奨 |
| SQLファイル本体 | SQL静的解析（SQLGlot） | 必須 |
| `schema.yml` | カラムdescription等のメタデータ | 任意 |
| AltimateAI API | 高精度解析（オプション） | 任意 |

#### 技術的な制約・注意点

- SQLGlotによる静的解析のため、動的SQL（Jinjaマクロで大量に生成されるSQL）は解析精度が下がる場合がある
- `SELECT *` を多用しているプロジェクトではカラムリネージュの精度が低下する（catalog.jsonがあれば改善）
- ephemeralモデルはコンパイル後のSQLとして展開されてから解析される
- UDF（ユーザー定義関数）内部のカラム変換は追跡困難

### 3-2. dbt Labs公式拡張機能のカラムレベルリネージュ

#### 概要
dbt Labs公式拡張機能はdbt Cloudのメタデータを利用してカラムレベルリネージュを提供する。

#### 実装方式

1. **dbt Cloud Metadata API**
   - dbt Cloud の Discovery API（GraphQL）を通じてリネージュ情報を取得
   - dbt Cloudがビルド時に生成するメタデータを活用
   - サーバーサイドでの解析結果をそのまま利用するため、ローカルでの重い解析処理が不要

2. **dbt Cloud SemanticLayer**
   - dbt Cloudのセマンティックレイヤーとの統合もサポート

#### データソース

| データソース | 用途 |
|-------------|------|
| dbt Cloud Discovery API | リネージュ情報（モデルレベル・カラムレベル） |
| dbt Cloud Admin API | プロジェクト設定、環境情報 |
| dbt Cloud Semantic Layer API | メトリクス情報 |

---

## 4. 各拡張機能の主要機能詳細

### 4-1. dbt Power User の主要機能

#### SQLプレビュー / クエリ結果表示
- エディタ上からSQLを実行し、結果をVSCode内のパネルに表示
- `LIMIT` を自動付与してコストを抑制
- 対応DWH: BigQuery, Snowflake, Redshift, Databricks, PostgreSQL等
- dbtのprofiles.ymlの接続情報を利用して直接DWHに接続

#### モデル間リネージュ（DAGビュー）
- 現在開いているモデルを中心にupstream/downstreamのDAGを表示
- WebViewベースのインタラクティブなグラフ表示
- ノードをクリックして該当モデルファイルに遷移可能

#### dbtコマンド実行
- VSCode内からdbt run, dbt test, dbt build等を実行
- 現在のモデルに対してのみ実行する機能あり（`--select` を自動設定）
- コマンドパレットおよびエディタのCodeLens（インラインボタン）から実行可能

#### ドキュメント（description）編集
- schema.ymlのdescriptionをエディタ上から直接編集
- カラムのdescription生成にAI（AltimateAI）を使用可能
- dbt docsと同等の情報をVSCode内で閲覧

#### Go to Definition / リファレンス
- `ref('model_name')` や `source('source', 'table')` にカーソルを合わせてF12で定義元に遷移
- 逆方向（このモデルを参照しているモデル一覧）も表示可能

#### コンパイル済みSQL表示
- Jinjaテンプレートを展開した結果のSQLを表示
- dbt compileコマンドを内部で実行

#### AI機能（AltimateAI連携）
- SQLの自動生成・修正提案
- ドキュメント（description）の自動生成
- テストの自動提案

### 4-2. Wizard for dbt Core の主要機能

- SQLオートコンプリート（ref/source）
- Go to Definition
- モデルDAG表示
- dbtコマンドの実行
- コンパイル済みSQL表示
- スニペット

### 4-3. dbt Labs公式拡張機能の主要機能

- dbt Cloud CLIとの統合
- SQLオートコンプリート（Language Server Protocol準拠）
- カラムレベルリネージュ（dbt Cloud Metadata API経由）
- dbt Cloud環境でのコマンド実行
- SQLプレビュー
- dbt Explorerとの統合

---

## 5. API / データ依存関係まとめ

### 5-1. ローカルファイル依存

| ファイル | 説明 | 生成方法 |
|---------|------|---------|
| `target/manifest.json` | dbtプロジェクトのメタデータ（モデル、ソース、依存関係等） | `dbt parse`, `dbt compile`, `dbt run` 等で生成 |
| `target/catalog.json` | DWHのスキーマ情報（テーブル・カラム定義） | `dbt docs generate` で生成 |
| `target/run_results.json` | 最新のdbt実行結果 | `dbt run`, `dbt test` 等で生成 |
| `profiles.yml` | DWH接続情報 | ユーザーが手動作成（通常 `~/.dbt/profiles.yml`） |
| `dbt_project.yml` | プロジェクト設定 | ユーザーが手動作成 |
| `schema.yml` / `*.yml` | モデル・カラム定義、テスト定義 | ユーザーが手動作成 |

### 5-2. 外部API依存

| API | 拡張機能 | 用途 |
|-----|---------|------|
| DWH接続（BigQuery/Snowflake等） | Power User, Wizard | SQLプレビュー実行、スキーマ取得 |
| AltimateAI API | Power User（オプション） | AI機能、高精度リネージュ解析 |
| dbt Cloud Discovery API (GraphQL) | dbt Labs公式 | メタデータ・リネージュ取得 |
| dbt Cloud Admin API | dbt Labs公式 | プロジェクト管理、環境設定 |
| dbt Cloud Semantic Layer API | dbt Labs公式 | メトリクス情報 |

### 5-3. 主要ライブラリ依存

| ライブラリ | 用途 | 利用拡張機能 |
|-----------|------|------------|
| SQLGlot (Python) | SQL静的解析、カラムリネージュ抽出 | Power User |
| Language Server Protocol | コード補完、診断、定義ジャンプ | dbt Labs公式、Power User |
| D3.js / React等 | DAGビュー・リネージュのWebView描画 | Power User |

---

## 6. カラムレベルリネージュ実装のポイント（技術的考察）

カラムレベルリネージュの実現には以下のステップが必要：

1. **SQL解析**: SQLGlot等のパーサーでSELECT文の各カラム式を解析し、ソースカラムを特定
2. **モデル間接続**: manifest.jsonのref/source情報でモデル間の依存グラフを構築
3. **スキーマ解決**: catalog.jsonまたはDWH直接クエリでカラム一覧を取得（`SELECT *` の展開に必要）
4. **グラフ構築**: 各カラムの系譜（lineage）をモデルを跨いで接続
5. **可視化**: WebViewでインタラクティブなグラフとして表示

### SQLGlotによるカラムリネージュ解析の仕組み

SQLGlotはSQLを抽象構文木（AST）にパースし、`lineage`モジュールでカラムの系譜を追跡する。

```
入力: SELECT a.id, b.name FROM table_a a JOIN table_b b ON a.id = b.id
          ↓ SQLGlot パース
出力:
  - column "id" → source: table_a.id
  - column "name" → source: table_b.name
```

SQLGlotは以下の変換パターンを追跡可能：
- カラムエイリアス（`AS`）
- CTE内のカラム参照
- サブクエリ内のカラム参照
- UNION/UNION ALLの各ブランチ
- CASE式の結果カラム
- ウィンドウ関数

---

## 7. まとめ・推奨

- **dbt Coreユーザー**: dbt Power Userが最も機能が充実。カラムレベルリネージュも利用可能。
- **dbt Cloudユーザー**: dbt Labs公式拡張機能がネイティブ統合で最適。Power Userとの併用も可能。
- **カラムレベルリネージュ**: Power UserはSQLGlot + manifest.json + catalog.jsonで実現。dbt Labs公式はdbt Cloud Metadata APIで実現。
- **軽量な利用**: Wizard for dbt Coreは基本的な機能を無料・オープンソースで提供。
