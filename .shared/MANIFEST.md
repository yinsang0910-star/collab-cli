---
system: "collab"
version: "1.0.0"
project: "单机项目"
created: "'2026-06-06'"
chief_engineer: "user"
---

# 协作体系声明

## Agent 注册表

| Agent ID | 类型 | 默认角色 | 最高级别 | 备注 |
|----------|------|----------|----------|------|
| claude-01 | Claude Code | 总工 | L4 | |
| workbuddy-01 | WorkBuddy | 贡献者 | L2 | |

## 角色级别

| 级别 | 名称 | 读 SHARD | 写 SHARD | 写 memory | 写 tasks | 分发任务 | 审批任务 | 升降级 |
|------|------|:--------:|:--------:|:---------:|:--------:|:--------:|:--------:|:------:|
| L0 | 观察者 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| L1 | 执行者 | ✅ | ❌ | ❌ | 自己的 | ❌ | ❌ | ❌ |
| L2 | 贡献者 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| L3 | 审查者 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | L0-L2 |
| L4 | 总工 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | L0-L3 |
| claude-01 | Agent | 总工 | L4 | auto-registered |
| workbuddy-01 | Agent | 贡献者 | L2 | auto-registered |

## 任务状态机

```
DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                                  ↓
                               REWORK → IN_PROGRESS

BLOCKED 可从任何活跃状态转入。
```

## 协作规则

1. 每个 agent 进入项目后必须执行启动握手（读 MANIFEST → SHARD → 工牌 → inbox → 任务）
2. 修改 SHARD.md 前必须检查 `last_updated_by`，避免覆盖他人更新
3. 任务完成后，将相关事件从 SHARD 归入 archive/
4. 冲突写入 conflicts/ 目录，由总工 24h 内裁定
