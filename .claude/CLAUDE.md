# vizdbt Project Instructions

## Overview
dbt のデータリネージュをブラウザで可視化する CLI ツール（TypeScript + Bun）

## Plan
- plan はプロジェクト配下の `specs/plans/` に作成すること

## Project Structure
```
vizdbt/
├── src/
│   ├── index.ts                 # エントリポイント（CLI）
│   ├── cli.ts                   # CLI 引数パース（commander）
│   ├── server.ts                # Bun HTTP サーバー
│   ├── core/
│   │   ├── types.ts             # 共有型定義
│   │   ├── manifest-parser.ts   # manifest.json パーサー
│   │   └── graph-builder.ts     # DAG グラフ構築
│   └── api/
│       ├── router.ts            # URL パースルーティング
│       └── handlers.ts          # API ハンドラ
├── ui/
│   ├── vite.config.ts
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── types.ts
│       ├── api/
│       │   └── client.ts
│       ├── components/
│       │   ├── DagGraph.tsx
│       │   └── nodes/
│       │       └── ModelNode.tsx
│       └── lib/
│           └── elk-layout.ts
├── tests/
│   └── fixtures/                # テスト用 manifest.json サンプル
├── specs/                       # 設計ドキュメント
├── build.ts                     # ビルドスクリプト
├── package.json
├── tsconfig.json
└── bunfig.toml
```

## Tech Stack
- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **CLI**: commander
- **Frontend**: React + @xyflow/react (React Flow) + elkjs
- **Frontend Build**: Vite + @vitejs/plugin-react
- **Distribution**: `bun build --compile`（単一バイナリ）

## Commands
```bash
bun install                    # 依存インストール
cd ui && bun install     # フロントエンド依存インストール
bun run --watch src/index.ts   # 開発サーバー
cd ui && bun run dev     # フロントエンド開発サーバー
bun test                       # テスト実行
bun run build.ts               # 本番ビルド
bunx tsc --noEmit              # 型チェック
```

## Coding Conventions

### General
- ES モジュール（`import`/`export`）を使用
- `any` 禁止、`strict: true`
- ファイル名: kebab-case（例: `manifest-parser.ts`）
- 型名: PascalCase（例: `DbtModelInfo`）
- 関数名: camelCase（例: `buildFullDag`）
- 定数: UPPER_SNAKE_CASE（例: `DEFAULT_PORT`）

### React
- 関数コンポーネントのみ（class コンポーネント禁止）
- 状態管理: `useState` / `useCallback` のみ（外部ライブラリ不使用）

### API
- エンドポイントは `/api/` プレフィックス
- URL パースによるルーティング（`Bun.serve()` の `routes` は不使用）
- レスポンスは JSON

## Testing
- テストランナー: `bun test`
- テストファイル: `*.test.ts`
- テストデータ: `tests/fixtures/` に配置
- テスト種別:
  - ManifestParser: 統合テスト（サンプル manifest.json）
  - GraphBuilder: ユニットテスト
  - API ハンドラ: 統合テスト

## Commit Messages
- 日本語で記述
- prefix 必須: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- 例: `feat: manifest.json パーサーを実装`

## Design Documents
- 要件定義: `specs/requirements.md`
- Phase 1 MVP 設計: `specs/design/phase1-mvp.md`
- ADR: `specs/adr/001-language-and-runtime.md` 他 5 件
- 技術調査: `specs/search/` 配下 7 件

## Key Design Decisions
- manifest v7 未満は非サポート（dbt 1.3+ 必須）。`compiled_sql` フォールバック不要
- 開発時は Vite dev サーバー → バックエンドにプロキシ（`/api` → `localhost:3456`）
- 本番時は `Bun.embeddedFiles` でフロントエンド静的ファイルを配信
- DAG エッジ構築には `parent_map` を使用（`depends_on.nodes` ではなく）
- exposure は Phase 3 以降の対応
- デフォルトポート: 3456
