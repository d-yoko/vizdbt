# ADR-001: 開発言語とランタイムの選択

- **ステータス**: 採用
- **日付**: 2026-03-06
- **決定者**: プロジェクトオーナー

## コンテキスト

vizdbtはdbt開発者向けのカラムレベルリネージュ可視化ツール。CLI + Webサーバー + ブラウザUIで構成される。開発言語とランタイムの選択がプロジェクト全体のアーキテクチャに大きく影響する。

## 検討した選択肢

### Option A: 全TypeScript（Node.js）

- フロント・バック共通のTypeScript
- @polyglot-sql/sdkでカラムリネージュ解析
- Node.jsの単一バイナリ配布は実験的機能（SEA）で不安定

### Option B: 全Python

- dbtエコシステムとの完全な親和性（sqlglot, dbt-core等）
- sqlglotは最も実績のあるカラムリネージュ実装
- フロントエンドはTypeScript必須で2言語に
- Python配布の複雑さ（venv, 依存解決）が大きな課題
- `uv pip install` で配布可能だがPython環境が前提

### Option C: Rust + TypeScript

- 最高のパフォーマンスと単一バイナリ配布
- polyglot-sqlをネイティブRustで利用可能
- 開発コストが最も高い（Rust学習コスト）
- dbtエコシステムのPythonライブラリが使えない
- manifest.json/catalog.jsonパースを自前実装

### Option D': TypeScript + Bun + Wasm ★採用

- TypeScriptのみでフルスタック開発
- @polyglot-sql/sdk（Rust→Wasm）でRust製パーサーの恩恵を享受
- `bun build --compile` で単一バイナリ配布（Rustと同等のUX）
- Bunのコールドスタート8-15ms（Rustに近い起動速度）

## 評価マトリクス

| 評価軸 | TS+Bun+Wasm(D') | Python(B) | Rust+TS(C) |
|--------|:---:|:---:|:---:|
| 開発速度 | ◎ | ○ | △ |
| カラムリネージュ精度 | ○ | ◎ | ◎ |
| パフォーマンス | ○ | △ | ◎ |
| 配布の簡便さ | ◎ | △ | ◎ |
| dbtエコシステム親和性 | △ | ◎ | △ |
| 言語統一性 | ◎ | △ | △ |
| ライブラリ成熟度 | △ | ◎ | △ |
| Fusion LSP統合 | ○ | ○ | ○ |
| 起動速度 | ◎ | △ | ◎ |

## ランタイム比較（TypeScript選択後）

TypeScriptを選択した場合のランタイム候補としてBun / Deno / Node.jsを比較した。

| 指標 | Bun | Deno | Node.js |
|------|-----|------|---------|
| コールドスタート | **8-15ms** | 40-60ms | 60-120ms |
| HTTPリクエスト/秒 | **~52,000** | ~22,000 | ~13,000 |
| 単一バイナリ配布 | ◎（`bun build --compile`） | ○（`deno compile`） | △（SEA、実験的） |
| フロントエンド埋込 | ◎（自動） | ○（`--include`） | ×（制限あり） |
| npm互換性 | ~98% | ~95% | 100% |
| TS直接実行 | ○ | ○ | △（要フラグ） |

**Bunを選択した理由**:
1. `bun build --compile` でフロントエンド込みの単一バイナリ生成が最も簡単
2. コールドスタート8-15msでRustに近い起動体験
3. HTMLインポートで関連アセットを自動バンドル
4. `bun run`, `bun test`, `bun install` がビルトイン

### Rust vs Bun の単一バイナリ比較

| | Rust | Bun (TypeScript) |
|---|---|---|
| 起動速度 | ~10ms | ~15ms（ほぼ同等） |
| バイナリサイズ | 小さい（10-30MB） | 大きい（60-100MB） |
| SQLパース | polyglot-sql (native) | @polyglot-sql/sdk (Wasm, ~1.5x遅い) |
| 開発速度 | 遅い | **速い** |
| フロントエンド統合 | rust-embed等で手動管理 | **HTMLインポートで自動埋込** |

バイナリサイズはRustが優位だが、ユーザー体験としてはほぼ同等。開発速度とフロントエンド統合でBunが大きく上回る。

## 決定

**Option D': TypeScript + Bun + @polyglot-sql/sdk（Wasm）を採用する。**

## 理由

1. **言語統一**: TypeScriptのみでフロント・バック・CLIを開発。認知コスト最小
2. **単一バイナリ配布**: `bun build --compile` でPython/Node.js環境不要の単一バイナリ
3. **Rustの恩恵**: @polyglot-sql/sdk経由でRust製SQLパーサーの性能を享受
4. **Fusion LSPは言語非依存**: JSON-RPC over stdioなのでTypeScriptから問題なく通信可能
5. **開発速度**: MVPを最速で出せる構成

## リスク

- @polyglot-sql/sdkの成熟度（652 stars, 比較的新しいプロジェクト）
- Bunのnpm互換性が100%ではない（~98%）
- バイナリサイズが大きい（60-100MB、Bunランタイム含む）
- 要PoC: @polyglot-sql/sdkのWasm埋め込みがBunバイナリで動作するか検証

## 参考

- [言語選択 技術調査](../search/language_selection.md)
- [@polyglot-sql/sdk npm](https://www.npmjs.com/package/@polyglot-sql/sdk)
- [Bun 単一バイナリドキュメント](https://bun.com/docs/bundler/executables)
