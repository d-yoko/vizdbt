# ADR-002: カラムリネージュエンジンの選択

- **ステータス**: 採用
- **日付**: 2026-03-06
- **決定者**: プロジェクトオーナー

## コンテキスト

vizdbtの最大の差別化要素はカラムレベルリネージュの可視化。SQLを解析してカラム間の依存関係を抽出するエンジンの選択が品質に直結する。

## 検討した選択肢

### 1. sqlglot（Python）のみ

- **成熟度**: 非常に高い（dbtエコシステムの事実上の標準）
- **カラムリネージュ**: `sqlglot.lineage()` で内蔵サポート
- **方言**: 20以上（BigQuery, Snowflake, Postgres, Redshift, DuckDB等）
- Pure Python、依存なし
- **制限**: SELECT *の解決にスキーマ情報必要、UDF追跡不可

### 2. dbt Fusion LSPのみ

- dbt Labs公式のRust製SQLパーサー
- 最高精度のカラムリネージュ（PIIタグ伝播対応）
- **制限**: ユーザーがFusionバイナリをインストール済みであることが前提
- ベータ版でAPIが変わる可能性
- Fusionなしの環境で動作しない

### 3. @polyglot-sql/sdk（Rust→Wasm）のみ

- sqlglotにインスパイアされたRust製SQLトランスパイラのWasmバインディング
- `lineage()` 関数でカラムリネージュ対応
- 33方言対応、10,220のsqlglotテストケースを実行
- TypeScriptから直接利用可能
- **制限**: sqlglotほどの実績がない（比較的新しい）

### 4. @altimateai/dbt-integration

- dbt Power Userが使用する`computeColumnLineage()`を含む
- npmで公開されているがライセンス不明（クローズドソースの可能性）
- 採用リスクが高い

### 5. LineageQueryServiceによるハイブリッド ★採用

- インターフェースで抽象化し、複数エンジンを切り替え可能にする
- FusionAdapter（高精度）+ ArtifactsAdapter（フォールバック）の2層構成

## dbt Power Userの実装分析

dbt Power Userのソースコード（`dbtLineageService.ts`）を分析した結果、2エンジンのハイブリッド構成であることが判明:

```
[設定: dbt.lineage.cllEngine]
├── "sqlEngine" → @altimateai/dbt-integration の computeColumnLineage()（ローカル）
└── "legacy" → AltimateAI SaaS API（リモート）
```

出力形式:
```typescript
{
  column_lineage: [{
    source: [uniqueId, column_name],  // 例: ["model.project.stg_orders", "id"]
    target: [uniqueId, column_name],
    type: "select" | "non-select"     // SELECT句 vs WHERE/JOIN句
  }]
}
```

この「Select Link vs Non-Select Link」の区別はvizdbtでも採用する。

## Fusion LSPの技術詳細

- **通信プロトコル**: JSON-RPC 2.0 over stdio/TCP（言語非依存）
- **ライセンス**: ELv2（ローカル利用は無料・無制限）
- **前提**: dbt Fusionバイナリがインストール済みでPATHに存在
- **カラムリネージュ取得**: `get_column_lineage` RPCメソッド
- **CLIからは直接利用不可**: カラムリネージュはLSP機能のみ（`dbtf` CLIにはない）

重要: **LSPはJSON-RPC標準プロトコルなので、どの言語からでも同等に通信可能**。RustだからFusion統合が有利ということはない。

## 決定

**LineageQueryServiceインターフェースによるハイブリッド構成を採用する。**

```
LineageQueryService
├── FusionAdapter（優先・Phase 3で実装）
│   - dbt Fusionバイナリを自動検出
│   - JSON-RPC over stdio でLSPサーバーに接続
│   - get_column_lineage でカラムリネージュ取得
│
└── ArtifactsAdapter（フォールバック・Phase 2で実装）
    - compiled_code + catalog.jsonのスキーマ情報
    - @polyglot-sql/sdk の lineage() でカラムリネージュ解析
```

```typescript
interface LineageQueryService {
  getColumnLineage(modelId: string, columnName: string, depth?: number): Promise<ColumnLineageResult>;
  getModelLineage(selector: string, depth?: number): Promise<ModelLineageResult>;
}
```

## 理由

1. **段階的実装**: Phase 2でArtifactsAdapter、Phase 3でFusionAdapter。MVPではDAGのみ
2. **環境非依存**: Fusionなしでも動作する（@polyglot-sql/sdkにフォールバック）
3. **最高精度も提供可能**: Fusion検出時は公式パーサーによる高精度解析
4. **将来のRust最適化**: インターフェース境界で内部実装をRust/Wasmに置換可能
5. **dbt Power Userと同じ設計思想**: ハイブリッド構成は実績のあるパターン

## 参考

- [カラムリネージュ技術調査](../search/column_lineage_technical.md)
- [dbt Fusion調査](../search/dbt_fusion.md)
- [dbt Power Userカラムリネージュ実装調査](../search/dbt_power_user_column_lineage.md)
