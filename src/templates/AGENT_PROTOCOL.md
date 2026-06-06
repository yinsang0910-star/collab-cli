# 协作协议 v1.0

> 本文件定义了 agent 在本项目中必须遵守的协作协议。
> 将本文件内容复制到你的 agent 指令文件中（CLAUDE.md / AGENTS.md / .cursor/rules 等）。

## 启动握手

每个新会话的第一个响应前，执行以下步骤：

1. 读取 `.shared/MANIFEST.md` — 了解系统规则和 agent 注册表
2. 读取 `.shared/SHARD.md` — 了解项目当前状态（≤80 行，快速阅读）
3. 读取 `.shared/BADGE-{your-agent-id}.md` — 确认你的工牌
   - 如果不存在，向用户申请工牌（说明你的能力和建议角色）
   - 如果没有总工，第一个申请的 agent 可自荐为总工（L4），由用户确认
4. 列出 `.shared/inbox/{your-agent-id}/` 目录，读取所有 status: unread 的消息
   - 有 P0/P1 未读？在回复用户之前先告知并询问是否优先处理
5. 检查 `.shared/tasks/` 中 assignee 为自己的 IN_PROGRESS 任务
6. 输出握手摘要（简短），然后响应用户

## 工牌权限

| 级别 | 名称 | 核心权限 |
|------|------|----------|
| L0 | 观察者 | 只读 |
| L1 | 执行者 | 读全部 + 写自己的任务 + 写 inbox |
| L2 | 贡献者 | L1 + 写 memory + 提交审查 |
| L3 | 审查者 | L2 + 审批任务 + 写 SHARD |
| L4 | 总工 | 全部权限 + 分发任务 + 管理工牌 |

## 写入规则

- **SHARD.md**: L3+ 才能直接修改。写入前检查 `last_updated_by`，避免覆盖。
- **任务文件**: 只有 assignee 能修改状态。完成时更新为 REVIEW，等总工+用户确认。
- **inbox**: 任何有写入权限的 agent 都可以给其他 agent 发消息。
- **memory**: L2+ 可以追加经验教训，不超过 50 行/文件。
- **任务完成时**: 将相关事件从 SHARD 移入 archive/，保持 SHARD ≤80 行。

## 任务生命周期

```
DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                                  ↓
                               REWORK → IN_PROGRESS
```

- 任务完成标准由总工定义，用户最终确认
- 审查不通过时打回 REWORK

## 消息协议

发送消息时，在对方的 inbox 目录创建文件：

```
.shared/inbox/{对方agent-id}/{序号}-{主题}.md
```

文件必须包含 frontmatter: id, from, to, priority, type, status, created_at

## CLI 工具

```bash
collab status          # 查看全局状态
collab inbox check     # 检查未读消息
collab badge show      # 查看当前工牌
collab task list       # 列出活跃任务
collab memory compact  # 触发记忆归档
```
