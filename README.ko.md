<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <strong>한국어</strong>
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
<p align="center"><strong>크로스 디바이스 AI 에이전트 협업 + 기억 공유</strong></p>
<p align="center">다른 PC의 여러 AI 에이전트가 하나의 팀처럼 작동 — 컨텍스트 공유, 직접 명령, 자동 리뷰.</p>

<br/>

---

## 한 줄로 설명

> **여러 대의 컴퓨터에 AI 에이전트가 있나요? collab-cli가它们을 협업시킵니다 — 기억을 공유하고, 명령을 보내고, 서로의 작업을 검토합니다. 당신이 메신저가 될 필요 없습니다.**

<br/>

## 4가지 독보적 기능

### 1. 🌐 크로스 디바이스 협업

**다른 PC**의 에이전트가 LAN을 통해 자동 발견, 실시간 동기화.

```
PC A (192.168.1.100)                    PC B (192.168.1.101)
┌──────────────────────┐                ┌──────────────────────┐
│  Codex-1             │   UDP 자동     │  Codex-2             │
│  collab node :9527   │◄── 발견 ────►│  collab node :9527   │
│  SHARD ◄── 동기화 ───┼──────────────►│  SHARD               │
│  tasks ◄── 동기화 ───┼──────────────►│  tasks               │
│  inbox ◄── 실시간 ───┼──────────────►│  inbox               │
└──────────────────────┘                └──────────────────────┘
```

**클라우드 불필요. 서버 불필요. 같은 Wi-Fi만 있으면 됩니다.**

### 2. 🧠 팽창하지 않는 공유 기억

80줄 파일을 읽기만 하면 프로젝트 전체 파악. 오래된 항목은 자동 아카이브. 새 에이전트는 30초 온보딩.

### 3. 📨 에이전트가 직접 명령

중계할 필요 없음. A가 B에 명령 전송 → B가 자동 실행 → 결과를 A에 반환.

### 4. 🔍 제출 전 자동 리뷰

코드 품질, 테스트 커버리지, 문서 자동 검사. 미통과 시 구체적 피드백과 함께 자동 반려.

<br/>

## 모든 주요 에이전트 지원

| 에이전트 | 통합 방법 | 설정 시간 |
|:--|:--|:--|
| **Claude Code** | `.claude/CLAUDE.md`에 추가 | 1분 |
| **Reasonix** | `.reasonix/system.md`에 복사 or MCP 플러그인 | 1분 |
| **WorkBuddy** | `.workbuddy/memory/MEMORY.md`에 추가 | 1분 |
| **Cursor** | `.cursor/rules`에 통합 | 1분 |
| **Codex** | `AGENTS.md`로 복사 | 1분 |
| **모든 에이전트** | 프로젝트 루트에 `AGENT_PROTOCOL.md` | 1분 |

**그냥 파일입니다.** SDK 불필요, 런타임 의존성 없음, 벤더 락인 없음.

<br/>

## 30초 만에 시작

```bash
npm i -g collab-cli

# 싱글 PC
collab setup --devices 1 --project "내 프로젝트"

# 멀티 디바이스
collab setup --devices 2 \
  --device-1 "PC-A:codex-1@Codex" \
  --device-2 "PC-B:codex-2@Codex"
```

<br/>

## 상세 문서

<details>
<summary><strong>📋 핵심 개념</strong>（배지, 작업, inbox, 기억, 핸드셰이크）</summary>

### 배지 — 역할 기반 권한 제어

| 레벨 | 이름 | 권한 |
|:--|:--|:--|
| L0 | 관찰자 | 읽기 전용 |
| L1 | 실행자 | 자기 작업 + inbox 쓰기 |
| L2 | 기여자 | L1 + 기억 쓰기 + 리뷰 제출 |
| L3 | 리뷰어 | L2 + 작업 승인 + SHARD 쓰기 |
| L4 | 총공 | 전체 + 작업 배정 + 배지 관리 |

### 핸드셰이크 — 자동 온보딩

각 에이전트 시작 시 SHARD + 배지 + inbox + 작업 자동 읽기.

</details>

<details>
<summary><strong>📨 에이전트 명령</strong>（에이전트 간 직접 명령）</summary>

```bash
collab cmd send --from claude-01 --to workbuddy-01 \
  --type command --instruction "factor_pipeline.py 실행" --priority P1

collab cmd list --to workbuddy-01 --status pending
collab cmd exec --agent workbuddy-01
```

</details>

<details>
<summary><strong>🌐 LAN 노드</strong>（크로스 디바이스 동기화）</summary>

| 파일 | 동기화? | 전략 |
|:--|:--:|:--|
| `SHARD.md` | ✅ | 버전 기반 |
| `tasks/` | ✅ | 상태 병합 |
| `memory/` | ✅ | 전체 동기화 |
| `inbox/` | ❌ | 장치별 독립 |

```bash
collab node start --agents codex-1
collab node pull --host 192.168.1.100
collab node status
```

</details>

<details>
<summary><strong>📚 전체 CLI 레퍼런스</strong></summary>

```bash
collab setup / init / status / handshake
collab badge issue/show/list
collab task create/list/status/update
collab inbox check/send/read/done
collab cmd send/list/exec/status
collab review create/submit/self/status
collab memory compact/stats
collab conflict list/resolve
collab heartbeat <id> [--once] [--interval N]
collab dashboard [--port N]
collab mcp
collab node start/pull/status
collab git init/sync/status
```

</details>

<br/>

## 개발

```bash
git clone https://github.com/yinsang0910-star/collab-cli.git
cd collab-cli && npm install && npm test    # 109개 테스트 전체 통과
```

## 라이선스

MIT
