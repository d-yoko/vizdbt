# ADR-006: フロントエンド状態管理の選択

- **ステータス**: 採用
- **日付**: 2026-03-06
- **決定者**: プロジェクトオーナー

## コンテキスト

vizdbt のフロントエンドにおける状態管理の方針を決定する必要がある。React には `useState`、`useReducer`、Context API のほか、Zustand・Jotai 等の外部ライブラリ、さらに Signals のような新しいパラダイムも存在する。

## 検討した選択肢

### Option A: useState / useCallback のみ ★採用

- React 組み込みの最もシンプルな手段
- ローカル UI 状態（トグル、モーダル開閉等）に最適
- 学習コスト・導入コストがゼロ
- 状態が複雑化すると複数の `useState` が連動し、管理が困難になるリスク

### Option B: useReducer

- 複数の関連する状態を一つの reducer にまとめられる
- 状態遷移が予測しやすく、テストしやすい
- `useState` より記述量が増える
- Phase 1 の規模では過剰

### Option C: 外部ライブラリ（Zustand / Jotai）

- コンポーネント間の状態共有が容易
- ボイラープレートが少なく軽量
- 依存パッケージが増える
- Phase 1 の規模では不要

### Option D: Signals（@preact/signals-react 等）

- 細粒度のリアクティブ更新でパフォーマンスに優れる
- React の標準的なメンタルモデルから大きく逸脱する
- エコシステムが未成熟で学習コストが高い

## 使い分けガイドライン

| 状態の種類 | 推奨手段 |
|-----------|---------|
| 単純なローカル UI 状態（トグル、開閉） | `useState` |
| 複数の関連する状態・複雑な更新ロジック | `useReducer` |
| サーバーデータ（API 取得） | フェッチ関数 + `useState`（必要に応じて TanStack Query） |
| コンポーネント間の共有状態 | Context API（必要に応じて Zustand / Jotai） |
| 派生値（他の状態から計算可能） | `useMemo` で計算（状態にしない） |

## useState を避けるべきケース

1. **複数の `useState` が連動する場合** → `useReducer` にまとめる
2. **useEffect で状態を同期している場合** → 派生値として `useMemo` で計算できないか検討
3. **API データの管理が複雑化した場合** → TanStack Query 等の導入を検討

## 決定

**Phase 1 では `useState` / `useCallback` のみを使用する。Phase 3 以降で状態が複雑化した場合は `useReducer` への移行を検討する。**

## 理由

1. **Phase 1 の状態は単純**: API から取得した DAG データと React Flow のノード・エッジのみ
2. **YAGNI**: 現時点で不要な抽象化を導入しない
3. **段階的移行が容易**: `useState` → `useReducer` の移行は局所的で低リスク
4. **依存パッケージの最小化**: 外部ライブラリを入れずバイナリサイズを抑える

## 段階的移行の指針

- **Phase 1**: `useState` / `useCallback`
- **Phase 3**（モデル詳細パネル・フィルタリング追加時）: 状態の複雑さに応じて `useReducer` を導入
- **それ以降**: 実測に基づき、必要であれば Zustand 等を検討

## 参考

- [React State Management in 2025: What You Actually Need](https://www.developerway.com/posts/react-state-management-2025)
- [You Might Not Need an Effect – React](https://react.dev/learn/you-might-not-need-an-effect)
- [State Management in 2026: Redux, Context API, and Modern Patterns](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns)
- [useReducer – React](https://react.dev/reference/react/useReducer)
- [Goodbye, useState by David Khourshid](https://gitnation.com/contents/goodbye-usestate)
- [State of React 2025: State Management](https://2025.stateofreact.com/en-US/libraries/state-management/)
