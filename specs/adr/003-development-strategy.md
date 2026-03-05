# ADR-003: 開発戦略 — TypeScript MVP → 段階的Rust最適化

- **ステータス**: 採用
- **日付**: 2026-03-06
- **決定者**: プロジェクトオーナー

## コンテキスト

ADR-001でTypeScript + Bunを採用した。将来的にパフォーマンスが問題になった場合の対応方針を事前に決めておく必要がある。

## 検討した選択肢

### A. 最初からRustで重い処理を実装

- 初期段階からRust + TypeScriptの2言語構成
- 開発速度が大幅に低下
- ボトルネックが不明な段階での早期最適化

### B. TypeScript MVPを出して、必要に応じてRust化 ★採用

- MVPはTypeScriptのみで高速に開発
- リリース後に実測データでボトルネックを特定
- 特定箇所のみRust/Wasm化

### C. 全てTypeScriptのまま維持

- Rust化のオプションを捨てる
- @polyglot-sql/sdkが既にWasm経由Rustなので、多くのケースでは十分
- ただし巨大プロジェクトでの性能限界に対応できない可能性

## 決定

**Option B: TypeScript MVPを出して、実測に基づき必要箇所のみRust/Wasm化する。**

## Rust化の候補箇所と判断基準

| 処理 | Rust化の効果 | 優先度 | 判断基準 |
|------|------------|--------|---------|
| SQL解析・カラムリネージュ | 大規模（500+モデル）で顕著 | 高 | @polyglot-sql/sdkで既にWasm経由Rust。ネイティブ化で~1.5x高速化 |
| manifest.json/catalog.jsonパース | 数十MBのJSONパースが高速化 | 中 | 500モデル以下ならJS JSONパースで十分 |
| グラフ構築・探索 | depthが深い場合に効果 | 低 | JSでも十分高速 |
| HTTPサーバー | Bunが既に52k req/s | 低 | 最適化不要 |

## この方針が有効な理由

1. **MVPの開発速度が最速**: TypeScript単一言語でビルド・デバッグ・デプロイがシンプル
2. **推測ではなく実測に基づく最適化**: ボトルネックが明確になってからRust化する箇所を選べる
3. **Wasm境界が自然な分割点**: @polyglot-sql/sdkが既にRust→Wasmパターンを確立済み。同じパターンで他のモジュールもRust/Wasm化できる
4. **インターフェース設計が鍵**: LineageQueryService（ADR-002）の境界で内部実装の言語を変えてもAPI不変
5. **実質的に重い処理は既にRust**: SQL解析はMVP段階から@polyglot-sql/sdk経由でRustの恩恵を享受

## 設計上の注意点

- **LineageQueryServiceインターフェース**: この境界でTS→Rust/Wasmへの差し替えが可能
- **モジュール分離**: 重い処理は明確な関数/モジュール境界で分離しておく
- **Wasmバインディング**: 必要時に `wasm-bindgen` / `wasm-pack` でRustモジュールをWasm化し、既存TypeScriptコードから呼び出す

## フェーズ計画

```
Phase 1 (MVP): TypeScript + Bun
  → manifest読み込み + モデルDAG + ブラウザUI + 単一バイナリ配布

Phase 2: TypeScript + Wasm
  → @polyglot-sql/sdk でカラムリネージュ解析 + 可視化UI

Phase 3: Fusion統合
  → FusionAdapter + フィルタリング + モデル詳細パネル

Phase 4: パフォーマンス最適化（実測に基づく）
  → 必要箇所のRust/Wasmモジュール化
```

## 参考

- [ADR-001: 言語とランタイムの選択](./001-language-and-runtime.md)
- [ADR-002: カラムリネージュエンジン](./002-column-lineage-engine.md)
