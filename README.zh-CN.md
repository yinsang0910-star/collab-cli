<p align="center">
  <a href="./README.md">English</a> | <strong>中文</strong> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a>
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
<p align="center"><strong>跨设备 AI agent 协作 + 共享记忆</strong></p>
<p align="center">不同电脑上的多个 AI agent，像一个团队一样工作——共享上下文、直接指挥、自动审查。</p>

<br/>

---

## 一句话说清楚

> **你有多个 AI agent 在不同电脑上工作？collab-cli 让它们自己协作——共享记忆、互相下指令、审查彼此的工作——不用你当传话筒。**

<br/>

## 4 个别人做不到的事

### 1. 🌐 跨设备协作

**不同电脑**上的 agent 通过局域网自动发现彼此，实时同步。

```
电脑 A (192.168.1.100)                  电脑 B (192.168.1.101)
┌──────────────────────┐                ┌──────────────────────┐
│  Codex-1             │   UDP 自动     │  Codex-2             │
│  collab node :9527   │◄── 发现 ────►│  collab node :9527   │
│                      │                │                      │
│  SHARD.md ◄── 同步 ──┼──────────────►│  SHARD.md            │
│  tasks/  ◄── 同步 ───┼──────────────►│  tasks/              │
│  inbox/  ◄── 实时 ───┼──────────────►│  inbox/              │
└──────────────────────┘                └──────────────────────┘
```

**不需要云服务器。不需要公网。只要同一个 WiFi。**

### 2. 🧠 共享记忆不膨胀

所有 agent 读同一个 80 行文件就能了解全貌。旧内容自动归档。新 agent 30 秒上手。

```
L0  SHARD.md     ← "此刻为真的事实"    （≤80 行，每个 agent 必读）
L1  memory/       ← "我们做过的决定"    （每个 ≤50 行，按主题拆分）
L2  archive/      ← "以前发生的事"      （按日期自动压缩）
```

**效果**：3 个 agent、2 周历史，启动时仍然只读 80 行。

### 3. 📨 Agent 互相指挥

不用你传话了。A 直接给 B 下指令，B 自动执行，结果回传给 A。

```
Agent A                                  Agent B
   │                                        │
   │  "运行 factor_pipeline.py"              │
   │───────────────────────────────────────►│
   │                                        │
   │                                  自动执行
   │                                        │
   │  ◄──────── "3 个因子通过" ─────────────│
```

**P0 指令需要用户确认。** 其他的全部自动。

### 4. 🔍 提交前自动审查

agent 完成工作后自动审查——代码质量、测试覆盖、文档完整性。不通过的自动打回并附带具体问题。

```
Agent 完成任务
       │
       ▼
  自审（代码 + 测试 + 文档）
       │
   ┌───┴───┐
  通过    不通过 → 自动打回 + 反馈
   │
   ▼
  提交给用户最终确认
```

<br/>

## 支持所有主流 Agent

| Agent | 接入方式 | 设置时间 |
|:--|:--|:--|
| **Claude Code** | 追加到 `.claude/CLAUDE.md` | 1 分钟 |
| **Reasonix** | 复制到 `.reasonix/system.md` 或 MCP 插件 | 1 分钟 |
| **WorkBuddy** | 追加到 `.workbuddy/memory/MEMORY.md` | 1 分钟 |
| **Cursor** | 合并到 `.cursor/rules` | 1 分钟 |
| **Codex** | 复制为 `AGENTS.md` | 1 分钟 |
| **任意 Agent** | 放项目根目录 `AGENT_PROTOCOL.md` | 1 分钟 |

**就是文件。** 不需要 SDK，不需要运行时依赖，不绑定任何平台。

<br/>

## 30 秒上手

```bash
npm i -g collab-cli

# 单机模式（所有 agent 在一台电脑上）
collab setup --devices 1 --project "我的项目"

# 多设备模式（agent 在不同电脑上）
collab setup --devices 2 \
  --device-1 "电脑A:codex-1@Codex" \
  --device-2 "电脑B:codex-2@Codex"
```

安装向导会：
1. 创建 `.shared/` 及所有文件
2. 为所有 agent 签发工牌
3. 输出每台设备的操作步骤

<br/>

---

## 详细文档

<details>
<summary><strong>📋 核心概念</strong>（工牌、任务、inbox、记忆、握手）</summary>

### 🪪 工牌 — 基于角色的权限控制

每个 agent 加入时获得工牌，定义能做什么、不能做什么。

| 级别 | 名称 | 能做什么 |
|:--|:--|:--|
| L0 | 观察者 | 只读 |
| L1 | 执行者 | 写自己的任务 + inbox |
| L2 | 贡献者 | L1 + 写记忆 + 提交审查 |
| L3 | 审查者 | L2 + 审批任务 + 写 SHARD |
| L4 | 总工 | 全部 + 分发任务 + 管理工牌 |

同一 agent 不同会话可持有不同工牌。

### 📋 任务 — 生命周期管理

```
DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                                  ↓
                               REWORK → IN_PROGRESS
```

不能跳过 REVIEW。总工审查后，用户最终确认。

### 📬 Inbox — 结构化消息

支持优先级（P0-P3）、类型（task/review/approval/question）、关联任务、需回复标记。

### 🤝 握手 — 自动上下文加载

每个 agent 启动时读 SHARD + 工牌 + inbox + 任务。不需要手动解释。

</details>

<details>
<summary><strong>📨 Agent 指令</strong>（agent 之间如何互相指挥）</summary>

### 指令类型

| 类型 | 用途 | 自动执行？ |
|:--|:--|:--:|
| `command` | 执行一个操作 | ✅ (P1-P3) |
| `review` | 审查任务 | ✅ |
| `notify` | 仅通知 | ✅ |
| `approve` | 审批通过 | ❌ (需用户) |
| `reject` | 打回重做 | ❌ (需用户) |
| `delegate` | 转发任务 | ❌ (需用户) |

### 使用

```bash
collab cmd send --from claude-01 --to workbuddy-01 \
  --type command --instruction "运行 factor_pipeline.py" --priority P1

collab cmd list --to workbuddy-01 --status pending
collab cmd exec --agent workbuddy-01
```

</details>

<details>
<summary><strong>🔍 自审查</strong>（质量如何保证）</summary>

```bash
collab review self T-001 --agent claude-01
collab review create --task T-001 --by claude-01 --checks code_quality,test_coverage
collab review submit RVW-xxx code_quality --reviewer reasonix-01 --passed true --score 85
```

</details>

<details>
<summary><strong>🌐 LAN 节点</strong>（跨设备同步细节）</summary>

### 原理

1. **UDP 广播**（端口 9528）：每 5 秒广播一次
2. **自动发现**：局域网内节点互相发现
3. **智能路由**：消息 → 本地文件或远程 HTTP
4. **Token 认证**：每个节点随机 token

### 同步内容

| 文件 | 同步？ | 策略 |
|:--|:--:|:--|
| `SHARD.md` | ✅ | 版本号，新的赢 |
| `tasks/` | ✅ | 状态合并，更前进的赢 |
| `memory/` | ✅ | 完整同步 |
| `inbox/` | ❌ | 按设备独立（设计如此） |

### 命令

```bash
collab node start --agents codex-1
collab node pull --host 192.168.1.100
collab node status
```

</details>

<details>
<summary><strong>💓 心跳</strong>（持久 inbox 监控）</summary>

```bash
collab heartbeat claude-01               每 5 分钟
collab heartbeat claude-01 --once        单次检查（exit 2 = 有 P0/P1）
collab heartbeat claude-01 --interval 60 每 60 秒
```

</details>

<details>
<summary><strong>🔌 MCP 服务器</strong>（插件集成）</summary>

```toml
# reasonix.toml
[[plugins]]
name = "collab"
type = "stdio"
command = "collab"
args = ["mcp"]
```

17 个工具：status、handshake、inbox (check/send/read)、task (create/list/update)、badge、memory (stats/compact/write)、shard_update、peer_list、conflict (list/create)。

</details>

<details>
<summary><strong>🌐 Web 控制面板</strong>（浏览器可视化）</summary>

```bash
collab dashboard --port 8080
# 打开 http://localhost:8080 — 暗色主题，30秒自动刷新
# 显示：SHARD 进度、工牌、任务看板、记忆、冲突
```

</details>

<details>
<summary><strong>📦 Git 集成</strong>（.shared/ 版本管理）</summary>

```bash
collab git init              初始化 .shared/ 为 git 仓库
collab git sync --push       自动 commit + push
collab git status            查看未提交变更
```

</details>

<details>
<summary><strong>⚡ 冲突仲裁</strong>（两个 agent 同时改同一文件）</summary>

```
第 1 层：预防 — 任务 assignee 明确，scope 限定工作目录
第 2 层：检测 — 乐观锁（last_updated_by + last_updated_at）
第 3 层：仲裁 — conflicts/ 目录，总工裁定
```

</details>

<details>
<summary><strong>📚 完整 CLI 参考</strong></summary>

```bash
collab setup                                    安装向导
collab init --project "名称"                    初始化 .shared/
collab status                                   全局状态
collab handshake <agent-id>                     Agent 握手

collab badge issue/show/list                    工牌管理
collab task create/list/status/update           任务管理
collab inbox check/send/read/done               消息收发
collab cmd send/list/exec/status                Agent 指令
collab review create/submit/self/status          审查
collab memory compact/stats                     记忆管理
collab conflict list/resolve                    冲突管理
collab heartbeat <id> [--once] [--interval N]   心跳监控
collab dashboard [--port N]                     Web 控制面板
collab mcp                                      MCP 服务器
collab node start/pull/status                   LAN 节点
collab git init/sync/status                     Git 集成
```

</details>

<br/>

## 架构

```
.shared/
├── MANIFEST.md              系统规则 + agent 注册表
├── SHARD.md                 L0 活记忆（≤80 行）
├── BADGE-{agent-id}.md      每个 agent 的工牌
├── peers.yaml               LAN 配置
├── inbox/{agent-id}/        消息（按 agent 分目录）
├── tasks/T-xxx.md           任务文件
├── commands/CMD-xxx.yaml    Agent 指令
├── reviews/RVW-xxx.yaml     审查记录
├── memory/                  L1 记忆片段
├── archive/                 L2 压缩历史
└── conflicts/               冲突记录
```

<br/>

## 开发

```bash
git clone https://github.com/yinsang0910-star/collab-cli.git
cd collab-cli && npm install && npm test    # 109 个测试全部通过
```

## 许可证

MIT

---

<p align="center">如果对你有帮助，给个 ⭐ 吧</p>
