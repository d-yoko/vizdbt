# ADR-004: dbt manifest.json互換性方針

- **ステータス**: 採用
- **日付**: 2026-03-06
- **決定者**: プロジェクトオーナー

## コンテキスト

dbt-coreのバージョンによってmanifest.jsonのスキーマが異なる。vizdbtがどの範囲をサポートするかを決める必要がある。

## dbt-coreバージョンとmanifest schemaの対応

| dbt-core | manifest schema | 主な変更点 |
|----------|----------------|-----------|
| 1.0 | v4 | manifest.json初期安定版 |
| 1.1 | v5 | metrics追加 |
| 1.2 | v6 | metrics v2 |
| 1.3 | v7 | **`compiled_sql` → `compiled_code` にリネーム** |
| 1.4 | v8 | exposures強化 |
| 1.5 | v9 | groups, access modifiers |
| 1.6 | v10 | semantic models, saved queries |
| 1.7 | v11 | unit tests |
| 1.8〜1.10 | v12 | microbatch incremental, fixtures |
| 1.11 | v12 | UDFサポート、catalogs.yml、Python 3.9終了 |
| Fusion 2.0 | v20 | Rust製エンジン独自スキーマ |

### dbt-core v1.11の調査結果

- manifest schemaはv12のまま（v1.8〜v1.10と同一）
- `run_started_at` がmanifestメタデータに追加
- `catalogs.yml` パーシング（Iceberg catalog統合向け、CLLとは無関係）
- UDF（ユーザー定義関数）が新リソースタイプとして追加
- カラムmeta/tagsのconfigからテストへの伝播
- **ネイティブなカラムレベルリネージュは依然として未搭載**（Cloud/Fusion限定）

## 検討した選択肢

### A. v4〜v12（dbt 1.0〜1.11）全対応

- 最大の互換性
- v4〜v6は`compiled_sql`フィールド名が異なる
- v4〜v6を使うdbt 1.0〜1.2は既にEOL
- 古いスキーマ対応のコードが複雑化

### B. v7〜v12（dbt 1.3〜1.11）対応 ★採用

- `compiled_code`フィールドが統一された v7 以降をサポート
- 現在アクティブにサポートされているdbtバージョンをカバー
- `compiled_sql`へのフォールバックも最小限の対応で済む

### C. v12のみ（dbt 1.8〜1.11）

- 最新のみ対応で実装がシンプル
- dbt 1.5〜1.7ユーザーを切り捨て

## 決定

**manifest schema v7〜v12（dbt-core 1.3〜1.11）をサポートする。**

## 実装方針

- `compiled_code` フィールドを参照（v7〜v12で統一されたフィールド名）
- v7未満はサポート対象外（エラー終了）
- `catalog.json` は任意（存在すればスキーマ情報として精度向上に利用）
- manifest v12のUDFリソースタイプは初期バージョンではスキップ
- Fusion v20スキーマは FusionAdapter 側で対応（ArtifactsAdapterのスコープ外）

## 理由

1. dbt 1.3以降は`compiled_code`フィールドが統一されており、パース処理がシンプル
2. dbt 1.0〜1.2は既にEOLで、新規ユーザーが使用する可能性は低い
3. v7〜v12の範囲でカバーすれば、実質的にアクティブユーザーの大半をサポートできる
4. v1.11でもカラムレベルリネージュはOSS版に含まれないため、vizdbtの存在意義は維持

## 参考

- [カラムリネージュ技術調査](../search/column_lineage_technical.md) — セクション3.1〜3.4にバージョン対応詳細
