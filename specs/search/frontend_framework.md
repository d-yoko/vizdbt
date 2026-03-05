# フロントエンドフレームワーク選定 技術調査

調査日: 2026-03-06

---

## 1. 比較サマリ

| 評価軸 | React | Svelte | Remix | HTMX |
|--------|:-----:|:------:|:-----:|:----:|
| グラフ可視化ライブラリ | ◎ React Flow（最も成熟） | ○ Svelte Flow（機能パリティ達成） | ○ React Flow利用可 | × 代替なし |
| ELK.jsポートベースレイアウト | ◎ 公式サンプルあり | ○ 公式サンプルあり | ○ React経由で可 | × 統合困難 |
| カラムリネージュ適性 | ◎ | ○ | ○ | × 致命的に不適 |
| バンドルサイズ | △ ~270-325KB (gzip) | ○ Svelteランタイム~3KB | △ Remix分のオーバーヘッド | ◎ 14KB（ただしグラフ別途） |
| Bun単一バイナリ埋込 | ○ 実績あり | ○ 静的ビルドなら同等 | △ 複雑なビルド出力 | ○ シンプル |
| エコシステム・情報量 | ◎ 最大 | △ 成長中だが小さい | ○ Reactベース | △ グラフ系は皆無 |
| TypeScript型共有 | ◎ | ○ | ○ | △ |
| 学習コスト | ○ | ○ Runes≒hooks | ○ React知識で可 | ○ シンプル |
| vizdbt適性 | **◎** | **○** | **△** | **×** |

---

## 2. React

### 概要
- 最も広く使われるUIライブラリ。JSX + hooksベースのコンポーネントモデル
- 最新: React 19対応済み

### グラフ可視化
- **React Flow (@xyflow/react) v12.10.1**: ノード/エッジベースグラフの定番ライブラリ
  - カスタムノード: Reactコンポーネントで自由に定義
  - Handle（ポート）: 各ノードに複数のsource/targetハンドルを配置可能
  - 標準装備: ミニマップ、ズーム、パン、ノード選択・ドラッグ
- **ELK.js公式サンプル**: `elkjs-multiple-handles`（複数ポート対応）がReact Flow公式にあり、vizdbtのカラムリネージュ要件にそのまま適用可能
- その他: Cytoscape.js（ラッパー必要）、reagraph（WebGL、不向き）、D3.js（開発コスト大）

### バンドルサイズ
| パッケージ | min+gzip |
|-----------|----------|
| react + react-dom | ~45KB |
| @xyflow/react | ~80-120KB |
| elkjs | ~140-160KB |
| **合計** | **~270-325KB** |

### Bun相性
- Bun公式にReactアプリビルドガイドあり
- `bun build --compile`での静的ファイル埋め込み実績あり（DEV Community記事、TanStack Start事例）
- ディレクトリ一括埋め込みはベータ（個別importが確実）

### メリット
1. React Flow + ELK.jsのポートベースレイアウト公式サンプルが存在（プロトタイプ最速）
2. バックエンドとTypeScript型共有
3. エコシステム・情報量が最大
4. Bun公式サポート

### デメリット
1. elkjsのバンドルサイズが大きい（GWT由来、~150KB gzip）
2. Reactランタイム自体が~45KB
3. 仮想DOM方式のため、Svelteのコンパイラ方式より実行時オーバーヘッドがある

---

## 3. Svelte

### 概要
- コンパイラベースのUIフレームワーク。ランタイムが極めて小さい
- Svelte 5（2024年10月安定版リリース）: Runesによる新リアクティビティ（$state, $derived, $effect）
- ネイティブTypeScriptサポート（プリプロセッサ不要）

### グラフ可視化
- **Svelte Flow (@xyflow/svelte) v1.5.1**: React Flowと同一チーム（xyflow）が開発
  - **React Flowと機能パリティ達成済み**: コアロジックをvanilla JSに抽象化して共有
  - カスタムノード、Handle（ポート）、ミニマップ等すべて対応
  - Svelte 5ネイティブ
- **ELK.js公式サンプル**: Svelte Flow公式ドキュメントにもELK.jsレイアウト例あり
- 注意: 複数source handleでのELK.jsポジション計算で問題報告あり（GitHub Discussion #4248、ports定義で解決可能）

### バンドルサイズ
| パッケージ | min+gzip |
|-----------|----------|
| Svelte 5 ランタイム | ~2-3KB |
| @xyflow/svelte | React版より小さい傾向（コンパイラベース） |
| elkjs | ~140-160KB（同一） |

Reactとの差は主にフレームワークランタイム部分（~40KB差）。ただしコンポーネントコード量が~137KBを超えるとSvelteのコンパイル後サイズがReactを上回る可能性がある。

### Bun相性
- Viteで静的ビルド→Bunサーバーから配信する方式はReactと同等
- SvelteKit adapter-bunでの`bun build --compile`は実験的（エラー報告あり）
- **静的ビルド方式ならSvelte固有の問題はない**

### メリット
1. バンドルサイズが小さい（単一バイナリ配布に有利）
2. Svelte FlowがReact Flowと機能パリティ達成済み
3. 実行時パフォーマンスが高い（コンパイラベース）
4. コード量が少ない（テンプレート構文がJSX+hooksより簡潔）

### デメリット
1. **エコシステム規模がReact比で小さい**: 想定外のニーズが出た場合の選択肢が少ない
2. **Svelte Flowの情報量が少ない**: React Flowの方がStackOverflow・ブログ記事が圧倒的に多い
3. **Svelte Flowの歴史が浅い**: v1.0が最近リリース。エッジケースでの問題発見リスク
4. **OSSコントリビューター確保**: Svelte開発者はReact開発者より少ない

---

## 4. Remix

### 概要
- Remix v2の正統後継は**React Router v7**としてリリース済み（3つのモード: SPA/データルーター/フルフレームワーク）
- **Remix v3はReactを捨ててPreactフォークを採用**した完全に別物のフレームワーク（2026年初頭リリース予定）

### vizdbtとの適合性: **不適切**

1. **過剰な抽象化**: vizdbtは基本的に1ページのSPA。Remixの主要機能（loader, action, SSR, ファイルベースルーティング）はすべて不要
2. **二重サーバー問題**: 既にBun HTTPサーバーがあるのにRemixのサーバーランタイムが追加される
3. **`bun build --compile`困難**: Remixのビルド出力はサーバー+クライアントの複雑な構造で単一バイナリ化が困難
4. **Remix v3はReact Flowが使えない**: ReactベースでないためReact Flowの利用不可

### 結論
vizdbtの要件に対してオーバーエンジニアリング。ルーティングが必要になった場合はReact Router v7を**ライブラリモード**で使えば十分。

---

## 5. HTMX

### 概要
- サーバーからHTML断片を返す**Hypermedia Driven Application**方式
- HTML属性（hx-get, hx-post, hx-swap等）で宣言的にAJAX通信・DOM更新
- 本体14KB（min+gzip）と極めて軽量

### vizdbtとの適合性: **致命的に不適**

1. **グラフ描画機能がない**: SVG/Canvas操作機能がなく、React Flow相当の代替ライブラリが存在しない
2. **ポートベースレイアウト不可**: カラム間エッジ接続にはReact Flow/ELK.js等の専用ライブラリが必須
3. **クライアント側インタラクション不可**: ズーム、パン、ドラッグ、ハイライトはHTMXの守備範囲外
4. **二重アーキテクチャ化**: HTMXを採用してもグラフ部分は別のJSライブラリが必要。「HTMX + 生JS」という二重管理になり、React Flow単独より複雑化

HTMX公式も「リッチなインタラクティブUI（グラフエディタ、デザインツール等）が必要な場合は、それに適した技術を使うべき」と明言している。

### HTMXが適しているケース（参考）
- CRUDアプリ、管理画面、コンテンツ管理システム
- サーバーサイドレンダリング主体でUIがシンプルなアプリケーション

---

## 6. 参考リンク

### React
- [React Flow](https://reactflow.dev/)
- [React Flow ELK.js Multiple Handles Example](https://reactflow.dev/examples/layout/elkjs-multiple-handles)
- [Bun - Build a React app](https://bun.com/docs/guides/ecosystem/react)

### Svelte
- [Svelte 5 is alive](https://svelte.dev/blog/svelte-5-is-alive)
- [Svelte Flow](https://svelteflow.dev)
- [Svelte Flow ELK.js Example](https://svelteflow.dev/examples/layout/elkjs)
- [xyflow GitHub](https://github.com/xyflow/xyflow)

### Remix
- [Merging Remix and React Router](https://remix.run/blog/merging-remix-and-react-router)
- [Remix v3 ditched React](https://blog.logrocket.com/remix-3-ditched-react/)
- [React Router v7 SPA mode](https://reactrouter.com/how-to/spa)

### HTMX
- [HTMX](https://htmx.org/)
- [When to use hypermedia?](https://htmx.org/essays/when-to-use-hypermedia/)
- [htmx-graph](https://github.com/mdo6180/htmx-graph)
