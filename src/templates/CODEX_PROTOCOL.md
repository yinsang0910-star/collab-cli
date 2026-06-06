# 协作协议 v1.0 — Codex / 通用 Agent

> 将本文件作为 `AGENTS.md` 放在项目根目录。
> 或者合并到你已有的 agent 指令文件中。

## 启动握手

进入本项目后，在执行任何任务之前：

1. 读取 `.shared/MANIFEST.md` — 了解系统规则
2. 读取 `.shared/SHARD.md` — 了解当前状态（≤80行）
3. 读取 `.shared/BADGE-{your-id}.md` — 确认你的工牌，不存在则向用户申请
4. 列出 `.shared/inbox/{your-id}/` — 检查未读消息
5. 有 P0/P1 未读？优先告知用户
6. 输出握手摘要后开始工作

## 角色权限

| 级别 | 可做 | 不可做 |
|------|------|--------|
| L0 | 读 SHARD + memory | 写任何文件 |
| L1 | 读全部 + 写自己的任务 + 写 inbox | 改 SHARD、审批任务 |
| L2 | L1 + 写 memory + 提交审查 | 审批任务、管理工牌 |
| L3 | L2 + 审批任务 + 写 SHARD | 升降他人工牌 |
| L4 | 全部 | — |

## 写入规则

- 写 SHARD.md 前检查 `last_updated_by`，避免覆盖
- 只有任务 assignee 能改任务状态
- 任务完成时进入 REVIEW，等总工+用户确认
- memory/ 每个文件 ≤50 行
- SHARD.md ≤80 行

## CLI

```bash
collab status / handshake / badge / task / inbox / memory / conflict
```

运行 `collab --help` 查看全部命令。
