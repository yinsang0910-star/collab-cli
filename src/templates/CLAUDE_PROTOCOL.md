# 协作协议 v1.0 — Claude Code 指令注入

> 将本文件内容合并到 `.claude/CLAUDE.md` 中。
> 本协议定义了 Claude Code 在本项目中必须遵守的协作规则。

## 启动握手（每个新会话强制执行）

在你对用户的第一个问题做出回应之前，**必须**完成以下步骤：

```
Step 1: Read  .shared/MANIFEST.md
        → 获取系统规则、agent 注册表、角色定义

Step 2: Read  .shared/SHARD.md
        → 获取项目当前状态（≤80行，30秒内读完）

Step 3: Read  .shared/BADGE-claude-01.md（用你自己的 agent-id）
        → 存在且 session 有效？→ 确认身份，继续
        → 不存在？→ 向用户申请工牌，说明你的能力和建议角色
        → 没有总工？→ 第一个申请的 agent 可自荐为总工（L4），由用户确认

Step 4: List  .shared/inbox/claude-01/  并读取所有 status: unread 的消息
        → 有 P0/P1 未读？→ 在回复用户之前先告知并询问是否优先处理

Step 5: 检查 .shared/tasks/ 中 assignee 为自己的 IN_PROGRESS 任务
        → 有活跃任务？→ 列出，提醒用户

Step 6: 输出握手摘要（简短），然后响应用户
```

**握手摘要格式示例**：
```
🤝 握手完成
🪪 工牌: L4 总工 | 📬 未读: 1条(P1) | 📋 活跃任务: 2个
⚠️ 有 1 条 P1 未读消息需优先处理
```

## 工牌权限

| 级别 | 名称 | 你能做什么 |
|------|------|-----------|
| L0 | 观察者 | 只读，不能改任何文件 |
| L1 | 执行者 | 写自己的任务文件 + 写 inbox |
| L2 | 贡献者 | L1 + 写 memory + 提交审查 |
| L3 | 审查者 | L2 + 审批任务 + 写 SHARD |
| L4 | 总工 | 全部权限 + 分发任务 + 管理工牌 |

## 写入规则

| 文件 | 谁能写 | 规则 |
|------|--------|------|
| SHARD.md | L3+ | 写前检查 `last_updated_by`，避免覆盖他人更新 |
| 任务文件 | assignee | 只有负责人能改状态；完成时更新为 REVIEW |
| inbox | 有写入权限的 | 任何 L1+ 都可以给其他 agent 发消息 |
| memory | L2+ | 每个文件 ≤50 行，只记录结论不记录过程 |
| BADGE-{id}.md | 自己 | 工牌只在会话开始时写入一次 |
| conflicts/ | 任何人 | 发现冲突时写入，等总工裁定 |

## 任务生命周期

```
DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                                  ↓
                               REWORK → IN_PROGRESS
```

- 任务完成标准由总工定义，用户最终确认
- 审查不通过时打回 REWORK，附带具体问题说明

## 消息协议

发送消息时，在对方的 inbox 目录创建文件：

```
.shared/inbox/{对方-agent-id}/{序号}-{主题}.md
```

文件必须包含 frontmatter：
```yaml
---
id: MSG-{序号}
from: {你的agent-id}
to: {对方agent-id}
priority: P0|P1|P2|P3
type: approval|review_request|question|notification|task|response
status: unread
created_at: {ISO时间戳}
related_task: {关联任务ID, 可选}
requires_response: true|false
---
```

## 记忆衰减

- L0 SHARD.md 保持 ≤80 行，只记录"此刻为真"的事实
- 任务完成后，将相关事件从 SHARD 移入 `archive/{日期}.md`
- memory/ 下每个文件 ≤50 行，超限时运行 `collab memory compact`
- 旧的"最近完成"记录（>3天）自动归入 archive/

## CLI 工具

本项目已安装 `collab` CLI。常用命令：

```bash
collab status              # 查看全局状态
collab inbox check claude-01  # 检查未读消息
collab task list           # 列出活跃任务
collab badge show claude-01   # 查看当前工牌
collab memory compact      # 触发记忆归档
collab handshake claude-01 # 完整握手检查
```

## 冲突处理

如果你需要修改的文件刚被其他 agent 修改过（frontmatter 中 `last_updated_by` 不是你，且 `last_updated_at` 在你上次读取之后），**不要直接覆盖**：

1. 重新读取文件
2. 尝试合并你的改动
3. 如果无法自动合并，写入 `conflicts/C-{timestamp}.md` 等总工仲裁

## 禁止事项

- ❌ 不要在没有握手的情况下直接开始工作
- ❌ 不要覆盖其他 agent 刚刚写入的文件
- ❌ 不要在 SHARD.md 中记录过程细节（只记录结论）
- ❌ 不要跳过任务的 REVIEW 状态直接标记 DONE
- ❌ 不要给 L0/L1 级别的 agent 分配需要写 SHARD 的任务
