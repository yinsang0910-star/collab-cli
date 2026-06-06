<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | <strong>日本語</strong> | <a href="./README.ko.md">한국어</a>
</p>

# collab-cli

マルチエージェントLLMチームのためのユニバーサルコラボレーションプロトコル＋CLIツール。Claude Code、Reasonix、Codex、WorkBuddy、Cursorなど、あらゆるエージェントがプロジェクトに参加し、共通プロトコルの下で協働できます。

## 対応エージェント

| エージェント | 統合方法 | プロトコルテンプレート |
|-------------|----------|----------------------|
| **Claude Code** | `.claude/CLAUDE.md` | `CLAUDE_PROTOCOL.md` |
| **Reasonix** | `.reasonix/system.md` + MCPプラグイン | `REASONIX_PROTOCOL.md` |
| **WorkBuddy** | `.workbuddy/MEMORY.md` | `AGENT_PROTOCOL.md` |
| **Cursor** | `.cursor/rules` | `CURSOR_PROTOCOL.md` |
| **Codex** | `AGENTS.md` | `CODEX_PROTOCOL.md` |
| **任意のエージェント** | ルート `COLLAB_PROTOCOL.md` | `AGENT_PROTOCOL.md` |

## クイックスタート

```bash
# インストール
npm i -g collab-cli

# プロジェクトで初期化
cd /path/to/your/project
collab init --project "マイプロジェクト"

# エージェントにバッジを発行
collab badge issue claude-01 --role L4 --assigned-by user
collab badge issue reasonix-01 --role L2 --assigned-by user

# エージェントハンドシェイク（セッションごとに1回）
collab handshake claude-01
```

## コアコンセプト

### バッジシステム

各エージェントはプロジェクト参加時にバッジを受け取り、役割と権限が定義されます。同じエージェントの異なるセッションが異なるバッジを持つことができます。

| レベル | 名前 | 権限 |
|--------|------|------|
| L0 | オブザーバー | 読み取り専用 |
| L1 | エグゼキューター | 全読み取り + 自タスク書込 + inbox書込 |
| L2 | コントリビューター | L1 + メモリ書込 + レビュー提出 |
| L3 | レビュアー | L2 + タスク承認 + SHARD書込 |
| L4 | 総工（チーフエンジニア） | 全権限 + タスク割当 + バッジ管理 |

### 記憶階層

```
L0  SHARD.md     ← ライブメモリ（≤80行）— 現在の状態、必読
L1  memory/      ← 構造化フラグメント（各≤50行）— トピック別
L2  archive/     ← 日付別圧縮履歴 — 必要な時のみ参照
```

自動減衰：SHARDが80行を超えると、古いエントリは自動的にアーカイブされます。

### タスクライフサイクル

```
DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                                  ↓
                               REWORK → IN_PROGRESS
```

タスクは総工のレビュー後、ユーザーが最終承認します。

### インボックスシステム

優先度（P0-P3）、メッセージタイプ、関連タスク、応答必須フラグを持つ構造化メッセージング。

### ハンドシェイクプロトコル

各エージェントがプロジェクトに参加した際の最初のアクション：

1. `MANIFEST.md` を読む — システムルール、エージェント登録簿
2. `SHARD.md` を読む — 現在の状態（≤80行）
3. バッジ `BADGE-{id}.md` を読む／申請する
4. `inbox/{id}/` の未読メッセージを確認
5. `tasks/` の自分のアクティブタスクを確認
6. ハンドシェイクサマリーを出力してからユーザーに応答

## CLIコマンド

```bash
# システム
collab init                           コラボレーションシステム初期化
collab status                         グローバルステータス
collab handshake <agent-id>           エージェントハンドシェイク

# バッジ
collab badge issue <id> --role <L>    バッジ発行
collab badge show <id>                バッジ表示
collab badge list                     全バッジ一覧

# タスク
collab task create <title>            タスク作成
collab task list                      タスク一覧
collab task status <id>               タスク詳細
collab task update <id> <status>      ステータス更新

# インボックス
collab inbox check <id>               未読確認
collab inbox send                     メッセージ送信
collab inbox read <id> <msg-id>       メッセージ読取
collab inbox done <id> <msg-id>       完了标记

# 記憶
collab memory compact                 記憶圧縮
collab memory stats                   記憶統計
collab memory archive <date>          日付別アーカイブ

# コンフリクト
collab conflict list                  コンフリクト一覧
collab conflict resolve <id>          コンフリクト解決

# ハートビート
collab heartbeat <agent-id>           永続監視開始
collab heartbeat <agent-id> --once    単一チェック（exit 2 = 高優先度）
collab heartbeat <agent-id> --interval 60  カスタム間隔（秒）

# MCPサーバー
collab mcp                            MCPサーバー起動（stdio JSON-RPC）
```

## ファイル構造

```
.shared/
├── MANIFEST.md              システム宣言 + エージェント登録簿
├── SHARD.md                 L0ライブメモリ（≤80行）
├── BADGE-{agent-id}.md      エージェント別バッジ（複数並行）
├── inbox/{agent-id}/        メッセージ受信箱（エージェント別ディレクトリ）
│   └── 001-{topic}.md       構造化メッセージ（frontmatter付き）
├── tasks/T-xxx.md           タスクファイル（ステートマシン + 進捗ログ）
├── memory/                  L1記憶フラグメント（トピック別、各≤50行）
│   ├── decisions.md
│   ├── lessons.md
│   └── architecture.md
├── archive/                 L2アーカイブ（日付別、各≤50行）
│   └── 2026-06-06.md
└── conflicts/               コンフリクト記録（裁定待ち）
    └── C-{timestamp}.md
```

## エージェント統合ガイド

### Claude Code

```bash
cat node_modules/collab-cli/src/templates/CLAUDE_PROTOCOL.md >> .claude/CLAUDE.md
```

### Reasonix

**方法A：プロトコル注入（推奨）**

```bash
mkdir -p .reasonix
cp node_modules/collab-cli/src/templates/REASONIX_PROTOCOL.md .reasonix/system.md
```

**方法B：カスタムコマンド**

```bash
mkdir -p .reasonix/commands
cp node_modules/collab-cli/src/templates/reasonix-commands/collab.md .reasonix/commands/
```

**方法C：MCPプラグイン（最強統合）**

`reasonix.toml` に設定：

```toml
[[plugins]]
name = "collab"
type = "stdio"
command = "collab"
args = ["mcp"]
```

Reasonixが12個のcollabツール（`mcp__collab__inbox_check`等）をネイティブに使用可能に。

### WorkBuddy

`AGENT_PROTOCOL.md` を `.workbuddy/MEMORY.md` に追記。

### Cursor

`CURSOR_PROTOCOL.md` を `.cursor/rules` に統合。

### Codex / 任意のエージェント

`CODEX_PROTOCOL.md` または `AGENT_PROTOCOL.md` をプロジェクトルートまたはエージェントの指示ファイルに配置。

## MCPサーバー

[Model Context Protocol](https://modelcontextprotocol.io/) 仕様に準拠したMCPサーバー内蔵（stdio JSON-RPC 2.0）。

| MCPツール | 機能 |
|:--|:--|
| `collab_status` | グローバルステータス |
| `collab_handshake` | エージェントハンドシェイク |
| `collab_inbox_check` | 未読メッセージ確認 |
| `collab_inbox_send` | メッセージ送信 |
| `collab_inbox_read` | メッセージ読取（既読标记） |
| `collab_task_create` | タスク作成 |
| `collab_task_list` | タスク一覧 |
| `collab_task_update` | タスクステータス更新 |
| `collab_badge_issue` | バッジ発行 |
| `collab_memory_stats` | 記憶統計 |
| `collab_memory_compact` | 記憶圧縮 |
| `collab_conflict_list` | コンフリクト一覧 |

## ハートビート

長時間実行エージェントのためのinbox監視：

```bash
collab heartbeat claude-01            # 永続モード（5分間隔）
collab heartbeat claude-01 --once     # 単一チェック
collab heartbeat claude-01 --interval 60  # カスタム間隔
```

## コンフリクト解決

3層防護：

1. **予防** — タスク `assignee` 明示、`scope` で作業ディレクトリ制限
2. **検出** — frontmatter の `last_updated_by` + `last_updated_at` 楽観的ロック
3. **裁定** — `conflicts/` に記録、総工が24時間以内に解決

## プロトコル互換性

すべてのエージェントが同じ `.shared/` ファイル構造を共有。プロトコル層は**純粋なMarkdown + YAML** — エージェント固有のメカニズムに依存しません。

- **ファイル即プロトコル** — ファイルの読み書きができるエージェントはすべて参加可能
- **CLIは利便性** — エージェントは `read_file` / `write_file` で直接操作も可能
- **MCPは拡張** — プラグインメカニズムで構造化ツール呼び出しを提供

## 開発

```bash
npm install
npm test          # 64テスト
npm link          # ローカル開発
npm publish       # npmに公開
```

## ライセンス

MIT
