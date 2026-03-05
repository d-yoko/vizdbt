# dbt Fusion 調査結果

調査日: 2026-03-06

---

## 1. dbt Fusionとは

dbt Fusionは、dbt Labsが開発したdbt Coreの**次世代エンジン**。Rustで完全に書き直されており、Pythonベースのdbt Coreと比較して大幅な性能向上を実現している。

- **GitHub**: https://github.com/dbt-labs/dbt-fusion
- **ライセンス**: ELv2（Elastic License v2） - ソース利用可能だがApache 2.0ではない
- **状態**: ベータ版（2025年5月パブリックベータ開始）
- **CLI**: `dbtf` コマンド（dbt Coreと共存可能）

### 主要な特徴
- **30x高速パース**: dbt Coreの30倍高速なパース
- **2x高速コンパイル**: コンパイルも2倍高速
- **SQL Comprehension**: SQL方言を深く理解し、静的解析を行う
- **カラムレベルリネージュ**: SQL解析に基づくカラム単位の依存関係追跡
- **単一バイナリ**: Python環境不要、スタンドアロン実行可能

---

## 2. カラムレベルリネージュ機能

### 2.1 仕組み
dbt FusionはRustベースのSQLパーサーを内蔵しており、SQLを「深く理解」する。これにより:
- コンパイル済みSQLを静的解析してカラム間の依存関係を追跡
- PIIタグ等のメタデータを上流から下流へ自動伝播
- `dbt clone` / `dbt preview` フェーズでCLL（Column-Level Lineage）分析を実行

### 2.2 利用方法

#### VSCode拡張機能経由
- View → Command Palette → `dbt: Show Column Lineage` で可視化
- Lineageタブでインタラクティブに表示
- **VSCode拡張機能はFusionエンジンが必須**（dbt Coreでは動作しない）

#### LSP（Language Server Protocol）経由
- dbt-mcp（Model Context Protocol）の `get_column_lineage` ツール
- Fusionバイナリがローカルにあればdbt Cloud不要で実行可能
- JSON-RPC over stdio/TCPで通信
- pygls.JsonRpcClientを使用

#### Fusion CLI (`dbtf`)
- `dbtf` コマンドでCLIとして利用可能
- **ただしFusion CLIにはLSP機能は含まれない**
  - 「Fusion CLI delivers dbt Fusion engine performance benefits but does not include LSP features」
  - カラムリネージュはLSP機能のため、CLIからは直接利用不可
  - LSPはVSCode拡張機能 or dbt-mcp経由で利用

---

## 3. ライセンスと利用条件

### ELv2（Elastic License v2）
- **ローカル利用は無料・無制限**: 自社内部での利用は完全に自由
- **制限**: Fusionをホスト/マネージドサービスとして第三者に提供することは不可
- Apache 2.0のdbt Coreとは異なり、完全なOSSではない（source-available）

### 無料で利用できる範囲
- Fusion CLI のインストール・利用: 無料
- VSCode拡張機能: 無料
- カラムレベルリネージュ（ローカルLSP経由）: 無料
- dbt Cloud連携: 有償

---

## 4. インストール方法

### macOS / Linux
```bash
curl -fsSL https://public.cdn.getdbt.com/fs/install/install.sh | sh -s -- --update
exec $SHELL
dbtf --version
```

### 初期設定
```bash
dbtf init        # プロジェクト初期化
dbtf debug       # 接続テスト
```

---

## 5. dbt-mcp と get_column_lineage

### dbt-mcp概要
- **GitHub**: https://github.com/dbt-labs/dbt-mcp
- **PyPI**: dbt-mcp
- MCP（Model Context Protocol）サーバーとしてdbt機能を提供

### LSPツール一覧
| ツール | 実行場所 | dbt Cloud必要性 |
|--------|---------|----------------|
| `get_column_lineage` | ローカル（Fusionバイナリ直接） | 不要 |
| `fusion.compile_sql` | dbt Cloud プロキシ | 必要 |
| `fusion.get_column_lineage` | dbt Cloud プロキシ | 必要 |

### get_column_lineage の動作
1. ローカルのdbt Fusionバイナリを検出
2. JSON-RPC over stdio/TCPでLSPサーバーに接続
3. カラムリネージュ情報をリクエスト
4. JSON形式でレスポンスを受信

### 前提条件
- dbt Fusionバイナリがインストール済みでPATHに存在すること
- Fusionバイナリであることの自動検出（v1.6.2以降）
- dbt Coreバイナリでは動作しない

---

## 6. vizdbtへの影響分析

### アプローチ比較

| アプローチ | カラムリネージュ精度 | 依存関係 | 実装難易度 |
|-----------|-------------------|---------|-----------|
| **A: sqlglot（現行案）** | 中〜高 | sqlglot（Pure Python） | 低 |
| **B: dbt Fusion LSP** | 非常に高い | dbt Fusionバイナリ | 中 |
| **C: A + Bのハイブリッド** | 最高 | sqlglot + Fusion（オプション） | 中 |

### dbt Fusionを使うメリット
1. **高精度**: dbt Labs公式のRust SQLパーサーによる解析
2. **方言対応**: dbt Fusionが対応する全方言をカバー
3. **メタデータ伝播**: PIIタグ等の自動伝播
4. **公式サポート**: dbt Labsのロードマップに沿った進化

### dbt Fusionを使うデメリット/リスク
1. **ベータ版**: まだGAではなく、APIが変わる可能性
2. **LSP経由のみ**: CLIから直接カラムリネージュを取得する公開APIがない
3. **ELv2ライセンス**: 完全なOSSではないため、配布に制約
4. **バイナリ依存**: ユーザーがFusionバイナリをインストールする必要がある
5. **LSP通信の複雑さ**: JSON-RPCでの通信実装が必要

### 推奨: ハイブリッドアプローチ（C案）
```
vizdbt
├── コアエンジン: sqlglot（デフォルト・フォールバック）
│   - Fusionなしでも動作する
│   - 基本的なカラムリネージュを提供
│
└── Fusionアダプター（オプション）
    - Fusionバイナリが検出された場合に使用
    - LSP経由で高精度カラムリネージュを取得
    - Fusionがなければsqlglotにフォールバック
```

この設計により:
- **Fusionなし**: sqlglotで基本的なカラムリネージュ（十分に実用的）
- **Fusionあり**: 高精度なカラムリネージュ（PIIタグ伝播等含む）
- ユーザーの環境に応じて最適な体験を提供

---

## 7. 参考リンク

- [dbt Fusion 公式ドキュメント](https://docs.getdbt.com/docs/fusion/about-fusion)
- [dbt Fusion GitHub](https://github.com/dbt-labs/dbt-fusion)
- [dbt Fusion インストール](https://docs.getdbt.com/docs/fusion/install-fusion-cli)
- [dbt-mcp GitHub](https://github.com/dbt-labs/dbt-mcp)
- [dbt-mcp LSPツール詳細](https://deepwiki.com/dbt-labs/dbt-mcp/2.7-dbt-lsp-tools)
- [dbt Fusion ライセンス FAQ](https://www.getdbt.com/licenses-faq)
- [dbt Fusion ライセンス解説（Driftwave）](https://driftwave.io/blog/dbt_fusion_license/)
- [カラムレベルリネージュ公式ドキュメント](https://docs.getdbt.com/docs/explore/column-level-lineage)
