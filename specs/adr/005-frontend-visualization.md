# ADR-005: フロントエンドフレームワーク・可視化ライブラリの選択

- **ステータス**: 採用
- **日付**: 2026-03-06
- **決定者**: プロジェクトオーナー

## コンテキスト

vizdbtのブラウザUIでモデルDAGとカラムレベルリネージュを可視化する必要がある。カラムリネージュでは、テーブルノード内の個別カラム間をエッジで接続する「ポートベース」のレイアウトが求められる。

フレームワーク選定と可視化ライブラリ選定の2つの決定を行った。

---

## Part 1: フロントエンドフレームワーク

### 検討した選択肢

#### React ★採用

- 最も広く使われるUIライブラリ（React 19対応済み）
- **React Flow (@xyflow/react) v12**: カラムリネージュに最適なノード/エッジグラフライブラリ
  - ELK.js + 複数ハンドル（ポート）の公式サンプル（`elkjs-multiple-handles`）が存在
  - カスタムノード、Handle（ポート）、ミニマップ、ズーム、パン標準装備
- バンドルサイズ: react + react-dom ~45KB, @xyflow/react ~80-120KB, elkjs ~140-160KB（合計~270-325KB gzip）
- Bun公式にReactアプリビルドガイドあり、`bun build --compile`での埋め込み実績あり
- エコシステム・情報量が最大

#### Svelte

- コンパイラベースでランタイム極小（~2-3KB）。Svelte 5安定版リリース済み
- **Svelte Flow (@xyflow/svelte) v1.5**: React Flowと同一チーム（xyflow）が開発、機能パリティ達成済み
- ELK.jsとの公式サンプルもあり、技術的にはカラムリネージュに対応可能
- バンドルサイズはReactより~40KB小さい
- **懸念点**:
  - Svelte Flowの歴史が浅い（v1.0が最近リリース）
  - 情報量がReact Flowの方が圧倒的に多い（StackOverflow・ブログ記事・事例）
  - OSSコントリビューター母数がReactより少ない
  - 複数source handleでのELK.jsポジション計算問題の報告あり（GitHub Discussion #4248）

#### Remix

- Remix v2の後継は**React Router v7**としてリリース済み（loader/action/SSR/ファイルベースルーティング）
- Remix v3はReactを捨ててPreactフォークを採用（React Flowが使えない）
- **vizdbtに不適切な理由**:
  - vizdbtは1ページのSPA。Remixの主要機能（loader, action, SSR）はすべて不要
  - 既にBun HTTPサーバーがあるのにRemixのサーバーランタイムが追加される（二重サーバー）
  - `bun build --compile`での埋め込みが困難（複雑なビルド出力構造）
  - ルーティングが必要になった場合はReact Router v7をライブラリモードで使えば十分

#### HTMX

- サーバーからHTML断片を返すHypermedia Driven Application方式。本体14KB
- **vizdbtに致命的に不適な理由**:
  - SVG/Canvas操作機能がなく、React Flow相当の代替ライブラリが存在しない
  - ポートベースレイアウト、ズーム、パン、ドラッグ、ハイライトはHTMXの守備範囲外
  - HTMXを採用してもグラフ部分は別のJSライブラリが必要 →「HTMX + 生JS」の二重管理になり、React Flow単独より複雑化
  - HTMX公式も「リッチなインタラクティブUI（グラフエディタ等）が必要な場合はそれに適した技術を使うべき」と明言

### 比較表

| 評価軸 | React | Svelte | Remix | HTMX |
|--------|:-----:|:------:|:-----:|:----:|
| グラフ可視化ライブラリ | ◎ | ○ | ○ | × |
| ELK.jsポートベースレイアウト | ◎ 公式サンプルあり | ○ 公式サンプルあり | ○ React経由 | × |
| カラムリネージュ適性 | ◎ | ○ | ○ | × |
| バンドルサイズ | △ ~270-325KB | ○ ~40KB小さい | △ オーバーヘッド | ◎ 14KB（グラフ別途） |
| Bun単一バイナリ埋込 | ○ | ○ | △ | ○ |
| エコシステム・情報量 | ◎ | △ | ○ | △ |
| TypeScript型共有 | ◎ | ○ | ○ | △ |

### 決定

**Reactを採用する。**

### 理由

1. **React Flow + ELK.jsの`elkjs-multiple-handles`公式サンプル**がカラムリネージュUIにそのまま適用可能。プロトタイプ構築が最速
2. **エコシステム・情報量が最大**: 問題発生時の解決速度に直結
3. **バンドルサイズの差（~40KB）はユーザー体験にほぼ影響しない**: vizdbtはローカルCLIツールでネットワーク越しの配信ではない
4. **Bun公式サポート**: Reactアプリビルド・バイナリ埋め込みの実績が豊富

---

## Part 2: 可視化ライブラリ

### 検討した選択肢

#### React Flow + ELK.js ★採用

- **React Flow (@xyflow/react)**: Reactネイティブのノード/エッジベースグラフライブラリ
  - カスタムノード定義が容易（テーブル+カラム一覧をノード内に表現）
  - Handle（ポート）によるカラム単位のエッジ接続
  - ミニマップ、ズーム、パン等のインタラクション標準装備
- **ELK.js**: Eclipse Layout KernelのJS移植
  - 階層型（Layered）レイアウトが非常に優秀
  - **ポート単位でのエッジ接続をネイティブサポート** → カラムリネージュに最適

#### Cytoscape.js

- フレームワーク非依存、豊富なレイアウトアルゴリズム内蔵
- **デメリット**: React統合にラッパー必要、カスタムUIの柔軟性がReact Flowに劣る

#### D3.js

- 極めて高い自由度（SVG/Canvas直接操作）
- **デメリット**: 学習コスト高い、ノード/エッジのインタラクションを一から実装が必要

### 決定

**React Flow + ELK.js を採用する。**

### 理由

1. **ポートベースレイアウト**: ELK.jsのポート機能がカラムリネージュのエッジ配線に最適
2. **React統合**: バックエンドと同じTypeScriptで型共有が可能
3. **カスタムノード**: テーブルヘッダー + カラム一覧をReactコンポーネントとして自由に設計
4. **公式サンプル**: `elkjs-multiple-handles`がそのままvizdbtのカラムリネージュに適用可能

---

## TUIアプローチについて

ターミナル内での表示（Textual, Rich, graph-easy等）も検討したが、カラムレベルリネージュのインタラクティブな可視化にはブラウザUIが適切と判断。`vizdbt` コマンドでブラウザを自動起動する方式を採用する。

---

## 参考

- [フロントエンドフレームワーク選定 技術調査](../search/frontend_framework.md)
- [カラムリネージュ技術調査](../search/column_lineage_technical.md) — セクション4, 5
- [React Flow](https://reactflow.dev/)
- [React Flow ELK.js Multiple Handles Example](https://reactflow.dev/examples/layout/elkjs-multiple-handles)
- [Svelte Flow](https://svelteflow.dev)
- [ELK.js](https://github.com/kieler/elkjs)
- [HTMX - When to use hypermedia?](https://htmx.org/essays/when-to-use-hypermedia/)
