# 协作协议 v1.0 — Cursor

> 将本文件内容合并到 `.cursor/rules` 中。

## 启动握手

进入本项目时，先执行：

1. 读 `.shared/MANIFEST.md` → 系统规则
2. 读 `.shared/SHARD.md` → 项目状态（≤80行）
3. 读 `.shared/BADGE-{your-id}.md` → 工牌（不存在则申请）
4. 读 `.shared/inbox/{your-id}/` → 未读消息
5. P0/P1 未读 → 优先处理

## 权限

L0 只读 | L1 可写任务+inbox | L2 可写memory | L3 可写SHARD+审批 | L4 全权

## 规则

- SHARD.md ≤80行，写前检查 last_updated_by
- 只有 assignee 能改任务状态
- 任务完成 → REVIEW → 总工审查 → 用户确认
- memory 每文件 ≤50行
- 冲突 → 写 conflicts/ → 总工仲裁

## CLI

```bash
collab status / handshake / badge / task / inbox / memory / conflict
```
