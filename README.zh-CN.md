<p align="center">
  <a href="./README.md">English</a> | <strong>中文</strong> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a>
</p>

# collab-cli — 多智能体协作任务体系

一套给 LLM 多智能体的**通用协作协议 + CLI 工具**。不论 Claude Code、Reasonix、Codex、WorkBuddy、Cursor 还是任何其他 agent，只要安装进入协作体系，都能按照统一协议执行任务。

## 支持的 Agent

| Agent | 接入方式 | 协议模板 |
|-------|----------|----------|
| **Claude Code** | `.claude/CLAUDE.md` | `CLAUDE_PROTOCOL.md` |
| **Reasonix** | `.reasonix/system.md` + MCP 插件 | `REASONIX_PROTOCOL.md` |
| **WorkBuddy** | `.workbuddy/MEMORY.md` | `AGENT_PROTOCOL.md` |
| **Cursor** | `.cursor/rules` | `CURSOR_PROTOCOL.md` |
| **Codex** | `AGENTS.md` | `CODEX_PROTOCOL.md` |
| **任意 Agent** | 项目根目录 `COLLAB_PROTOCOL.md` | `AGENT_PROTOCOL.md` |

## 快速开始

```bash
# 安装（二选一）
npm i -g collab-cli          # 从 npm 安装
# 或
cd collab && npm link         # 本地开发安装

# 在你的项目目录初始化
cd /path/to/your/project
collab init --project "项目名称"

# 为 agent 签发工牌
collab badge issue claude-01 --role L4 --assigned-by user
collab badge issue reasonix-01 --role L2 --assigned-by user

# Agent 启动握手（每个新会话执行一次）
collab handshake claude-01
```

## 核心概念

### 工牌 (Badge)

每个 agent 进入项目时签发一张工牌，定义角色和权限。同一 agent 的不同会话可以持有不同工牌。

| 级别 | 名称 | 核心权限 |
|------|------|----------|
| L0 | 观察者 | 只读 |
| L1 | 执行者 | 读全部 + 写自己的任务 + 写 inbox |
| L2 | 贡献者 | L1 + 写记忆 + 提交审查 |
| L3 | 审查者 | L2 + 审批任务 + 写 SHARD |
| L4 | 总工 | 全部权限 + 分发任务 + 管理工牌 |

### 记忆层级 (Memory)

```
L0  SHARD.md     ← 活记忆（≤80行）——当前状态，每个 agent 必读
L1  memory/      ← 结构化片段（每个≤50行）——按主题拆分
L2  archive/     ← 按日期压缩的历史——只在需要追溯时查阅
```

自动衰减：SHARD 超过 80 行时，旧记录自动归入 archive/。运行 `collab memory compact` 触发。

### 任务生命周期 (Task)

```
DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                                  ↓
                               REWORK → IN_PROGRESS
```

任务完成后由总工审查，用户最终确认。

### 消息系统 (Inbox)

Agent 之间通过 inbox 目录发送结构化消息，支持优先级（P0-P3）、消息类型、关联任务、需回复标记。

### 握手协议 (Handshake)

每个 agent 进入项目后的**第一个动作**：

1. 读 `MANIFEST.md` — 系统规则、agent 注册表
2. 读 `SHARD.md` — 当前状态（≤80行，30秒读完）
3. 读/申请工牌 `BADGE-{id}.md`
4. 检查 `inbox/{id}/` 未读消息
5. 检查 `tasks/` 中自己的活跃任务
6. 输出握手摘要后响应用户

## CLI 命令

```bash
# 体系管理
collab init                           初始化协作体系
collab status                         全局状态总览
collab handshake <agent-id>           Agent 启动握手
collab version                        查看版本

# 工牌管理
collab badge issue <id> --role <L>    签发工牌
collab badge show <id>                查看工牌
collab badge list                     列出所有工牌

# 任务管理
collab task create <title>            创建任务
collab task list                      列出任务
collab task status <id>               任务详情
collab task update <id> <status>      更新状态

# 消息系统
collab inbox check <id>               检查未读
collab inbox send                     发送消息
collab inbox read <id> <msg-id>       阅读消息
collab inbox done <id> <msg-id>       标记完成

# 记忆管理
collab memory compact                 压缩记忆
collab memory stats                   记忆统计
collab memory archive <date>          归档指定日期

# 冲突管理
collab conflict list                  列出冲突
collab conflict resolve <id>          解决冲突

# 心跳监控
collab heartbeat <agent-id>           启动长驻监控（每5分钟检查inbox）
collab heartbeat <agent-id> --once    单次检查（不长驻，退出码2=有高优先级）
collab heartbeat <agent-id> --interval 60  自定义间隔（秒）

# MCP Server
collab mcp                            启动 MCP server（stdio JSON-RPC）
```

## 文件结构

```
.shared/
├── MANIFEST.md              系统声明 + Agent 注册表 + 角色定义
├── SHARD.md                 L0 活记忆（≤80行）——当前状态
├── BADGE-{agent-id}.md      每个 agent 的工牌（多 badge 并行）
├── inbox/{agent-id}/        消息收件箱（按 agent 分目录）
│   └── 001-{主题}.md        结构化消息（含 frontmatter）
├── tasks/T-xxx.md           任务文件（含状态机 + 进度日志）
├── memory/                  L1 记忆片段（按主题，每个≤50行）
│   ├── decisions.md
│   ├── lessons.md
│   └── architecture.md
├── archive/                 L2 归档（按日期，每个≤50行）
│   └── 2026-06-06.md
└── conflicts/               冲突记录（等待总工仲裁）
    └── C-{timestamp}.md
```

## Agent 接入指南

### Claude Code

将 `src/templates/CLAUDE_PROTOCOL.md` 内容合并到 `.claude/CLAUDE.md`：

```bash
cat node_modules/collab-cli/src/templates/CLAUDE_PROTOCOL.md >> .claude/CLAUDE.md
```

Claude Code 会在每个新会话自动执行握手，读 SHARD、领工牌、查 inbox。

### Reasonix

**方式 A：协议注入（推荐）**

将 `src/templates/REASONIX_PROTOCOL.md` 内容写入 `.reasonix/system.md`：

```bash
mkdir -p .reasonix
cp node_modules/collab-cli/src/templates/REASONIX_PROTOCOL.md .reasonix/system.md
```

**方式 B：自定义命令**

```bash
mkdir -p .reasonix/commands
cp node_modules/collab-cli/src/templates/reasonix-commands/collab.md .reasonix/commands/
```

用户输入 `/collab handshake` 即可触发握手。

**方式 C：MCP 插件（最强集成）**

在 `reasonix.toml` 中配置：

```toml
[[plugins]]
name = "collab"
type = "stdio"
command = "collab"
args = ["mcp"]
```

Reasonix 将自动获得 12 个 collab 工具（`mcp__collab__inbox_check` 等），无需走 bash。

### WorkBuddy

将 `AGENT_PROTOCOL.md` 内容追加到 `.workbuddy/MEMORY.md`。WorkBuddy 已有 `.shared/` 的使用习惯，加上握手流程即可完整接入。

### Cursor

将 `CURSOR_PROTOCOL.md` 内容合并到 `.cursor/rules`。

### Codex / 任意 Agent

将 `CODEX_PROTOCOL.md` 或 `AGENT_PROTOCOL.md` 放在项目根目录，或写入 agent 的指令文件。

## MCP Server

collab-cli 内置 MCP server，遵循 [Model Context Protocol](https://modelcontextprotocol.io/) 规范（JSON-RPC 2.0 over stdio）。

### 暴露的工具

| MCP 工具 | 功能 |
|:--|:--|
| `collab_status` | 全局状态总览 |
| `collab_handshake` | Agent 启动握手 |
| `collab_inbox_check` | 检查未读消息 |
| `collab_inbox_send` | 发送消息 |
| `collab_inbox_read` | 阅读消息（标记已读） |
| `collab_task_create` | 创建任务 |
| `collab_task_list` | 列出任务 |
| `collab_task_update` | 更新任务状态 |
| `collab_badge_issue` | 签发工牌 |
| `collab_memory_stats` | 记忆统计 |
| `collab_memory_compact` | 记忆压缩 |
| `collab_conflict_list` | 冲突列表 |

### 手动测试

```bash
# 启动 server
collab mcp

# 发送 initialize 请求
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | collab mcp

# 列出工具
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | collab mcp
```

## 心跳机制

为长时间运行的 agent 提供 inbox 监控：

```bash
# 长驻模式 — 每 5 分钟检查一次，有新消息时通知
collab heartbeat claude-01

# 单次模式 — 检查一次后退出（exit 0=无消息，exit 2=有高优先级）
collab heartbeat claude-01 --once

# 自定义间隔 — 每 60 秒检查一次
collab heartbeat claude-01 --interval 60
```

通知格式（供 agent 解析）：
```
[COLLAB_HEARTBEAT] {"type":"new_message","agentId":"claude-01","message":{"id":"MSG-001","priority":"P0",...}}
🚨 新消息: [P0] workbuddy-01 → 紧急审查请求 (需回复)
```

## 冲突仲裁

三层防护：

1. **预防** — 任务 `assignee` 明确，`scope` 限定工作目录
2. **检测** — frontmatter 的 `last_updated_by` + `last_updated_at` 乐观锁
3. **仲裁** — 写入 `conflicts/` 目录，总工 24h 内裁定，无法裁定时上报用户

## 协议兼容性

所有 agent 共享同一套 `.shared/` 文件结构，协议层是**纯 Markdown + YAML**，不依赖任何特定 agent 的机制。核心设计原则：

- **文件即协议** — 任何能读写文件的 agent 都能参与协作
- **CLI 是便利** — agent 也可以直接 `read_file` / `write_file` 操作 `.shared/`
- **MCP 是增强** — 通过插件机制获得结构化工具调用能力

## 开发

```bash
# 安装依赖
npm install

# 运行测试（64 个）
npm test

# 本地链接
npm link

# 发布
npm publish
```

## License

MIT
