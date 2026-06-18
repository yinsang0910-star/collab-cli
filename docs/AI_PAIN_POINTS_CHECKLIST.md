# AI 智能体通病自检表 — 多 Agent 协作系统健康度评估

> 本表基于「AI智能体100个通病问题」归纳提炼，可用于评估任何多 Agent 协作系统（含 collab-cli）的成熟度。

## 六维评估体系

| # | 核心目标 | 对应的 AI 通病 | 评分 | 当前覆盖 | 改进方向 |
|:-:|:---------|:---------------------|:----:|:---------|:---------|
| 1 | **记忆不丢失** | 金鱼记忆（跨会话遗忘） | /100 | session-guard + shutdown-protocol + context-survival 三层防御 | — |
| 2 | **任务不迷航** | 任务迷航（复杂任务跑偏） | /100 | checkpoint-guard + step-approval 有效控制 | — |
| 3 | **信息精准** | 幻觉、推理断裂 | /100 | knowledge-retrieve 渐进式检索降级 | 🔴 最短板 — 依赖知识库覆盖度 |
| 4 | **规则遵循** | 自作主张（偏离预设） | /100 | prompt-advisor + 铁律约束 | — |
| 5 | **成本可控** | Token 浪费 | /100 | window-aware + token-monitor + memory-efficiency | — |
| 6 | **可插拔扩展** | 架构质量（非AI通病） | /100 | 三层版本分层 + 隐私过滤发布策略 | — |

## 评分标准

| 分数 | 含义 |
|:----:|:-----|
| 90+ | 多层防御（预防+监控+恢复），有回退策略 |
| 80+ | 有主动应对机制，覆盖大部分场景 |
| 60+ | 有基础兜底方案，依赖模型原生能力 |
| <60 | 无额外防控，裸奔 |

## AI 智能体 9 大通病分类

| # | 通病类别 | 涵盖问题类型 | 可测方向数 | 对应 V10 标准版技能 |
|:-:|:---------|:----------|:--------:|:------------------|
| 1 | 智能与可靠性 | 幻觉、推理断裂、迷航 | 5 | knowledge-retrieve, checkpoint-guard |
| 2 | 安全与攻防 | 注入、越权 | 3 | prompt-advisor, badge L0-L4 |
| 3 | 规则遵循 | 偏离预设、自作主张 | 6 | checkpoint-guard, step-approval |
| 4 | 记忆与上下文 | 遗忘、丢失、膨胀 | 3 | memory-efficiency, context-survival |
| 5 | 工程化落地 | 部署、配置、回滚 | 4 | shutdown-protocol, release-checker |
| 6 | 成本与资源 | Token浪费、重复 | 3 | window-aware, token-monitor |
| 7 | 开发评测治理 | 测试、版本、质量 | 4 | check-project-health, release-checker |
| 8 | 多智能体协调 | 通信、冲突、同步 | 2 | collab-inbox, collab-conflict |
| 9 | 交互与体验 | 反馈、确认 | 3 | step-approval, prompt-optimizer |

## 使用方式

1. 根据你的 agent 体系当前覆盖情况，在六维表中填入评分
2. 低于 70 的维度优先改进
3. 参考 "改进方向" 列寻找对应解决方案

---

> 来源：xmgl 技能体系 — `patterns/2026-05-21-AI技能体系测试方法论.md`
> 原始参考：《AI智能体100个通病问题》（测试团队整理）
