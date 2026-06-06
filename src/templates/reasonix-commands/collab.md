---
name: collab
description: 多智能体协作协议 — 握手、状态、消息、任务管理
---

# Collab 协作命令

通过 `collab` CLI 或直接读写 `.shared/` 文件来管理多智能体协作。

## 用法

```
/collab handshake    — 执行启动握手（读 SHARD + 工牌 + inbox + 任务）
/collab status       — 查看协作体系全局状态
/collab inbox        — 检查当前 agent 的未读消息
/collab task list    — 列出所有活跃任务
/collab task create  — 创建新任务（需要指定标题、负责人、优先级）
/collab send         — 给其他 agent 发送消息
/collab memory       — 查看记忆层级统计
```

## 执行方式

### 方式 1: 通过 CLI（推荐）

```bash
collab status --shared .shared
collab inbox check {agent-id} --shared .shared
collab task list --shared .shared
collab handshake {agent-id} --shared .shared
```

### 方式 2: 直接读写文件

- 读 `.shared/SHARD.md` 获取项目状态
- 读 `.shared/BADGE-{id}.md` 确认工牌
- 读 `.shared/inbox/{id}/` 下 `status: unread` 的消息
- 写 `.shared/inbox/{target}/` 发送消息
- 写 `.shared/tasks/T-xxx.md` 创建任务

## 握手流程详情

当用户输入 `/collab handshake` 时，按以下步骤执行：

1. **读系统声明**: read_file `.shared/MANIFEST.md`
2. **读活记忆**: read_file `.shared/SHARD.md`（≤80行）
3. **确认工牌**: read_file `.shared/BADGE-{agent-id}.md`
   - 不存在 → 向用户申请，说明建议角色
   - 没有总工 → 自荐 L4，由用户确认
4. **检查消息**: ls `.shared/inbox/{agent-id}/` + grep `status: unread`
   - P0/P1 未读 → 先告知用户
5. **检查任务**: grep `assignee: {agent-id}` 在 `.shared/tasks/`
   - 有 IN_PROGRESS → 列出提醒
6. **输出摘要**: 格式如下

```
🤝 握手完成
🪪 工牌: {role} {name} | 📬 未读: {count}条 | 📋 活跃任务: {count}个
```

## 任务状态机

```
DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                                  ↓
                               REWORK → IN_PROGRESS
```

- 创建任务: write_file `.shared/tasks/T-{序号}-{标题}.md`
- 更新状态: edit_file 修改 frontmatter 的 `status` 字段
- 只有 assignee 能改状态
- 完成后进入 REVIEW，等总工+用户确认

## 角色权限

| 级别 | 可做 | 不可做 |
|------|------|--------|
| L0 | 读 SHARD + memory | 写任何文件 |
| L1 | 读全部 + 写自己的任务 + 写 inbox | 改 SHARD、审批任务 |
| L2 | L1 + 写 memory + 提交审查 | 审批任务、管理工牌 |
| L3 | L2 + 审批任务 + 写 SHARD | 升降他人工牌 |
| L4 | 全部 | — |

## 注意事项

- SHARD.md ≤80 行，写前检查 `last_updated_by`
- memory/ 每文件 ≤50 行
- 冲突写入 `conflicts/` 目录
- 写入任何 `.shared/` 文件时更新 frontmatter 的 `last_updated_by` 和 `last_updated_at`
