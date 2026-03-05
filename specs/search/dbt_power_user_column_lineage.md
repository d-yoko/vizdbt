# dbt Power User カラムリネージュ実装調査

調査日: 2026-03-06

---

## 1. 実装アーキテクチャ（ソースコード分析）

### ソースコード: `src/services/dbtLineageService.ts`

dbt Power Userのカラムリネージュは**2つのエンジン**を持つハイブリッド構成:

```
[設定: dbt.lineage.cllEngine]
├── "sqlEngine"（新方式）→ @altimateai/dbt-integration の computeColumnLineage()
│   - ローカル実行
│   - APIキー不要
│   - npmパッケージ内にSQLパース機能を内蔵
│
└── "legacy"（従来方式）→ AltimateAI SaaS API
    - altimateRequest.getColumnLevelLineage() でリモートAPI呼び出し
    - APIキー必要
```

### コア処理フロー

```typescript
// 1. モデル情報の収集
const { mappedNode, relationsWithoutColumns, mappedCompiledSql } =
  await project.getNodesWithDBColumns(modelsToFetch, signal);

// 2. compiled SQLの取得
const bulkCompiledSql = await project.getBulkCompiledSql(modelsToCompile);

// 3. modelInfosの構築（各モデルの model_node + compiled_sql + raw_sql）

// 4. SQLダイアレクトの取得
const modelDialect = project.getAdapterType();

// 5. cllEngine設定に基づいてエンジン選択
if (cllEngine === "sqlEngine") {
  // ローカル実行（@altimateai/dbt-integration）
  const localResult = await computeColumnLineage(
    modelDialect,     // "bigquery", "snowflake" 等
    modelInfos,       // モデル情報 + compiled SQL
    { showIndirectEdges, isCancelled }
  );
} else {
  // レガシー: AltimateAI API呼び出し
  const result = await this.altimateRequest.getColumnLevelLineage(request);
}
```

### 重要な発見

1. **`@altimateai/dbt-integration`パッケージ**
   - npmパッケージとして公開: `npm install @altimateai/dbt-integration`
   - `computeColumnLineage()` 関数でローカルカラムリネージュ解析
   - 入力: SQLダイアレクト、モデル情報（compiled SQL含む）、オプション
   - 出力: `{ column_lineage: [...], errors: [...] }`

2. **ローカル解析が可能**
   - `cllEngine = "sqlEngine"` 設定時はAPIキー不要
   - manifest.json + compiled SQL + スキーマ情報のみで動作
   - 失敗時はlegacy API（AltimateAI）にフォールバック

3. **SQLパースはsqlglot相当の機能をNode.js側で実装**
   - ソースコード内に `auxiliaryTables: string[] = []; // these are used for better sqlglot parsing` というコメントあり
   - 内部的にsqlglotベースの解析を行っている可能性が高い

---

## 2. データモデル

### 入力: ModelInfo
```typescript
interface ModelInfo {
  model_node: {
    uniqueId: string;       // "model.project.model_name"
    columns: Column[];       // カラム情報（DBから取得）
    path?: string;          // SQLファイルパス
  };
  compiled_sql?: string;    // コンパイル済みSQL
  raw_sql?: string;         // 生SQL（デバッグ用）
}
```

### 出力: ColumnLineage
```typescript
interface ColumnLineageResult {
  column_lineage: Array<{
    source: [string, string];  // [uniqueId, column_name]
    target: [string, string];  // [uniqueId, column_name]
    type: string;              // "select" | "non-select"
    viewsType?: string;
    viewsCode?: string;
  }>;
  errors?: string[];
}
```

### リクエスト（Legacy API用）
```typescript
{
  model_dialect: string;          // "bigquery", "snowflake" 等
  model_info: ModelInfo[];        // モデル情報リスト
  upstream_expansion: boolean;
  upstream_models: string[];
  targets: Array<{ uniqueId: string; column_name: string }>;
  selected_column: { model_node: Node; column: string };
  session_id: string;
  show_indirect_edges: boolean;
  event_type: string;
}
```

---

## 3. UI/UX

### Select Link vs Non-Select Link
- **Select Link（実線）**: SELECT文を通じた直接的なデータフロー
  - 例: `SELECT a.id FROM table_a a` → id は table_a.id から直接来る
- **Non-Select Link（点線）**: WHERE/JOIN/HAVING等の条件句での参照
  - 例: `WHERE a.status = 'active'` → status はフィルタリングに使われるが出力ではない

### 操作方法
1. モデルリネージュ表示状態で「Details」をクリック
2. カラム一覧からカラム名を選択
3. 選択カラムの上流・下流がハイライト表示
4. カラムにコード変換があればアイコンで表示

---

## 4. vizdbtへの示唆

### @altimateai/dbt-integration の利用可能性
- npmパッケージとして公開されているため、Node.js環境からは利用可能
- ただしPythonベースのvizdbtから直接利用するのは難しい
- ライセンス確認が必要

### 代替アプローチ
dbt Power Userの実装から学べるポイント:
1. **compiled SQLの取得が核心**: manifest.jsonのcompiled_codeまたはdbt compileで取得
2. **スキーマ情報はDBから取得**: catalog.jsonまたはinformation_schemaクエリ
3. **SQLダイアレクト指定が必須**: BigQuery/Snowflake等の方言対応
4. **Select/Non-Select Linkの区別**: WHERE/JOIN等の条件句を別扱い
5. **エフェメラルモデルの展開**: コンパイル後SQLに含まれる

### sqlglotでの再現可能性
dbt Power Userの`computeColumnLineage()`と同等の機能は、sqlglotの`lineage()`関数で概ね再現可能:
- `lineage()` はカラムのソースを再帰的に追跡
- SELECT句の直接参照 vs WHERE/JOIN句の間接参照の区別も可能
- スキーマ情報を渡すことで`SELECT *`の展開にも対応

---

## 5. 参考リンク

- [dbt Power User Column Lineage ドキュメント](https://docs.myaltimate.com/test/lineage/)
- [dbt Power User GitHub](https://github.com/AltimateAI/vscode-dbt-power-user)
- [@altimateai/dbt-integration npm](https://www.npmjs.com/package/@altimateai/dbt-integration)
- [dbtLineageService.ts ソースコード](https://github.com/AltimateAI/vscode-dbt-power-user/blob/master/src/services/dbtLineageService.ts)
