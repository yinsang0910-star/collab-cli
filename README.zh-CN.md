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
  <p align="center">一套通用协议 + CLI 工具，让 Claude Code、Reasonix、WorkBuddy、Cursor、Codex 等任何 AI agent 都能在同一个项目里分工合作、共享记忆、互相通信。</p>
</p>

<br/>

---

## 🤔 你是否遇到过这些问题？

| 问题 | 场景 |
|:--|:--|
| 😵 **信息不同步** | Claude Code 改了代码，WorkBuddy 不知道，重复实现了一遍 |
| 🔄 **重复对话** | 每次开新会话都要重新解释项目背景、架构、之前的决策 |
| 🚫 **权限混乱** | 执行 agent 不小心改了不该改的配置文件 |
| 📨 **沟通断层** | 给另一个 agent 发了审查请求，但对方根本没看到 |
| 📝 **记忆膨胀** | 共享文档越来越长，每次启动都要读几百行，浪费 token |

**collab-cli 解决了所有这些问题。**

<br/>

## ✨ 核心特性一览

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   🪪 工牌系统        给每个 agent 签发身份，L0-L4 五级权限       │
│   🧠 三层记忆        活记忆(80行) + 片段(50行) + 归档(自动)     │
│   📋 任务看板        创建→分配→执行→审查→完成，全生命周期       │
│   📬 消息收件箱      P0-P3 优先级，关联任务，需回复标记          │
│   🤝 握手协议        每次启动自动：读状态→领工牌→查消息→看任务   │
│   💓 心跳监控        长驻 agent 的 inbox 自动巡检               │
│   ⚡ 冲突仲裁        乐观锁 + 自动检测 + 总工裁定               │
│   🔌 MCP 服务器      插件化集成，12 个结构化工具                 │
│   🌐 LAN 节点        跨设备局域网协作                           │
│   🔄 自动同步        SHARD + tasks 每 10 秒同步                 │
│   🚀 安装向导        单机/多机模式引导式初始化                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

<br/>

## 🚀 30 秒快速体验

```bash
# 第 1 步：安装
npm i -g collab-cli

# 第 2 步：在你的项目里初始化
cd my-awesome-project
collab init --project "我的项目"

# 第 3 步：给 agent 签发工牌
collab badge issue claude-01 --role L4 --assigned-by user     # Claude = 总工
collab badge issue reasonix-01 --role L2 --assigned-by user   # Reasonix = 贡献者

# 第 4 步：模拟协作
collab task create "实现用户登录" --assignee claude-01 --priority P0
collab inbox send --from claude-01 --to reasonix-01 --title "请审查登录模块" --priority P1 --needs-reply
collab handshake claude-01   # Claude 进入时自动读取一切
```

运行 `collab status` 看全局：

```
📋 协作体系状态 — 我的项目
──────────────────────────────────────────────────

📝 SHARD (L0 活记忆): 13/80 行

🪪 工牌 (2 个):
   claude-01: L4 (user)
   reasonix-01: L2 (user)

📋 任务: 1 总计
   IN_PROGRESS: 0 | ASSIGNED: 1

📬 Inbox: 1 条未读
   reasonix-01: 1 未读 (P0:0 P1:1)

🧠 记忆: L1 0 个文件, L2 归档 0 个
```

<br/>

## 🎯 这是给谁用的？

| 你是... | 你能得到... |
|:--|:--|
| 🧑‍💻 **同时用多个 AI 编程工具的开发者** | 所有 agent 共享同一份项目状态，不再重复对话 |
| 🏗️ **搭建 AI 团队的架构师** | 标准化的角色权限、任务分发、审查流程 |
| 🔬 **做 AI agent 研究的人** | 一套可复用的多 agent 协作协议参考实现 |
| 🤖 **开发 AI agent 的人** | 通过 MCP 插件让你的 agent 即插即用地加入任何协作体系 |

<br/>

## 📖 一个完整的真实场景

> **场景**：你正在开发一个电商平台，用 Claude Code 写后端 API，用 Reasonix 做代码审查，用一个定时任务 agent 跑夜间批处理。

### 第 1 步：初始化项目

```bash
collab init --project "电商平台"
```

这会在项目下创建 `.shared/` 目录，包含所有协作文件。

### 第 2 步：签发工牌

```bash
# Claude 是总工（L4），拥有全部权限
collab badge issue claude-01 --role L4 --assigned-by user

# WorkBuddy 是执行者（L1），只能写自己的任务
collab badge issue workbuddy-01 --role L1 --assigned-by user

# Reasonix 是审查者（L3），可以审批任务
collab badge issue reasonix-01 --role L3 --assigned-by user
```

### 第 3 步：总工分配任务

```bash
# Claude（总工）给 WorkBuddy 分配任务
collab task create "商品搜索优化" \
  --assignee workbuddy-01 \
  --priority P1 \
  --deadline "2026-06-09T09:30:00+08:00" \
  --by claude-01

# Claude 给自己分配任务
collab task create "支付模块重构" \
  --assignee claude-01 \
  --priority P0 \
  --by user
```

### 第 4 步：跨 agent 通信

```bash
# WorkBuddy 完成任务后，发消息给 Claude 请求审查
collab inbox send \
  --from workbuddy-01 \
  --to claude-01 \
  --title "搜索优化脚本已完成，请审查" \
  --priority P1 \
  --type review_request \
  --body "脚本位于 services/search.py，已通过本地测试" \
  --task T-001 \
  --needs-reply
```

### 第 5 步：Claude 下次启动时自动感知

Claude Code 打开项目时，握手协议自动执行：

```
🤝 握手完成
🪪 工牌: L4 总工 | 📬 未读: 1条(P1) | 📋 活跃任务: 2个
⚠️ 有 1 条 P1 未读消息需优先处理: "搜索优化脚本已完成，请审查"
```

**不需要你手动告诉 Claude "WorkBuddy 给你发了消息"——它自己就知道。**

### 第 6 步：审查通过

```bash
# Claude 审查后，更新任务状态
collab task update T-001 REVIEW --by claude-01 --note "代码质量良好"
collab task update T-001 DONE --by user --note "用户确认"

# 回复发件人
collab inbox send \
  --from claude-01 \
  --to workbuddy-01 \
  --title "审查通过" \
  --type response \
  --body "代码质量良好，已合并" \
  --task T-001
```

<br/>

## 🏗️ 架构总览

```
你的项目/
├── .shared/                        ← 协作体系根目录
│   ├── MANIFEST.md                    系统声明 + 角色定义
│   ├── SHARD.md                       L0 活记忆（每个 agent 必读，≤80行）
│   ├── BADGE-claude-01.md             Claude 的工牌
│   ├── BADGE-workbuddy-01.md          WorkBuddy 的工牌
│   ├── inbox/
│   │   ├── claude-01/                 Claude 的收件箱
│   │   │   └── 001-审查请求.md
│   │   └── workbuddy-01/             WorkBuddy 的收件箱
│   ├── tasks/
│   │   ├── T-001-搜索优化.md          任务文件（含状态机+进度日志）
│   │   └── T-002-支付重构.md
│   ├── memory/                        L1 记忆片段（按主题，≤50行/文件）
│   │   ├── decisions.md               决策记录
│   │   ├── lessons.md                 经验教训
│   │   └── architecture.md            架构说明
│   ├── archive/                       L2 归档（按日期，自动压缩）
│   └── conflicts/                     冲突记录（等待仲裁）
│
├── .claude/CLAUDE.md                ← Claude Code 握手指令
├── .reasonix/system.md              ← Reasonix 握手指令
└── reasonix.toml                    ← Reasonix MCP 插件配置
```

<br/>

## 🪪 工牌权限详解

```
L4 总工 ──────┬── 全部读写 + 分发任务 + 升降级 + 管理工牌
              │
L3 审查者 ────┤── 审批任务 + 写 SHARD + 写记忆
              │
L2 贡献者 ────┤── 写记忆 + 提交审查申请
              │
L1 执行者 ────┤── 写自己的任务 + 写 inbox
              │
L0 观察者 ────┴── 只读（不能改任何文件）
```

- 同一 agent 不同会话可以持有**不同工牌**
- 没有总工时，第一个进入的 agent 自荐，用户确认
- 工牌在会话结束时自动失效

<br/>

## 🧠 记忆衰减机制

```
                 写入时
                   │
                   ▼
           ┌──────────────┐
           │   SHARD.md   │  ← L0: 只记录"此刻为真"的事实
           │   (≤80 行)   │     每个 agent 必读
           └──────┬───────┘
                  │
        超过 80 行 或 任务完成时
                  │
                  ▼
           ┌──────────────┐
           │   memory/    │  ← L1: 按主题拆分
           │  (≤50行/文件)│     decisions / lessons / architecture
           └──────┬───────┘
                  │
          每周 或 L1 超限时
                  │
                  ▼
           ┌──────────────┐
           │   archive/   │  ← L2: 按日期压缩
           │  (≤50行/天)  │     只在需要追溯时查阅
           └──────────────┘
```

**效果**：新 agent 进入时只需读 80 行就了解全貌，而不是 800 行。

<br/>

## 🔌 Agent 接入指南

### Claude Code（一行命令）

```bash
cat node_modules/collab-cli/src/templates/CLAUDE_PROTOCOL.md >> .claude/CLAUDE.md
```

Claude Code 每次启动自动执行握手，读 SHARD → 领工牌 → 查 inbox → 看任务。

### Reasonix（三种方式）

**方式 A：MCP 插件（推荐，最强集成）**

在 `reasonix.toml` 中加：

```toml
[[plugins]]
name = "collab"
type = "stdio"
command = "collab"
args = ["mcp"]
```

Reasonix 自动获得 12 个工具（`mcp__collab__inbox_check`、`mcp__collab__task_create` 等），原生调用。

**方式 B：自定义命令**

```bash
mkdir -p .reasonix/commands
cp node_modules/collab-cli/src/templates/reasonix-commands/collab.md .reasonix/commands/
```

输入 `/collab handshake` 触发握手。

**方式 C：协议注入**

```bash
mkdir -p .reasonix
cp node_modules/collab-cli/src/templates/REASONIX_PROTOCOL.md .reasonix/system.md
```

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

## 📬 消息系统

### 发送消息

```bash
collab inbox send \
  --from claude-01 \
  --to workbuddy-01 \
  --title "紧急：修复支付超时" \
  --priority P0 \
  --type task \
  --body "支付接口超时未返回结果，订单卡在待支付状态" \
  --task T-003 \
  --needs-reply
```

### 检查未读

```bash
$ collab inbox check workbuddy-01

📬 未读消息:

| ID     | 优先级 | 类型 | 来自      | 标题                  | 需回复 |
|--------|--------|------|-----------|----------------------|:------:|
| MSG-001| P0     | task | claude-01 | 紧急：修复支付超时    |   ✅   |
```

### 消息类型

| 类型 | 用途 |
|:--|:--|
| `task` | 分配任务 |
| `review_request` | 请求审查 |
| `approval` | 审批通过/拒绝 |
| `question` | 提问 |
| `notification` | 通知 |
| `response` | 回复 |

<br/>

## 💓 心跳监控

为长时间运行的 agent 提供 inbox 巡检：

```bash
# 长驻模式 — 每 5 分钟检查一次
collab heartbeat workbuddy-01

# 单次检查 — 适合脚本和 CI
collab heartbeat claude-01 --once
# exit 0 = 无消息
# exit 2 = 有高优先级消息（P0/P1）

# 自定义间隔
collab heartbeat claude-01 --interval 60  # 每分钟
```

通知输出格式（机器可解析）：

```
[COLLAB_HEARTBEAT] {"type":"new_message","agentId":"claude-01","message":{"id":"MSG-001","priority":"P0",...}}
🚨 新消息: [P0] workbuddy-01 → 紧急：修复支付超时 (需回复)
```

<br/>

## ⚡ 冲突仲裁

当两个 agent 同时修改同一个文件时：

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

<br/>

## 🌐 LAN 节点 — 跨设备协作

不同设备上的 agent 可以通过局域网协作。UDP 自动发现，零配置。

| 文件 | 同步？ | 方式 |
|:--|:--:|:--|
| `SHARD.md` | ✅ | 版本号推送，新版本赢 |
| `tasks/` | ✅ | 状态机合并，更"前进"的状态赢 |
| `inbox/` | ❌ | 每台设备独立 |

```bash
# 安装向导
collab setup --devices 2 --device-1 "A:codex-1@Codex" --device-2 "B:codex-2@Codex"

# 设备 A
collab node start --agents codex-1

# 设备 B
collab node start --agents codex-2 --token <token>
collab node pull --host 192.168.1.100 --port 9527 --token <token>
```

<br/>

## 🆚 和其他方案的对比

| 特性 | 手动协调 | Git 分支 | **collab-cli** |
|:--|:--:|:--:|:--:|
| 实时消息传递 | ❌ | ❌ | ✅ |
| 角色权限控制 | ❌ | 分支级 | 文件级 |
| 共享记忆 | 口头描述 | commit message | 结构化三层记忆 |
| 任务生命周期 | 口头分配 | PR/Issue | 内置状态机 |
| 新 agent 加入成本 | 重新解释一切 | clone 仓库 | 握手协议自动对齐 |
| 跨 agent 类型 | 需要适配 | 通用 | 通用（纯文件协议） |
| Token 消耗 | 每次重读全部 | N/A | ≤80 行活记忆 |

<br/>

## 🛠️ 开发

```bash
# 克隆仓库
git clone https://github.com/yinsang0910-star/collab-cli.git
cd collab-cli

# 安装依赖
npm install

# 运行测试（64 个，全部通过）
npm test

# 本地开发链接
npm link
```

### 项目结构

```
collab-cli/
├── bin/collab.js              CLI 入口（19 个子命令）
├── src/
│   ├── commands/              命令实现
│   │   ├── init.js            初始化 + 迁移
│   │   ├── status.js          全局状态
│   │   ├── badge.js           工牌管理
│   │   ├── task.js            任务生命周期
│   │   ├── inbox.js           消息收发
│   │   ├── memory.js          记忆衰减
│   │   ├── conflict.js        冲突仲裁
│   │   ├── heartbeat.js       心跳监控
│   │   └── mcp-server.js      MCP 服务器
│   ├── core/                  核心模块
│   │   ├── protocol.js        握手协议 + 权限
│   │   ├── shard.js           SHARD 管理
│   │   ├── fs-lock.js         乐观锁
│   │   └── yaml.js            Frontmatter 引擎
│   ├── templates/             协议模板
│   │   ├── CLAUDE_PROTOCOL.md
│   │   ├── REASONIX_PROTOCOL.md
│   │   ├── CURSOR_PROTOCOL.md
│   │   ├── CODEX_PROTOCOL.md
│   │   └── AGENT_PROTOCOL.md
│   └── utils/                 工具函数
├── package.json               collab-cli@1.0.5
├── README.md                  英文
├── README.zh-CN.md            中文
├── README.ja.md               日文
└── README.ko.md               韩文
```

<br/>

## 📄 License

MIT — 随便用，商用也行。

<br/>

---

<p align="center">
  如果这个项目对你有帮助，给个 ⭐ 吧！
</p>
