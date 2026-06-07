<p align="center">
  <a href="./README.md">English</a> | <strong>中文</strong> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/collab-cli?color=cb3837&labelColor=161b22&logo=npm" alt="npm"/>
  <img src="https://img.shields.io/npm/dm/collab-cli?color=3fb950&labelColor=161b22" alt="downloads"/>
  <img src="https://img.shields.io/github/stars/yinsang0910-star/collab-cli?color=dbab09&labelColor=161b22&logo=github" alt="stars"/>
  <img src="https://img.shields.io/npm/l/collab-cli?color=8b949e&labelColor=161b22" alt="license"/>
  <img src="https://img.shields.io/badge/tests-95%20passing-brightgreen?labelColor=161b22" alt="tests"/>
</p>

<br/>

<p align="center">
  <h1 align="center">🤝 collab-cli</h1>
  <p align="center"><strong>让多个 AI agent 像真实团队一样协作</strong></p>
  <p align="center">一套通用协作协议 + CLI 工具，支持 Claude Code、Reasonix、Codex、WorkBuddy、Cursor 等任何 AI agent —— 单机或局域网多设备均可使用。</p>
</p>

<br/>

---

## 目录

- [你是否遇到过这些问题？（为什么需要这个）](#你是否遇到过这些问题)
- [这是什么？](#这是什么)
- [两种模式：单机 vs 多设备](#两种模式)
- [工作原理（协议与机制）](#工作原理)
- [快速开始](#快速开始)
- [核心概念](#核心概念)
- [完整演练](#完整演练)
- [Agent 接入](#agent-接入)
- [LAN 节点（跨设备）](#lan-节点)
- [CLI 命令参考](#cli-命令参考)
- [架构](#架构)
- [开发](#开发)

---

## 🤔 你是否遇到过这些问题？ {#你是否遇到过这些问题}

如果你同时使用多个 AI 编程工具，大概率遇到过这些：

| 问题 | 实际场景 |
|:--|:--|
| 😵 **信息不同步** | Claude Code 改了 API，WorkBuddy 不知道——又实现了一遍 |
| 🔄 **重复对话** | 每次开新会话都要从头解释项目背景、架构、之前的决策 |
| 🚫 **权限混乱** | 执行 agent 不小心改了不该改的配置文件 |
| 📨 **消息丢失** | 给另一个 agent 发了审查请求，但它根本没看到——没有通知，没有检查 |
| 📝 **记忆膨胀** | 共享文档越来越长，每次启动都要读几百行，浪费 token |
| 🐌 **手动协调** | 每个跨 agent 任务都需要你传话、开会话、手动触发执行 |

**collab-cli 解决了所有这些问题。** 它给每个 agent 提供共享记忆、消息收件箱、任务看板和握手协议——让它们能自己协作，而不用你当路由器。

<br/>

## 这是什么？ {#这是什么}

**collab-cli 解决一个简单的问题：多个 AI agent 在同一个项目里工作时，彼此不知道对方在干什么。**

没有 collab-cli 时：

```
Claude Code 会话 1  →  改了 API
Claude Code 会话 2  →  不知道，又改了一遍
WorkBuddy           →  跑夜间任务，没看到变更
你（人类）           →  每次都要从头解释一遍
```

有 collab-cli 时：

```
Claude Code  →  写入 .shared/SHARD.md："API 已改为 v2"
WorkBuddy    →  读 SHARD.md："哦，API 改了，我更新任务"
你           →  什么都不用解释
```

**本质上就是一个共享文件夹（`.shared/`）+ 一套所有 agent 都遵守的协议。** 单机模式下不需要服务器、不需要网络。

<br/>

## 两种模式：单机 vs 多设备 {#两种模式}

collab-cli 有**两种工作模式**。根据你的 agent 运行在哪里来选择：

### 模式 1：单机（大多数用户）

```
你的电脑
├── .shared/              ← 一个共享文件夹，所有 agent 读写这里
│   ├── SHARD.md             当前项目状态（≤80行）
│   ├── BADGE-claude-01.md   Claude 的身份和权限
│   ├── BADGE-workbuddy-01   WorkBuddy 的身份和权限
│   ├── inbox/               agent 之间的消息
│   ├── tasks/               任务看板
│   └── memory/              知识片段
├── Claude Code           ← 读 .shared/
├── WorkBuddy             ← 读 .shared/
└── Codex                 ← 读 .shared/
```

**什么时候用**：所有 agent 在同一台电脑上。这是最常见的场景。

**怎么运作**：纯文件系统。agent 直接读写 `.shared/` 下的文件。零网络、零服务器、零配置。

### 模式 2：多设备（局域网）

```
电脑 A (192.168.1.100)               电脑 B (192.168.1.101)
├── .shared/                         ├── .shared/
│   ├── SHARD.md  ←──── 同步 ────→  │   ├── SHARD.md
│   ├── tasks/   ←──── 同步 ────→   │   ├── tasks/
│   ├── inbox/codex-1/ (仅自己)     │   ├── inbox/codex-2/ (仅自己)
│   └── BADGE-*.md                  │   └── BADGE-*.md
├── collab node :9527  ←── HTTP ──→ ├── collab node :9527
└── Codex-1                          └── Codex-2
```

**什么时候用**：你的 agent 在不同的电脑上，且在同一个 WiFi/局域网内。

**怎么运作**：每台电脑运行一个 `collab node`（轻量 HTTP 服务器）。节点通过 UDP 广播自动发现彼此。SHARD.md 和 tasks 每 10 秒同步一次。inbox 消息实时推送。

### 我该用哪种模式？

| 你的场景 | 模式 | 命令 |
|:--|:--|:--|
| 所有 agent 在一台电脑上 | **单机** | `collab setup --devices 1` |
| agent 在 2+ 台电脑上，同一局域网 | **多设备** | `collab setup --devices 2` |
| agent 在不同网络（如家里和公司） | 暂不支持 | 用 git 同步作为替代方案 |

<br/>

## 工作原理（协议与机制） {#工作原理}

### 通信协议

collab-cli 使用**四种不同的协议**，根据场景自动选择：

| 协议 | 端口 | 用途 | 使用场景 |
|:--|:--|:--|:--|
| **文件系统** | 无 | SHARD、tasks、badge、memory | 单机模式（始终使用） |
| **UDP 广播** | 9528 | 节点自动发现 | 仅多设备模式 |
| **HTTP REST** | 9527 | 消息路由、SHARD 同步、tasks 同步 | 仅多设备模式 |
| **MCP (JSON-RPC)** | stdio | Reasonix/Claude Desktop 插件集成 | 可选 |

### 核心原则：文件即协议

整个系统建立在**带 YAML frontmatter 的纯 Markdown 文件**上。任何能读写文件的 agent 都能参与。不需要特殊 SDK，不需要 API 客户端，没有运行时依赖。

```yaml
---
id: MSG-001
from: claude-01
to: workbuddy-01
priority: P1
status: unread
---

# 请审查登录模块

代码在 src/auth/login.py
```

这就是一条消息的样子。它就是一个文件。任何文本编辑器都能读，任何 AI agent 都能解析。

### 核心原则：基于角色的权限控制

每个 agent 加入项目时获得一张**工牌**。工牌定义了 agent 能做什么、不能做什么：

```
L4 总工 ──────┬── 全部读写 + 分发任务 + 管理工牌
              │
L3 审查者 ────┤── 审批任务 + 写 SHARD + 写记忆
              │
L2 贡献者 ────┤── 写记忆 + 提交审查申请
              │
L1 执行者 ────┤── 写自己的任务 + 写 inbox
              │
L0 观察者 ────┴── 只读（不能改任何文件）
```

同一 agent 的不同会话可以持有不同工牌。工牌在会话结束时自动失效。

### 核心原则：三层记忆 + 自动衰减

为防止记忆膨胀（每个 agent 读几百行），记忆分为三层：

```
L0  SHARD.md     ← "此刻为真的事实"（≤80行，每个 agent 必读）
L1  memory/       ← "我们做过的决定"（按主题，每个 ≤50 行）
L2  archive/       ← "以前发生的事"（按日期，只在需要追溯时查阅）
```

当 SHARD 超过 80 行时，旧条目自动移入 archive/。**新 agent 只需读 80 行就能了解全貌。**

### 核心原则：任务状态机

每个任务遵循严格的生命周期：

```
DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                                  ↓
                               REWORK → IN_PROGRESS
```

任务不能跳过 REVIEW。总工审查后，用户最终确认。

### 核心原则：启动握手

每个 agent 进入项目时必须执行握手：

```
Step 1: 读 MANIFEST.md   → 系统规则
Step 2: 读 SHARD.md      → 当前状态（≤80行）
Step 3: 读 BADGE-{id}.md → 你的身份和权限
Step 4: 检查 inbox       → 未读消息
Step 5: 检查 tasks       → 你的活跃任务
Step 6: 输出摘要         → 然后响应用户
```

这确保没有 agent 在不了解当前上下文的情况下开始工作。

<br/>

## 快速开始 {#快速开始}

### 方式 A：安装向导（推荐）

```bash
npm i -g collab-cli

# 单机模式 — 直接用
collab setup --devices 1 --project "我的项目"

# 多设备模式 — 生成每台设备的启动指令
collab setup --devices 2 \
  --project "我的项目" \
  --device-1 "设备A:codex-1@Codex" \
  --device-2 "设备B:codex-2@Codex"
```

向导会：
1. 初始化 `.shared/` 目录及所有必需文件
2. 为所有 agent 签发工牌
3. 生成每台设备的启动指令
4. 创建 `peers.yaml` 局域网配置（仅多设备模式）

### 方式 B：手动设置

```bash
npm i -g collab-cli

# 初始化
cd my-project
collab init --project "我的项目"

# 签发工牌
collab badge issue claude-01 --role L4 --assigned-by user
collab badge issue workbuddy-01 --role L2 --assigned-by user

# 配置 agent 指令
cat node_modules/collab-cli/src/templates/CLAUDE_PROTOCOL.md >> .claude/CLAUDE.md

# 开始协作
collab task create "第一个任务" --assignee claude-01 --priority P0
collab inbox send --from claude-01 --to workbuddy-01 --title "你好" --priority P1
```

<br/>

## 核心概念 {#核心概念}

### 🪪 工牌 — Agent 身份与权限

每个 agent 加入项目时获得一张工牌。工牌定义角色、权限和工作范围。

### 📬 Inbox — 结构化消息

agent 之间通过结构化消息通信，支持优先级（P0-P3）、类型（task/review/approval/question）和需回复标记。

### 📋 任务 — 生命周期管理

任务遵循状态机：DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE。只有负责人能改状态，完成需要总工审查 + 用户确认。

### 🧠 记忆 — 三层自动衰减

L0 SHARD（活记忆，≤80行）→ L1 memory（片段，≤50行/文件）→ L2 archive（按日期压缩）。防止记忆膨胀，同时保留历史。

### 🤝 握手 — 自动上下文加载

每个 agent 启动时读 SHARD + 工牌 + inbox + 任务。不需要手动解释。

<br/>

## Agent 间指令——不需要用户介入 {#agent-指令}

**之前**：用户告诉 A → A 发 inbox → 用户打开 B → B 读 inbox → B 执行
**现在**：A 发指令 → B 自动执行 → 结果自动回传给 A

```
Agent A                                    Agent B
   │                                          │
   │  collab cmd send --to B                   │
   │  "运行 factor_pipeline.py"                │
   │──────────────────────────────────────────►│
   │                                          │
   │                                    自动执行
   │                                          │
   │  ◄──────── 结果: "3个因子通过" ───────────│
```

### 指令类型

| 类型 | 用途 | 自动执行？ |
|:--|:--|:--:|
| `command` | 执行一个操作 | ✅ (P1-P3) |
| `review` | 审查任务 | ✅ |
| `notify` | 仅通知 | ✅ |
| `approve` | 审批通过 | ❌ (需用户) |
| `reject` | 打回重做 | ❌ (需用户) |

```bash
collab cmd send --from claude-01 --to workbuddy-01 \
  --type command --instruction "运行 factor_pipeline.py" --priority P1

collab cmd list --to workbuddy-01 --status pending
collab cmd exec --agent workbuddy-01
```

## 自审查——提交前自动检查 {#自审查}

agent 完成任务后，自动审查再提交给用户。

```bash
# 自审（P2+ 任务）
collab review self T-001 --agent claude-01

# 多维度审查
collab review create --task T-001 --by claude-01 --checks code_quality,test_coverage

# 提交审查结果
collab review submit RVW-xxx code_quality --reviewer reasonix-01 --passed true --score 85
```

审查通过 → 提交给用户确认
审查失败 → 打回重做 + 附带具体问题

<br/>

## Agent 接入 {#agent-接入}

| Agent | 接入方式 | 文件 |
|:--|:--|:--|
| **Claude Code** | 追加到 `.claude/CLAUDE.md` | `CLAUDE_PROTOCOL.md` |
| **Reasonix** | 复制到 `.reasonix/system.md` 或 MCP 插件 | `REASONIX_PROTOCOL.md` |
| **WorkBuddy** | 追加到 `.workbuddy/memory/MEMORY.md` | `AGENT_PROTOCOL.md` |
| **Cursor** | 合并到 `.cursor/rules` | `CURSOR_PROTOCOL.md` |
| **Codex** | 复制为 `AGENTS.md` | `CODEX_PROTOCOL.md` |
| **任意 Agent** | 放在项目根目录 | `AGENT_PROTOCOL.md` |

详见 [templates/](./src/templates/) 目录。

<br/>

## LAN 节点（跨设备） {#lan-节点}

### 多设备同步原理

```
┌──────────────────────────────────────────────────────────────────┐
│                      多设备架构                                   │
│                                                                  │
│  设备 A                                     设备 B               │
│  ┌─────────────────┐                       ┌─────────────────┐  │
│  │ collab node     │   UDP 广播             │ collab node     │  │
│  │ HTTP :9527      │◄─────────────────────►│ HTTP :9527      │  │
│  │ UDP  :9528      │   （自动发现）          │ UDP  :9528      │  │
│  └────────┬────────┘                       └────────┬────────┘  │
│           │                                         │           │
│           │            SHARD 同步 (10s)              │           │
│           │◄──────────── HTTP 推送 ─────────────────►│           │
│           │            Tasks 同步 (10s)              │           │
│           │◄──────────── HTTP 推送 ─────────────────►│           │
│           │            Inbox (实时)                  │           │
│           │◄──────────── HTTP 推送 ─────────────────►│           │
│           │                                         │           │
│  ┌────────┴────────┐                       ┌────────┴────────┐  │
│  │ .shared/        │                       │ .shared/        │  │
│  │ SHARD.md ✅ 同步│                       │ SHARD.md ✅ 同步│  │
│  │ tasks/ ✅ 同步  │                       │ tasks/ ✅ 同步  │  │
│  │ inbox/a1 ❌ 独立│                       │ inbox/a2 ❌ 独立│  │
│  └─────────────────┘                       └─────────────────┘  │
│                                                                  │
│  Codex-1                                   Codex-2              │
└──────────────────────────────────────────────────────────────────┘
```

### 哪些文件同步、哪些不同步

| 文件 | 同步？ | 协议 | 策略 |
|:--|:--:|:--|:--|
| `SHARD.md` | ✅ | HTTP 推送，每 10 秒 | 版本号：新版本赢 |
| `tasks/` | ✅ | HTTP 推送，每 10 秒 | 状态合并：更"前进"的状态赢 |
| `memory/` | ✅ | HTTP 推送 | 完整替换 |
| `inbox/` | ❌ | — | 按设备独立（每台设备只存自己 agent 的消息） |
| `MANIFEST.md` | — | 手动 | 所有设备相同（通过 git 保持同步） |
| `BADGE-*.md` | — | 手动 | 所有设备相同 |

### LAN 发现协议

1. 每个节点每 5 秒在端口 9528 广播一个 UDP 包
2. 包内容：`{ nodeId, agents: [...], apiPort }`
3. 其他节点收到广播后注册该 peer
4. 超过 15 秒没有心跳，peer 标记为离线

### 新设备首次加入

新设备加入网络时需要拉取已有数据：

```bash
collab node pull --host 192.168.1.100 --port 9527 --token <token>
```

这会从已有节点拉取当前的 SHARD.md 和所有 tasks。

<br/>

## CLI 命令参考 {#cli-命令参考}

```bash
# ── 安装向导（从这里开始）──
collab setup                                    引导式初始化
collab setup --devices 1 --project "名称"       单机模式
collab setup --devices 2 --device-1 "A:agent@Type" --device-2 "B:agent@Type"

# ── 系统 ──
collab init --project "名称"                    初始化 .shared/
collab status                                   全局状态概览
collab handshake <agent-id>                     Agent 握手检查

# ── 工牌 ──
collab badge issue <id> --role <L0-L4>          签发工牌
collab badge show <id>                          查看工牌详情
collab badge list                               列出所有工牌

# ── 任务 ──
collab task create <标题> --assignee <id>       创建任务
collab task list [--status <s>] [--assignee <id>]
collab task status <id>                         任务详情
collab task update <id> <状态>                  更新状态

# ── 消息 ──
collab inbox check <id>                         检查未读消息
collab inbox send --from <id> --to <id>         发送消息
collab inbox read <id> <msg-id>                 阅读（标记已读）
collab inbox done <id> <msg-id>                 标记完成

# ── 记忆 ──
collab memory compact                           自动归档旧条目
collab memory stats                             记忆层级统计

# ── 心跳 ──
collab heartbeat <id>                           启动持久监控
collab heartbeat <id> --once                    单次检查（exit 2 = 有 P0/P1）

# ── Agent 指令 ──
collab cmd send --from <id> --to <id>           发送指令给另一个 agent
collab cmd list [--to <id>] [--status <s>]      列出待处理指令
collab cmd exec --agent <id>                    自动执行待处理指令
collab cmd status <cmd-id>                      查看指令详情

# ── 自审查 ──
collab review self <task-id> --agent <id>       自审（自检清单）
collab review create --task <id>                创建多维度审查
collab review submit <id> <check>               提交审查结果
collab review status <id>                       查看审查状态

# ── LAN 节点 ──
collab node start [--agents <ids>] [--port N]   启动 LAN 节点
collab node pull --host <ip>                    从远程节点拉取 SHARD + tasks
collab node status                              查看节点和已发现的 peer

# ── MCP 服务器 ──
collab mcp                                      启动 MCP 服务器（stdio）
```

<br/>

## 架构 {#架构}

### 文件结构

```
.shared/
├── MANIFEST.md              系统声明 + agent 注册表 + 角色定义
├── SHARD.md                 L0 活记忆（≤80行）——当前状态
├── BADGE-{agent-id}.md      每个 agent 的工牌（多 badge 并行）
├── peers.yaml               LAN 节点配置（仅多设备模式）
├── inbox/{agent-id}/        消息收件箱（按 agent 分目录）
│   └── 001-{主题}.md        结构化消息（YAML frontmatter + Markdown body）
├── tasks/T-xxx.md           任务文件（状态机 + 进度日志）
├── memory/                  L1 记忆片段（按主题，每个≤50行）
│   ├── decisions.md         决策记录
│   ├── lessons.md           经验教训
│   └── architecture.md      架构说明
├── archive/                 L2 归档（按日期，自动压缩）
│   └── 2026-06-06.md
└── conflicts/               冲突记录（等待总工仲裁）
    └── C-{timestamp}.md
```

### 模块结构

```
collab-cli/
├── bin/collab.js              CLI 入口（20+ 子命令）
├── src/
│   ├── commands/              命令实现
│   │   ├── init.js            初始化 + 迁移
│   │   ├── setup.js           安装向导
│   │   ├── status.js          全局状态
│   │   ├── badge.js           工牌管理
│   │   ├── task.js            任务生命周期
│   │   ├── inbox.js           消息收发
│   │   ├── memory.js          记忆衰减
│   │   ├── conflict.js        冲突仲裁
│   │   ├── heartbeat.js       心跳监控
│   │   ├── node.js            LAN 节点命令
│   │   └── mcp-server.js      MCP 服务器
│   ├── core/                  核心模块
│   │   ├── protocol.js        握手协议 + 权限
│   │   ├── shard.js           SHARD 管理 + 自动归档
│   │   ├── fs-lock.js         乐观文件锁
│   │   └── yaml.js            YAML frontmatter 引擎
│   ├── node/                  LAN 节点模块
│   │   ├── discovery.js       UDP 广播节点发现
│   │   ├── server.js          HTTP API 服务器
│   │   ├── router.js          消息路由（本地/远程）
│   │   └── sync.js            跨设备 SHARD/tasks 同步
│   ├── templates/             各 agent 类型的协议模板
│   └── utils/                 时间戳 + markdown 工具
├── package.json
├── README.md                  英文
├── README.zh-CN.md            中文
├── README.ja.md               日文
└── README.ko.md               韩文
```

### 冲突仲裁（三层防护）

```
第 1 层：预防
├─ 任务 assignee 明确 → 别人不碰
├─ SHARD.md 写入前检查 last_updated_by
└─ scope 限定每个 agent 的工作目录

第 2 层：检测
├─ frontmatter 的 updated_at + updated_by
└─ 写入时乐观锁自动比对版本

第 3 层：仲裁
├─ 冲突写入 conflicts/C-{timestamp}.md
├─ 总工 24h 内裁定
└─ 总工无法裁定 → 上报用户
```

### 与其他方案的对比

| 特性 | 手动协调 | Git 分支 | **collab-cli** |
|:--|:--:|:--:|:--:|
| 实时消息传递 | ❌ | ❌ | ✅ |
| 角色权限控制 | ❌ | 分支级 | 文件级 |
| 共享记忆 | 口头描述 | commit message | 结构化三层记忆 |
| 任务生命周期 | 口头分配 | PR/Issue | 内置状态机 |
| 新 agent 加入成本 | 重新解释一切 | clone 仓库 | 握手协议自动对齐 |
| 跨设备同步 | N/A | git pull/push | 自动 HTTP 同步（10s） |
| Token 消耗 | 每次重读全部 | N/A | ≤80 行活记忆 |

<br/>

## 开发 {#开发}

```bash
git clone https://github.com/yinsang0910-star/collab-cli.git
cd collab-cli
npm install
npm test          # 95 个测试全部通过
npm link          # 本地开发
```

## 许可证

MIT

---

<p align="center">如果这个项目对你有帮助，给个 ⭐ 吧！</p>
