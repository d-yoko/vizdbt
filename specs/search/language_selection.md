# vizdbt 言語選択 技術調査

調査日: 2026-03-06

---

## 1. 各言語でのカラムリネージュ解析ライブラリ

### Python: sqlglot
- **成熟度**: 非常に高い（dbtエコシステムの事実上の標準）
- **カラムリネージュ**: `sqlglot.lineage()` で内蔵サポート
- **ダイアレクト**: 20以上（BigQuery, Snowflake, Postgres, Redshift, DuckDB等）
- **依存**: なし（Pure Python）

### TypeScript: @polyglot-sql/sdk
- **GitHub**: https://github.com/tobilg/polyglot (652 stars, 2026年2月活発に更新中)
- **npm**: `@polyglot-sql/sdk`
- **実装**: Rustで書かれたpolyglot-sqlのWASMバインディング
- **カラムリネージュ**: `lineage()` 関数でサポート
- **ダイアレクト**: 33（BigQuery, Snowflake, Postgres, Redshift, DuckDB等）
- **sqlglotインスパイア**: sqlglotに触発された設計、10,220のsqlglotテストケースを実行

```typescript
import { lineage } from '@polyglot-sql/sdk';

const result = lineage(
  'total',
  'SELECT o.total FROM orders o JOIN users u ON o.user_id = u.id'
);
// result.lineage.name → 'total'
// result.lineage.downstream → ソースノード情報
```

### Rust: polyglot-sql (ネイティブ)
- **crate**: `polyglot-sql`
- 上記@polyglot-sql/sdkのRustネイティブ版
- 最高のパフォーマンス
- WASMコンパイル可能

### TypeScript: @meta-sql/lineage + node-sql-parser
- カラムリネージュ専用ライブラリ
- node-sql-parserとの組み合わせ
- polyglot-sqlほどの多方言対応ではない

### TypeScript: @altimateai/dbt-integration
- dbt Power Userが使用する`computeColumnLineage()`を含む
- npmで公開されているがライセンス不明
- クローズドソースの可能性が高い

---

## 2. dbt Fusion LSPとの統合

### 重要な事実: LSPはJSON-RPC over stdio
- LSPプロトコルは**言語非依存**
- JSON-RPC 2.0でstdio/TCP通信
- **どの言語からでもFusion LSPと通信可能**

つまり、**Rustだから有利ということはない**。TypeScriptやPythonからも同様にFusion LSPと通信できる。

```
[vizdbt (任意の言語)] ←JSON-RPC over stdio→ [dbt Fusion バイナリ]
```

---

## 3. 言語選択肢の比較

### Option A: 全TypeScript構成（Node.js）

```
vizdbt
├── CLI: TypeScript (Node.js) - tsx / commander
├── カラムリネージュ: @polyglot-sql/sdk (Wasm)
├── Webサーバー: Express / Fastify / Hono
├── フロントエンド: React + TypeScript + React Flow + ELK.js
├── Fusion統合: JSON-RPCクライアント (TypeScript)
└── ビルド: Vite (フロント) + tsup/esbuild (バックエンド)
```

**メリット**:
- フロント・バック共通のTypeScript → 最小の認知コスト
- @polyglot-sql/sdkでsqlglot相当のカラムリネージュが利用可能
- 型の共有（API型定義をフロント/バックで共有）
- npm単一エコシステム
- Wasm経由でRust製パーサーの高速性を享受

**デメリット**:
- dbtエコシステムはPythonが主流（manifest.jsonパース等のPythonライブラリが使えない）
- @polyglot-sql/sdkはsqlglotほどの実績がない（まだ若いプロジェクト）
- Node.jsのランタイム依存（単一バイナリ配布が困難）

### Option B: 全Python構成

```
vizdbt
├── CLI: Python - Click / Typer
├── カラムリネージュ: sqlglot
├── Webサーバー: FastAPI
├── フロントエンド: React + TypeScript + React Flow + ELK.js（ビルド済みをバンドル）
├── Fusion統合: JSON-RPCクライアント (Python)
└── ビルド: uv (Python) + Vite (フロント)
```

**メリット**:
- dbtエコシステムとの完全な親和性（dbt-core, dbt-artifacts-parser等）
- sqlglotは最も実績のあるカラムリネージュ実装
- Pythonデータエンジニアにとって馴染みやすい

**デメリット**:
- フロントエンドはどうしてもTypeScriptになるため、2言語必要
- ビルド済みフロントエンドのバンドル管理が必要
- Python配布の複雑さ（venv, 依存解決等）

### Option C: Rust + TypeScript構成

```
vizdbt
├── CLI + コアエンジン: Rust
│   ├── カラムリネージュ: polyglot-sql (ネイティブRust)
│   ├── Webサーバー: Axum / Actix-web
│   ├── dbt artifacts パース: serde_json
│   └── Fusion統合: JSON-RPCクライアント (Rust)
├── フロントエンド: React + TypeScript + React Flow + ELK.js
└── ビルド: cargo (Rust) + Vite (フロント)
```

**メリット**:
- 最高のパフォーマンス（起動速度、解析速度）
- 単一バイナリ配布（Python/Node.js不要）
- polyglot-sql をネイティブで利用（Wasm経由より高速）
- Fusionと同じRustエコシステム（将来的な深い統合の可能性）

**デメリット**:
- 開発コストが最も高い（Rustの学習コスト）
- dbtエコシステムのPythonライブラリが使えない
- フロントエンドは結局TypeScript（2言語）
- Rustのエコシステムではdbt関連の既存ライブラリがない
- manifest.json/catalog.jsonのパースを自前実装

### Option D': TypeScript（Bun）+ Rust（Wasm）ハイブリッド ★推奨

```
vizdbt (単一バイナリ: bun build --compile)
├── CLI: TypeScript (Bun) - commander / citty
├── カラムリネージュ: @polyglot-sql/sdk (Rust→Wasmバインディング)
├── Webサーバー: Hono (Bunに最適化済み)
├── フロントエンド: React + TypeScript + React Flow + ELK.js (バイナリ埋込)
├── Fusion統合: JSON-RPCクライアント (TypeScript)
├── manifest.json パース: TypeScript (自前)
└── ビルド: bun build --compile (単一バイナリ生成)
```

**メリット**:
- 実質TypeScriptのみの開発体験
- Rust製パーサーの恩恵をWasm経由で享受
- 単一言語（TypeScript）でフルスタック
- **`bun build --compile` で単一バイナリ配布**（Rustと同等のUX）
- **コールドスタート8-15ms**（Rustに近い起動速度）
- **フロントエンドをバイナリに自動埋め込み**
- @polyglot-sql/sdkが内部的にRust→Wasmで動作するため、Rustの直接知識は不要

**デメリット**:
- @polyglot-sql/sdkの成熟度リスク
- Bunのnpm互換性が100%ではない（~98%）
- バイナリサイズが大きい（60-100MB、Bunランタイム含む）

---

## 4. Fusion LSP統合の観点

### 結論: 言語は関係ない

Fusion LSPとの通信はJSON-RPC over stdio/TCPという**標準プロトコル**で行われるため:
- Rust: `tower-lsp` クレート等
- TypeScript: `vscode-languageclient` / 自前JSON-RPC
- Python: `pygls` / 自前JSON-RPC

いずれの言語でも同等に統合可能。**RustだからFusion LSPとの統合が有利ということはない**。

---

## 5. TypeScriptランタイム比較

TypeScript構成を選択する場合、ランタイムの選択が重要。主要3候補を比較する。

### 5.1 ベンチマーク比較

| 指標 | Bun | Deno | Node.js |
|------|-----|------|---------|
| コールドスタート | **8-15ms** | 40-60ms | 60-120ms |
| HTTPリクエスト/秒 | **~52,000** | ~22,000 | ~13,000 |
| 平均レスポンス | **78ms** | 112ms | 145ms |
| エンジン | JavaScriptCore (Safari) | V8 (Chrome) + Rust | V8 (Chrome) |
| TS直接実行 | `bun index.ts` | `deno run index.ts` | 要フラグ (`--experimental-strip-types`) |
| npm互換性 | ~98% | ~95% | 100% |

### 5.2 単一バイナリ配布

vizdbtの配布方式に直結する重要ポイント。

#### Bun: `bun build --compile`
```bash
bun build --compile ./server.ts --outfile vizdbt
```
- **フロントエンドの自動埋め込み**: HTMLファイルをimportすると、関連するJS/CSS/画像を自動バンドル
- **Wasmファイルの埋め込み**: `import wasm from "./module.wasm" with { type: "file" }` で埋め込み可能
- **静的ファイル**: `Bun.embeddedFiles` APIでバイナリ内の静的ファイルにアクセス
- **クロスコンパイル**: `--target=bun-linux-x64` 等でクロスプラットフォームビルド
- **Node.js/Bun不要**: 生成されたバイナリのみで実行可能

#### Deno: `deno compile`
```bash
deno compile --allow-net --allow-read server.ts
```
- 単一バイナリ生成可能
- `--include` で静的ファイルの埋め込み可能
- パーミッションモデルにより安全
- Deno不要で実行可能

#### Node.js: `node --experimental-sea-config`
```bash
node --experimental-sea-config sea-config.json
```
- 実験的機能（SEA: Single Executable Applications）
- 設定が煩雑
- 静的ファイル埋め込みは制限あり

### 5.3 vizdbtの文脈での評価

| 評価軸 | Bun | Deno | Node.js |
|--------|:---:|:---:|:---:|
| 起動速度 | ◎ | ○ | △ |
| 単一バイナリ配布 | ◎ | ○ | △ |
| フロントエンド埋め込み | ◎ | ○ | × |
| Wasm対応 | ○ | ○ | ○ |
| npm互換性 | ○ | △ | ◎ |
| エコシステム成熟度 | ○ | ○ | ◎ |
| セキュリティモデル | △ | ◎ | △ |

### 5.4 ランタイム推奨: Bun

**vizdbtにBunを推奨する理由**:

1. **単一バイナリ配布**: `bun build --compile` でフロントエンド込みの単一バイナリを生成
   - ユーザーは `vizdbt` バイナリ1つだけインストールすればよい
   - Rustの単一バイナリ配布と同等のUX
   - `curl -fsSL ... | sh` でインストール可能な体験

2. **起動速度**: コールドスタート8-15msはRustに近い
   - `vizdbt` 実行からサーバー起動まで体感一瞬

3. **フロントエンド自動バンドル**: HTMLをimportするだけで関連アセットを自動埋め込み
   - React + React Flowのビルド済みアセットを簡単にバイナリに含められる
   - 別途バンドル管理のスクリプトが不要

4. **Wasm対応**: @polyglot-sql/sdk（Wasm）をバイナリに埋め込み可能

5. **開発体験**: `bun run`, `bun test`, `bun install` が全てビルトイン
   - TypeScriptを直接実行（トランスパイル不要）

**Bunのリスク**:
- npm互換性が100%ではない（~98%）。特定のパッケージで問題が起きる可能性
- Node.jsほどの本番実績はない（ただし2026年時点で十分成熟）
- @polyglot-sql/sdkのWasm埋め込みで問題が起きる可能性（要PoC検証）

### 5.5 Rustの単一バイナリとの比較

| | Rust | Bun (TypeScript) |
|---|---|---|
| 単一バイナリ | ○ | ○（`bun build --compile`） |
| 起動速度 | ~10ms | ~15ms（ほぼ同等） |
| バイナリサイズ | 小さい（10-30MB） | 大きい（60-100MB、Bunランタイム含む） |
| SQLパース | polyglot-sql (native) | @polyglot-sql/sdk (Wasm, ~1.5x遅い) |
| 開発速度 | 遅い | **速い** |
| フロントエンド統合 | rust-embed等で手動管理 | **HTMLインポートで自動埋込** |
| クロスコンパイル | cargo target | bun --target |

Bunの単一バイナリはRustより大きいが、ユーザー体験としてはほぼ同等。
開発速度とフロントエンド統合の容易さでBunが大きく上回る。

---

## 6. 評価マトリクス（Bunランタイム前提でOption A/Dを再評価）

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
| 将来拡張性 | ○ | ○ | ◎ |

※ Bunの単一バイナリ配布により、Option A/Dの「配布の簡便さ」が大幅向上

---

## 7. 推奨

### 第1候補: Option D'（TypeScript + Bun + Wasm）

**理由**:
1. **言語統一**: TypeScriptのみでフルスタック開発、認知コスト最小
2. **単一バイナリ**: `bun build --compile` でフロントエンド込みの単一バイナリ配布
3. **Rustの恩恵**: @polyglot-sql/sdk経由でRust製パーサーの性能を享受
4. **起動速度**: コールドスタート8-15ms、Rustとほぼ同等
5. **React Flowとの親和性**: フロントエンドとバックエンドが同じ言語
6. **Fusion LSP統合**: JSON-RPCクライアントはTypeScriptで十分実装可能
7. **開発体験**: `bun run`, `bun test` がビルトイン、TS直接実行

**リスク**:
- @polyglot-sql/sdkの成熟度（652 stars, 活発に開発中だが比較的新しい）
- Bunのnpm互換性（~98%、特定パッケージで問題が起きる可能性）
- 要PoC: @polyglot-sql/sdkのWasm埋め込みがBunバイナリで動作するか検証

### 第2候補: Option C（Rust + TypeScript）
パフォーマンスとバイナリサイズを最重視する場合。開発コスト高い。

### 第3候補: Option B（Python）
dbtエコシステムとの親和性・sqlglotの実績を最重視する場合。配布が課題。

---

## 8. 開発方針: TypeScript MVP → 段階的Rust最適化

### 8.1 方針

MVPはTypeScript（Bun）のみで構築し、リリース後に実測データに基づいてボトルネックをRust/Wasm化する。

```
Phase 1 (MVP): TypeScript + Bun + @polyglot-sql/sdk (Wasm)
    ↓ リリース・実測
Phase 2+: ボトルネック箇所をRust/Wasmモジュールに置換
```

### 8.2 この方針が有効な理由

1. **MVPの開発速度が最速**: TypeScript単一言語でビルド・デバッグ・デプロイがシンプル
2. **推測ではなく実測に基づく最適化**: ボトルネックが明確になってからRust化する箇所を選べる
3. **Wasm境界が自然な分割点**: @polyglot-sql/sdkが既にWasmパターンを確立済み
4. **型の安定性**: MVP段階でインターフェース（LineageQueryService等）を固めておけば、内部実装の言語を変えてもAPI不変
5. **実質的に重い処理は既にRust**: @polyglot-sql/sdkはRust→Wasmなので、SQL解析はMVP段階からRustの恩恵を享受

### 8.3 Rust化の候補箇所と判断基準

| 処理 | Rust化の効果 | 優先度 | 判断基準 |
|------|------------|--------|---------|
| SQL解析・カラムリネージュ | 大規模プロジェクト（500+モデル）で顕著 | 高 | @polyglot-sql/sdkで既にWasm経由Rust。ネイティブ化で~1.5x高速化 |
| manifest.json/catalog.jsonパース | 数十MBのJSONパースが高速化 | 中 | 500モデル以下ならJS JSONパースで十分 |
| グラフ構築・探索 | depthが深い場合に効果 | 低 | JSでも十分高速 |
| HTTPサーバー | Bunが既に52k req/s | 低 | 最適化不要 |

### 8.4 設計上の注意点

- **LineageQueryServiceインターフェースが鍵**: このインターフェースの境界でTS→Rust/Wasmへの差し替えが可能
- **モジュール分離**: 重い処理は明確な関数/モジュール境界で分離しておく
- **Wasmバインディング作成**: 必要時に `wasm-bindgen` / `wasm-pack` でRustモジュールをWasm化し、既存のTypeScriptコードから呼び出す

---

## 9. 参考リンク

- [polyglot-sql GitHub](https://github.com/tobilg/polyglot) - Rust/Wasm SQLトランスパイラ
- [@polyglot-sql/sdk npm](https://www.npmjs.com/package/@polyglot-sql/sdk) - TypeScript SDK
- [Polyglot API Documentation](https://polyglot.gh.tobilg.com/) - API仕様
- [sqlglot GitHub](https://github.com/tobymao/sqlglot) - Python SQLパーサー
- [node-sql-parser](https://github.com/taozhi8833998/node-sql-parser) - TypeScript SQLパーサー
- [@meta-sql/lineage](https://github.com/nickBes/meta-sql) - TypeScriptリネージュ
- [sqlparser-rs](https://github.com/apache/datafusion-sqlparser-rs) - Rust SQLパーサー（リネージュなし）
- [Bun 単一バイナリドキュメント](https://bun.com/docs/bundler/executables) - bun build --compile
- [Bun vs Deno vs Node.js 2026ベンチマーク](https://dev.to/jsgurujobs/bun-vs-deno-vs-nodejs-in-2026-benchmarks-code-and-real-numbers-2l9d)
- [Hono](https://hono.dev/) - Bun最適化済みWebフレームワーク
