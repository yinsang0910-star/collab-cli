<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <strong>한국어</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/collab-cli?color=cb3837&labelColor=161b22&logo=npm" alt="npm"/>
  <img src="https://img.shields.io/npm/dm/collab-cli?color=3fb950&labelColor=161b22" alt="downloads"/>
  <img src="https://img.shields.io/github/stars/yinsang0910-star/collab-cli?color=dbab09&labelColor=161b22&logo=github" alt="stars"/>
  <img src="https://img.shields.io/npm/l/collab-cli?color=8b949e&labelColor=161b22" alt="license"/>
  <img src="https://img.shields.io/badge/tests-95%20passing-brightgreen?labelColor=161b22" alt="tests"/>
</p>

<br/>

<p align="center">
  <h1 align="center">🤝 collab-cli</h1>
  <p align="center"><strong>여러 AI 에이전트를 실제 팀처럼 협업시키세요</strong></p>
  <p align="center">Claude Code, Reasonix, WorkBuddy, Cursor, Codex 등 어떤 AI 에이전트든 하나의 프로젝트에서 역할 분담, 기억 공유, 상호 통신이 가능한 유니버설 프로토콜 + CLI 도구.</p>
</p>

<br/>

---

## 🤔 이런 적 있으신가요?

| 문제 | 상황 |
|:--|:--|
| 😵 **정보 비동기** | Claude Code가 코드를 바꿨는데 WorkBuddy가 몰라서 같은 걸 또 구현 |
| 🔄 **반복 설명** | 새 세션마다 프로젝트 배경, 아키텍처, 과거 결정을 다시 설명 |
| 🚫 **권한 혼란** | 실행 에이전트가 수정하면 안 되는 설정 파일을 실수로 변경 |
| 📨 **소통 단절** | 다른 에이전트에게 검토 요청을 보냈는데 상대가 전혀 모름 |
| 📝 **기록 비대화** | 공유 문서가 점점 길어져서 매번 수백 줄을 읽으며 토큰 낭비 |

**collab-cli는 이 모든 문제를 해결합니다.**

<br/>

## ✨ 핵심 기능一览

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   🪪 배지 시스템      각 에이전트에게 신분 발급, L0-L4 5단계    │
│   🧠 3계층 기억       활성(80줄) + 조각(50줄) + 아카이브(자동)  │
│   📋 작업 보드        생성→배정→실행→검토→완료, 전체 생명주기   │
│   📬 메일함           P0-P3 우선순위, 작업 연동, 응답 필요 플래그│
│   🤝 핸드셰이크       시작 시 자동: 상태 읽기→배지 수령→확인     │
│   💓 하트비트         상주 에이전트의 inbox 자동 순회             │
│   ⚡ 충돌 중재        낙관적 잠금 + 자동 감지 + 총공 재정         │
│   🔌 MCP 서버        플러그인 통합, 12개 구조화 도구              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

<br/>

## 🚀 30초 만에 체험하기

```bash
# 1단계: 설치
npm i -g collab-cli

# 2단계: 프로젝트에서 초기화
cd my-awesome-project
collab init --project "내 프로젝트"

# 3단계: 에이전트에게 배지 발급
collab badge issue claude-01 --role L4 --assigned-by user     # Claude = 총공
collab badge issue reasonix-01 --role L2 --assigned-by user   # Reasonix = 기여자

# 4단계: 협업 시뮬레이션
collab task create "사용자 로그인 구현" --assignee claude-01 --priority P0
collab inbox send --from claude-01 --to reasonix-01 --title "로그인 모듈 검토 요청" --priority P1 --needs-reply
collab handshake claude-01   # Claude가 참여 시 자동으로 모든 정보를 읽음
```

`collab status`로 전체 현황 확인:

```
📋 협업 시스템 상태 — 내 프로젝트
──────────────────────────────────────────────────

📝 SHARD (L0 활성 기억): 13/80줄

🪪 배지 (2개):
   claude-01: L4 (user)
   reasonix-01: L2 (user)

📋 작업: 1건
   IN_PROGRESS: 0 | ASSIGNED: 1

📬 메일함: 1건 읽지 않음
   reasonix-01: 1건 읽지 않음 (P0:0 P1:1)

🧠 기억: L1 0파일, L2 아카이브 0
```

<br/>

## 🎯 누가 사용하나요?

| 당신은... | 얻을 수 있는 것... |
|:--|:--|
| 🧑‍💻 **여러 AI 코딩 도구를 동시에 쓰는 개발자** | 모든 에이전트가 같은 프로젝트 상태를 공유, 반복 설명 없음 |
| 🏗️ **AI 팀을 구축하는 아키텍트** | 표준화된 역할 권한, 작업 배분, 검토 프로세스 |
| 🔬 **AI 에이전트 연구자** | 재사용 가능한 멀티 에이전트 협업 프로토콜 참조 구현 |
| 🤖 **AI 에이전트 개발자** | MCP 플러그인으로 당신의 에이전트를 어디든 즉시 통합 |

<br/>

## 📖 완전한 실제 시나리오

> **시나리오**: 이커머스 플랫폼을 개발 중. Claude Code로 백엔드 API를 작성하고, Reasonix로 코드 리뷰를, 스케줄러 에이전트로 야간 배치 작업을 수행합니다.

### 1단계: 프로젝트 초기화

```bash
collab init --project "이커머스 플랫폼"
```

### 2단계: 배지 발급

```bash
collab badge issue claude-01 --role L4 --assigned-by user     # 총공 (전체 권한)
collab badge issue workbuddy-01 --role L1 --assigned-by user  # 실행자
collab badge issue reasonix-01 --role L3 --assigned-by user   # 리뷰어
```

### 3단계: 총공이 작업 배분

```bash
collab task create "상품 검색 최적화" \
  --assignee workbuddy-01 --priority P1 \
  --deadline "2026-06-09T09:30:00+08:00" --by claude-01
```

### 4단계: 에이전트 간 통신

```bash
collab inbox send \
  --from workbuddy-01 --to claude-01 \
  --title "검색 최적화 스크립트 완료, 검토 부탁드립니다" \
  --priority P1 --type review_request \
  --body "스크립트: services/search.py, 로컬 테스트 통과" \
  --task T-001 --needs-reply
```

### 5단계: Claude가 다음 시작 시 자동 인식

```
🤝 핸드셰이크 완료
🪪 배지: L4 총공 | 📬 읽지 않음: 1건(P1) | 📋 활성 작업: 2건
⚠️ P1 읽지 않은 메시지 1건: "검색 최적화 스크립트 완료, 검토 부탁드립니다"
```

**"WorkBuddy가 메시지를 보냈다"고 수동으로 알려줄 필요 없습니다——Claude가 스스로 압니다.**

<br/>

## 🏗️ 아키텍처

```
당신의 프로젝트/
├── .shared/                        ← 협업 시스템 루트
│   ├── MANIFEST.md                    시스템 선언 + 역할 정의
│   ├── SHARD.md                       L0 활성 기억 (필수 읽기, ≤80줄)
│   ├── BADGE-claude-01.md             Claude의 배지
│   ├── BADGE-workbuddy-01.md          WorkBuddy의 배지
│   ├── inbox/{agent-id}/             메시지 수신함
│   ├── tasks/T-xxx.md               작업 파일 (상태 머신)
│   ├── memory/                        L1 기억 조각
│   ├── archive/                       L2 아카이브 (자동 압축)
│   └── conflicts/                     충돌 기록
├── .claude/CLAUDE.md                ← Claude Code 핸드셰이크 지시
├── .reasonix/system.md              ← Reasonix 핸드셰이크 지시
└── reasonix.toml                    ← Reasonix MCP 플러그인 설정
```

<br/>

## 🪪 배지 권한 상세

```
L4 총공 ──────┬── 전체 읽기/쓰기 + 작업 배정 + 승격/강등 + 배지 관리
              │
L3 리뷰어 ────┤── 작업 승인 + SHARD 쓰기 + 기억 쓰기
              │
L2 기여자 ────┤── 기억 쓰기 + 검토 제출
              │
L1 실행자 ────┤── 자기 작업 쓰기 + inbox 쓰기
              │
L0 관찰자 ────┴── 읽기 전용
```

<br/>

## 🧠 기억 감쇠 메커니즘

```
           ┌──────────────┐
           │   SHARD.md   │  ← L0: "지금 사실인 것"만 기록 (≤80줄)
           └──────┬───────┘
                  │ 80줄 초과 or 작업 완료
                  ▼
           ┌──────────────┐
           │   memory/    │  ← L1: 주제별 (≤50줄/파일)
           └──────┬───────┘
                  │ 매주 or L1 초과
                  ▼
           ┌──────────────┐
           │   archive/   │  ← L2: 날짜별 압축 (≤50줄/일)
           └──────────────┘
```

**효과**: 새 에이전트는 80줄만 읽으면 전체를 파악.

<br/>

## 🔌 에이전트 통합 가이드

### Claude Code (1줄)

```bash
cat node_modules/collab-cli/src/templates/CLAUDE_PROTOCOL.md >> .claude/CLAUDE.md
```

### Reasonix (3가지 방법)

**방법 A: MCP 플러그인 (추천)** — `reasonix.toml`에 추가:

```toml
[[plugins]]
name = "collab"
type = "stdio"
command = "collab"
args = ["mcp"]
```

12개 도구(`mcp__collab__inbox_check` 등)를 네이티브로 사용.

**방법 B: 사용자 정의 명령어** — `/collab handshake`로 핸드셰이크.

**방법 C: 프로토콜 주입** — `.reasonix/system.md`에 배치.

### WorkBuddy / Cursor / Codex

```bash
# WorkBuddy
cat node_modules/collab-cli/src/templates/AGENT_PROTOCOL.md >> .workbuddy/MEMORY.md

# Cursor
cat node_modules/collab-cli/src/templates/CURSOR_PROTOCOL.md >> .cursor/rules

# Codex
cp node_modules/collab-cli/src/templates/CODEX_PROTOCOL.md ./AGENTS.md
```

<br/>

## 📬 메시징 시스템

```bash
# 보내기
collab inbox send --from claude-01 --to workbuddy-01 \
  --title "긴급: 결제 타임아웃 수정" --priority P0 --type task \
  --body "결제 API 타임아웃, 주문이 대기 상태에 머무름" --needs-reply

# 확인
collab inbox check workbuddy-01

# 읽음 처리
collab inbox read workbuddy-01 MSG-001
```

| 메시지 유형 | 용도 |
|:--|:--|
| `task` | 작업 배정 |
| `review_request` | 검토 요청 |
| `approval` | 승인/거부 |
| `question` | 질문 |
| `notification` | 알림 |
| `response` | 응답 |

<br/>

## 💓 하트비트

```bash
collab heartbeat claude-01            # 상주 모드 (5분 간격)
collab heartbeat claude-01 --once     # 단일 확인 (exit 2 = 높은 우선순위)
collab heartbeat claude-01 --interval 60  # 사용자 정의 간격
```

<br/>

## ⚡ 충돌 중재

3단계 보호: 예방(assignee 명시) → 감지(낙관적 잠금) → 중재(총공이 24시간 이내)

<br/>

## 🆚 다른 솔루션과 비교

| 특징 | 수동 조율 | Git 브랜치 | **collab-cli** |
|:--|:--:|:--:|:--:|
| 실시간 메시지 | ❌ | ❌ | ✅ |
| 역할 권한 제어 | ❌ | 브랜치 단위 | 파일 단위 |
| 공유 기억 | 구두 | 커밋 메시지 | 구조화 3계층 기억 |
| 작업 생명주기 | 구두 | PR/Issue | 내장 상태 머신 |
| 새 에이전트 참여 비용 | 전부 재설명 | clone | 핸드셰이크로 자동 정렬 |
| 토큰 소비 | 전체 재로드 | N/A | ≤80줄 |

<br/>

## 🛠️ 개발

```bash
git clone https://github.com/yinsang0910-star/collab-cli.git
cd collab-cli
npm install
npm test          # 64개 테스트 전체 통과
npm link
```

<br/>

## 📄 License

MIT

<br/>

---

<p align="center">
  이 프로젝트가 도움이 되었다면 ⭐를 눌러주세요!
</p>
