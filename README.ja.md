<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | <strong>日本語</strong> | <a href="./README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/collab-cli?color=cb3837&labelColor=161b22&logo=npm" alt="npm"/>
  <img src="https://img.shields.io/npm/dm/collab-cli?color=3fb950&labelColor=161b22" alt="downloads"/>
  <img src="https://img.shields.io/github/stars/yinsang0910-star/collab-cli?color=dbab09&labelColor=161b22&logo=github" alt="stars"/>
  <img src="https://img.shields.io/npm/l/collab-cli?color=8b949e&labelColor=161b22" alt="license"/>
  <img src="https://img.shields.io/badge/tests-64%20passing-brightgreen?labelColor=161b22" alt="tests"/>
</p>

<br/>

<p align="center">
  <h1 align="center">🤝 collab-cli</h1>
  <p align="center"><strong>複数のAIエージェントをリアルなチームのように協働させる</strong></p>
  <p align="center">Claude Code、Reasonix、WorkBuddy、Cursor、Codexなど、あらゆるAIエージェントが一つのプロジェクトで役割分担・記憶共有・相互通信できるユニバーサルプロトコル＋CLIツール。</p>
</p>

<br/>

---

## 🤔 こんな経験はありませんか？

| 問題 | シーン |
|:--|:--|
| 😵 **情報の非同期** | Claude Codeがコードを変更したのにWorkBuddyが知らず、同じ実装を繰り返す |
| 🔄 **繰り返しの説明** | 新しいセッションごとにプロジェクト背景・アーキテクチャ・過去の決定を再説明 |
| 🚫 **権限の混乱** | 実行エージェントが変更すべきでない設定ファイルを誤って編集 |
| 📨 **コミュニケーションの断絶** | 他エージェントにレビュー依頼を送ったが、相手が全く気づかない |
| 📝 **記憶の肥大化** | 共有ドキュメントが膨張し、毎回数百行を読み込んでトークンを浪費 |

**collab-cli はこれらすべてを解決します。**

<br/>

## ✨ コア機能一覧

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   🪪 バッジシステム    各エージェントに身分を発行、L0-L4 5段階   │
│   🧠 3層メモリ        ライブ(80行) + フラグメント(50行) + アーカイブ │
│   📋 タスクボード      作成→割当→実行→レビュー→完了、フルサイクル │
│   📬 インボックス      P0-P3優先度、タスク関連、応答必須フラグ   │
│   🤝 ハンドシェイク    起動時に自動：状態読取→バッジ取得→確認    │
│   💓 ハートビート      常駐エージェントのinbox自動巡回           │
│   ⚡ コンフリクト      楽観的ロック + 自動検出 + 総工裁定       │
│   🔌 MCPサーバー      プラグイン統合、12の構造化ツール           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

<br/>

## 🚀 30秒で体験

```bash
# Step 1: インストール
npm i -g collab-cli

# Step 2: プロジェクトで初期化
cd my-awesome-project
collab init --project "マイプロジェクト"

# Step 3: エージェントにバッジ発行
collab badge issue claude-01 --role L4 --assigned-by user     # Claude = 総工
collab badge issue reasonix-01 --role L2 --assigned-by user   # Reasonix = コントリビューター

# Step 4: 協働をシミュレーション
collab task create "ユーザーログイン実装" --assignee claude-01 --priority P0
collab inbox send --from claude-01 --to reasonix-01 --title "ログインモジュールのレビューをお願いします" --priority P1 --needs-reply
collab handshake claude-01   # Claudeが参加時に自動で全情報を読み取り
```

`collab status` で全体像を確認：

```
📋 コラボレーション状態 — マイプロジェクト
──────────────────────────────────────────────────

📝 SHARD (L0ライブメモリ): 13/80行

🪪 バッジ (2枚):
   claude-01: L4 (user)
   reasonix-01: L2 (user)

📋 タスク: 1件
   IN_PROGRESS: 0 | ASSIGNED: 1

📬 インボックス: 1件未読
   reasonix-01: 1件未読 (P0:0 P1:1)

🧠 メモリ: L1 0ファイル, L2 アーカイブ 0
```

<br/>

## 🎯 こんな方におすすめ

| あなたは... | 得られるもの... |
|:--|:--|
| 🧑‍💻 **複数のAIコーディングツールを使っている開発者** | 全エージェントが同じプロジェクト状態を共有、説明の繰り返しなし |
| 🏗️ **AIチームを構築するアーキテクト** | 標準化された役割権限・タスク配分・レビューフロー |
| 🔬 **AIエージェントの研究者** | 再利用可能なマルチエージェント協働プロトコルの参照実装 |
| 🤖 **AIエージェントを開発する人** | MCPプラグインであなたのエージェントをどこにでも即座に統合 |

<br/>

## 📖 完全なリアルシナリオ

> **シナリオ**：ECプラットフォームを開発中。Claude CodeでバックエンドAPIを書き、Reasonixでコードレビューを、スケジューラーエージェントで夜間バッチ処理を行う。

### Step 1: プロジェクト初期化

```bash
collab init --project "ECプラットフォーム"
```

### Step 2: バッジ発行

```bash
collab badge issue claude-01 --role L4 --assigned-by user     # 総工（全権限）
collab badge issue workbuddy-01 --role L1 --assigned-by user  # エグゼキューター
collab badge issue reasonix-01 --role L3 --assigned-by user   # レビュアー
```

### Step 3: 総工がタスクを配分

```bash
collab task create "商品検索の最適化" \
  --assignee workbuddy-01 --priority P1 \
  --deadline "2026-06-09T09:30:00+08:00" --by claude-01
```

### Step 4: エージェント間通信

```bash
collab inbox send \
  --from workbuddy-01 --to claude-01 \
  --title "検索最適化スクリプト完了、レビューお願いします" \
  --priority P1 --type review_request \
  --body "スクリプト: services/search.py、ローカルテスト通過済み" \
  --task T-001 --needs-reply
```

### Step 5: Claudeが次回起動時に自動認識

```
🤝 ハンドシェイク完了
🪪 バッジ: L4 総工 | 📬 未読: 1件(P1) | 📋 アクティブタスク: 2件
⚠️ P1未読メッセージが1件あります: "検索最適化スクリプト完了、レビューお願いします"
```

**「WorkBuddyからメッセージが来た」と手動で教える必要はありません——Claudeが自動で知ります。**

<br/>

## 🏗️ アーキテクチャ

```
あなたのプロジェクト/
├── .shared/                        ← コラボレーションルート
│   ├── MANIFEST.md                    システム宣言 + 役割定義
│   ├── SHARD.md                       L0ライブメモリ（必読、≤80行）
│   ├── BADGE-claude-01.md             Claudeのバッジ
│   ├── BADGE-workbuddy-01.md          WorkBuddyのバッジ
│   ├── inbox/{agent-id}/             メッセージ受信箱
│   ├── tasks/T-xxx.md               タスクファイル（ステートマシン）
│   ├── memory/                        L1メモリフラグメント
│   ├── archive/                       L2アーカイブ（自動圧縮）
│   └── conflicts/                     コンフリクト記録
├── .claude/CLAUDE.md                ← Claude Codeハンドシェイク指示
├── .reasonix/system.md              ← Reasonixハンドシェイク指示
└── reasonix.toml                    ← Reasonix MCPプラグイン設定
```

<br/>

## 🪪 バッジ権限

```
L4 総工 ──────┬── 全読み書き + タスク割当 + 昇降格 + バッジ管理
              │
L3 レビュアー ─┤── タスク承認 + SHARD書き込み + メモリ書き込み
              │
L2 コントリビューター ┤── メモリ書き込み + レビュー提出
              │
L1 エグゼキューター ──┤── 自タスク書き込み + inbox書き込み
              │
L0 オブザーバー ─────┴── 読み取り専用
```

<br/>

## 🧠 メモリ減衰メカニズム

```
           ┌──────────────┐
           │   SHARD.md   │  ← L0: 「今真実」だけを記録（≤80行）
           └──────┬───────┘
                  │ 80行超過 or タスク完了
                  ▼
           ┌──────────────┐
           │   memory/    │  ← L1: トピック別（≤50行/ファイル）
           └──────┬───────┘
                  │ 毎週 or L1超過
                  ▼
           ┌──────────────┐
           │   archive/   │  ← L2: 日付別圧縮（≤50行/日）
           └──────────────┘
```

**効果**：新エージェントは80行を読むだけで全体像を把握。

<br/>

## 🔌 エージェント統合ガイド

### Claude Code（1行）

```bash
cat node_modules/collab-cli/src/templates/CLAUDE_PROTOCOL.md >> .claude/CLAUDE.md
```

### Reasonix（3つの方法）

**方法A: MCPプラグイン（推奨）** — `reasonix.toml` に追加：

```toml
[[plugins]]
name = "collab"
type = "stdio"
command = "collab"
args = ["mcp"]
```

12のツール（`mcp__collab__inbox_check`等）をネイティブに使用可能。

**方法B: カスタムコマンド** — `/collab handshake` でハンドシェイク。

**方法C: プロトコル注入** — `.reasonix/system.md` にプロトコルを配置。

### WorkBuddy / Cursor / Codex

```bash
# WorkBuddy
cat node_modules/collab-cli/src/templates/AGENT_PROTOCOL.md >> .workbuddy/MEMORY.md

# Cursor
cat node_modules/collab-cli/src/templates/CURSOR_PROTOCOL.md >> .cursor/rules

# Codex
cp node_modules/collab-cli/src/templates/CODEX_PROTOCOL.md ./AGENTS.md
```

<br/>

## 📬 メッセージングシステム

```bash
# 送信
collab inbox send --from claude-01 --to workbuddy-01 \
  --title "緊急：ストップロス修正" --priority P0 --type task \
  --body "ストップロス発動後にポジションがクリアされていない" --needs-reply

# 確認
collab inbox check workbuddy-01

# 既読
collab inbox read workbuddy-01 MSG-001
```

| メッセージタイプ | 用途 |
|:--|:--|
| `task` | タスク割当 |
| `review_request` | レビュー依頼 |
| `approval` | 承認/却下 |
| `question` | 質問 |
| `notification` | 通知 |
| `response` | 返信 |

<br/>

## 💓 ハートビート

```bash
collab heartbeat claude-01            # 常駐モード（5分間隔）
collab heartbeat claude-01 --once     # 単一チェック（exit 2 = 高優先度）
collab heartbeat claude-01 --interval 60  # カスタム間隔
```

<br/>

## ⚡ コンフリクト解決

3層防護：予防（assignee明示）→ 検出（楽観的ロック）→ 裁定（総工が24h以内）

<br/>

## 🆚 他のソリューションとの比較

| 特徴 | 手動調整 | Gitブランチ | **collab-cli** |
|:--|:--:|:--:|:--:|
| リアルタイムメッセージ | ❌ | ❌ | ✅ |
| 役割権限制御 | ❌ | ブランチ単位 | ファイル単位 |
| 共有記憶 | 口頭 | コミットメッセージ | 構造化3層メモリ |
| タスクライフサイクル | 口頭 | PR/Issue | 組み込みステートマシン |
| 新エージェント参加コスト | 全部再説明 | clone | ハンドシェイクで自動対齐 |
| トークン消費 | 全量再読込 | N/A | ≤80行 |

<br/>

## 🛠️ 開発

```bash
git clone https://github.com/yinsang0910-star/collab-cli.git
cd collab-cli
npm install
npm test          # 64テスト全パス
npm link
```

<br/>

## 📄 License

MIT

<br/>

---

<p align="center">
  このプロジェクトが役に立ったら、⭐ をお願いします！
</p>
