<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | <strong>日本語</strong> | <a href="./README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/collab-cli?color=cb3837&labelColor=161b22&logo=npm" alt="npm"/>
  <img src="https://img.shields.io/npm/dm/collab-cli?color=3fb950&labelColor=161b22" alt="downloads"/>
  <img src="https://img.shields.io/github/stars/yinsang0910-star/collab-cli?color=dbab09&labelColor=161b22&logo=github" alt="stars"/>
  <img src="https://img.shields.io/npm/l/collab-cli?color=8b949e&labelColor=161b22" alt="license"/>
  <img src="https://img.shields.io/badge/tests-109%20passing-brightgreen?labelColor=161b22" alt="tests"/>
</p>

<br/>

<h1 align="center">🤝 collab-cli</h1>
<p align="center"><strong>クロスデバイス AIエージェント協働 + 記憶共有</strong></p>
<p align="center">異なるPC上の複数AIエージェントが、一つのチームのように働く — コンテキスト共有、直接コマンド、自動レビュー。</p>

<br/>

---

## 一言で言うと

> **異なるPCにAIエージェントがいますか？collab-cliはそれらを協働させます — 記憶を共有し、コマンドを送信し、お互いの仕事をレビュー。あなたがメッセンジャーになる必要はありません。**

<br/>

## 4つのユニークな機能

### 1. 🌐 クロスデバイス協働

**異なるPC**上のエージェントがLAN経由で自動発見・リアルタイム同期。

```
PC A (192.168.1.100)                    PC B (192.168.1.101)
┌──────────────────────┐                ┌──────────────────────┐
│  Codex-1             │   UDP自動      │  Codex-2             │
│  collab node :9527   │◄──発見──────►│  collab node :9527   │
│  SHARD ◄── 同期 ─────┼──────────────►│  SHARD               │
│  tasks ◄── 同期 ─────┼──────────────►│  tasks               │
│  inbox ◄── リアルタイム┼──────────────►│  inbox               │
└──────────────────────┘                └──────────────────────┘
```

**クラウド不要。サーバー不要。同じWi-Fiだけで動作。**

### 2. 🧠 膨張しない共有記憶

80行のファイルを読むだけでプロジェクト全体を理解。古いエントリは自動アーカイブ。新エージェントは30秒でオンボーディング。

### 3. 📨 エージェントが直接コマンド

ユーザーへの伝言は不要。AがBにコマンド送信→Bが自動実行→結果をAに返送。

### 4. 🔍 提出前の自動レビュー

コード品質・テストカバレッジ・ドキュメントを自動チェック。不合格は具体的なフィードバック付きで自動差戻し。

<br/>

## 対応エージェント

| エージェント | 統合方法 | セットアップ時間 |
|:--|:--|:--|
| **Claude Code** | `.claude/CLAUDE.md` に追記 | 1分 |
| **Reasonix** | `.reasonix/system.md` にコピー or MCPプラグイン | 1分 |
| **WorkBuddy** | `.workbuddy/memory/MEMORY.md` に追記 | 1分 |
| **Cursor** | `.cursor/rules` に統合 | 1分 |
| **Codex** | `AGENTS.md` としてコピー | 1分 |
| **任意エージェント** | プロジェクトルートに `AGENT_PROTOCOL.md` | 1分 |

**ファイルだけ。** SDK不要、ランタイム依存なし、ベンダーロックインなし。

<br/>

## 30秒で始められる

```bash
npm i -g collab-cli

# シングルPC
collab setup --devices 1 --project "マイプロジェクト"

# マルチデバイス
collab setup --devices 2 \
  --device-1 "PC-A:codex-1@Codex" \
  --device-2 "PC-B:codex-2@Codex"
```

<br/>

## 詳細ドキュメント

<details>
<summary><strong>📋 コアコンセプト</strong>（バッジ、タスク、inbox、記憶、ハンドシェイク）</summary>

### バッジ — ロールベース権限制御

| レベル | 名前 | 権限 |
|:--|:--|:--|
| L0 | オブザーバー | 読み取り専用 |
| L1 | エグゼキューター | 自タスク+inbox書き込み |
| L2 | コントリビューター | L1+メモリ書き込み+レビュー提出 |
| L3 | レビュアー | L2+タスク承認+SHARD書き込み |
| L4 | 総工 | 全権限+タスク割当+バッジ管理 |

### タスク — ライフサイクル管理

```
DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE
```

### ハンドシェイク — 自動オンボーディング

各エージェント起動時にSHARD+バッジ+inbox+タスクを自動読み取り。

</details>

<details>
<summary><strong>📨 エージェントコマンド</strong>（エージェント間直接コマンド）</summary>

```bash
collab cmd send --from claude-01 --to workbuddy-01 \
  --type command --instruction "factor_pipeline.pyを実行" --priority P1

collab cmd list --to workbuddy-01 --status pending
collab cmd exec --agent workbuddy-01
```

</details>

<details>
<summary><strong>🌐 LANノード</strong>（クロスデバイス同期詳細）</summary>

| ファイル | 同期？ | 戦略 |
|:--|:--:|:--|
| `SHARD.md` | ✅ | ベース、新しい方が勝ち |
| `tasks/` | ✅ | ステータスマージ |
| `memory/` | ✅ | 完全同期 |
| `inbox/` | ❌ | デバイスごと独立 |

```bash
collab node start --agents codex-1
collab node pull --host 192.168.1.100
collab node status
```

</details>

<details>
<summary><strong>📚 完全CLIリファレンス</strong></summary>

```bash
collab setup / init / status / handshake
collab badge issue/show/list
collab task create/list/status/update
collab inbox check/send/read/done
collab cmd send/list/exec/status
collab review create/submit/self/status
collab memory compact/stats
collab conflict list/resolve
collab heartbeat <id> [--once] [--interval N]
collab dashboard [--port N]
collab mcp
collab node start/pull/status
collab git init/sync/status
```

</details>

<br/>

## 開発

```bash
git clone https://github.com/yinsang0910-star/collab-cli.git
cd collab-cli && npm install && npm test    # 109テスト全パス
```

## ライセンス

MIT
