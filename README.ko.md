<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <strong>한국어</strong>
</p>

# collab-cli

멀티 에이전트 LLM 팀을 위한 유니버설 협업 프로토콜 + CLI 도구. Claude Code, Reasonix, Codex, WorkBuddy, Cursor 등 어떤 에이전트든 프로젝트에 참여하여 공유 프로토콜 아래에서 협업할 수 있습니다.

## 지원 에이전트

| 에이전트 | 통합 방식 | 프로토콜 템플릿 |
|----------|-----------|----------------|
| **Claude Code** | `.claude/CLAUDE.md` | `CLAUDE_PROTOCOL.md` |
| **Reasonix** | `.reasonix/system.md` + MCP 플러그인 | `REASONIX_PROTOCOL.md` |
| **WorkBuddy** | `.workbuddy/MEMORY.md` | `AGENT_PROTOCOL.md` |
| **Cursor** | `.cursor/rules` | `CURSOR_PROTOCOL.md` |
| **Codex** | `AGENTS.md` | `CODEX_PROTOCOL.md` |
| **모든 에이전트** | 루트 `COLLAB_PROTOCOL.md` | `AGENT_PROTOCOL.md` |

## 빠른 시작

```bash
# 설치
npm i -g collab-cli

# 프로젝트에서 초기화
cd /path/to/your/project
collab init --project "내 프로젝트"

# 에이전트에게 배지 발급
collab badge issue claude-01 --role L4 --assigned-by user
collab badge issue reasonix-01 --role L2 --assigned-by user

# 에이전트 핸드셰이크 (세션마다 1회)
collab handshake claude-01
```

## 핵심 개념

### 배지 시스템

각 에이전트는 프로젝트 참여 시 배지를 받고, 역할과 권한이 정의됩니다. 같은 에이전트의 다른 세션이 다른 배지를 가질 수 있습니다.

| 레벨 | 이름 | 권한 |
|------|------|------|
| L0 | 관찰자 | 읽기 전용 |
| L1 | 실행자 | 전체 읽기 + 자기 작업 쓰기 + inbox 쓰기 |
| L2 | 기여자 | L1 + 메모리 쓰기 + 리뷰 제출 |
| L3 | 리뷰어 | L2 + 작업 승인 + SHARD 쓰기 |
| 4 | 총공 (총괄 엔지니어) | 전체 권한 + 작업 배정 + 배지 관리 |

### 기억 계층

```
L0  SHARD.md     ← 활성 기억 (≤80줄) — 현재 상태, 필수 읽기
L1  memory/      ← 구조화된 조각 (각 ≤50줄) — 주제별
L2  archive/     ← 날짜별 압축 기록 — 필요할 때만 참조
```

자동 감쇠: SHARD가 80줄을 초과하면 오래된 항목이 자동으로 아카이브됩니다.

### 작업 생명주기

```
DRAFT → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                                  ↓
                               REWORK → IN_PROGRESS
```

작업은 총공의 리뷰 후 사용자가 최종 승인합니다.

### 인박스 시스템

우선순위(P0-P3), 메시지 유형, 관련 작업, 응답 필요 플래그를 갖춘 구조화된 메시징.

### 핸드셰이크 프로토콜

각 에이전트가 프로젝트에 참여할 때의 첫 번째 동작:

1. `MANIFEST.md` 읽기 — 시스템 규칙, 에이전트 등록부
2. `SHARD.md` 읽기 — 현재 상태 (≤80줄)
3. 배지 `BADGE-{id}.md` 읽기/신청하기
4. `inbox/{id}/`의 읽지 않은 메시지 확인
5. `tasks/`에서 자기 활성 작업 확인
6. 핸드셰이크 요약 출력 후 사용자에게 응답

## CLI 명령어

```bash
# 시스템
collab init                           협업 시스템 초기화
collab status                         전체 상태 개요
collab handshake <agent-id>           에이전트 핸드셰이크

# 배지
collab badge issue <id> --role <L>    배지 발급
collab badge show <id>                배지 보기
collab badge list                     전체 배지 목록

# 작업
collab task create <title>            작업 생성
collab task list                      작업 목록
collab task status <id>               작업 상세
collab task update <id> <status>      상태 업데이트

# 인박스
collab inbox check <id>               읽지 않음 확인
collab inbox send                     메시지 보내기
collab inbox read <id> <msg-id>       메시지 읽기
collab inbox done <id> <msg-id>       완료 표시

# 기억
collab memory compact                 기억 압축
collab memory stats                   기억 통계
collab memory archive <date>          날짜별 아카이브

# 충돌
collab conflict list                  충돌 목록
collab conflict resolve <id>          충돌 해결

# 하트비트
collab heartbeat <agent-id>           지속 모니터링 시작
collab heartbeat <agent-id> --once    단일 확인 (exit 2 = 높은 우선순위)
collab heartbeat <agent-id> --interval 60  사용자 정의 간격 (초)

# MCP 서버
collab mcp                            MCP 서버 시작 (stdio JSON-RPC)
```

## 파일 구조

```
.shared/
├── MANIFEST.md              시스템 선언 + 에이전트 등록부
├── SHARD.md                 L0 활성 기억 (≤80줄)
├── BADGE-{agent-id}.md      에이전트별 배지 (다중 배지 병렬)
├── inbox/{agent-id}/        메시지 수신함 (에이전트별 디렉토리)
│   └── 001-{topic}.md       구조화된 메시지 (frontmatter 포함)
├── tasks/T-xxx.md           작업 파일 (상태 머신 + 진행 로그)
├── memory/                  L1 기억 조각 (주제별, 각 ≤50줄)
│   ├── decisions.md
│   ├── lessons.md
│   └── architecture.md
├── archive/                 L2 아카이브 (날짜별, 각 ≤50줄)
│   └── 2026-06-06.md
└── conflicts/               충돌 기록 (중재 대기)
    └── C-{timestamp}.md
```

## 에이전트 통합 가이드

### Claude Code

```bash
cat node_modules/collab-cli/src/templates/CLAUDE_PROTOCOL.md >> .claude/CLAUDE.md
```

### Reasonix

**방법 A: 프로토콜 주입 (권장)**

```bash
mkdir -p .reasonix
cp node_modules/collab-cli/src/templates/REASONIX_PROTOCOL.md .reasonix/system.md
```

**방법 B: 사용자 정의 명령어**

```bash
mkdir -p .reasonix/commands
cp node_modules/collab-cli/src/templates/reasonix-commands/collab.md .reasonix/commands/
```

**방법 C: MCP 플러그인 (가장 강력한 통합)**

`reasonix.toml`에 설정:

```toml
[[plugins]]
name = "collab"
type = "stdio"
command = "collab"
args = ["mcp"]
```

Reasonix가 12개의 collab 도구(`mcp__collab__inbox_check` 등)를 네이티브로 사용 가능.

### WorkBuddy

`AGENT_PROTOCOL.md`를 `.workbuddy/MEMORY.md`에 추가.

### Cursor

`CURSOR_PROTOCOL.md`를 `.cursor/rules`에 통합.

### Codex / 모든 에이전트

`CODEX_PROTOCOL.md` 또는 `AGENT_PROTOCOL.md`를 프로젝트 루트나 에이전트의 지시 파일에 배치.

## MCP 서버

[Model Context Protocol](https://modelcontextprotocol.io/) 사양을 따르는 내장 MCP 서버 (stdio JSON-RPC 2.0).

| MCP 도구 | 기능 |
|:--|:--|
| `collab_status` | 전체 상태 |
| `collab_handshake` | 에이전트 핸드셰이크 |
| `collab_inbox_check` | 읽지 않은 메시지 확인 |
| `collab_inbox_send` | 메시지 보내기 |
| `collab_inbox_read` | 메시지 읽기 (읽음 표시) |
| `collab_task_create` | 작업 생성 |
| `collab_task_list` | 작업 목록 |
| `collab_task_update` | 작업 상태 업데이트 |
| `collab_badge_issue` | 배지 발급 |
| `collab_memory_stats` | 기억 통계 |
| `collab_memory_compact` | 기억 압축 |
| `collab_conflict_list` | 충돌 목록 |

## 하트비트

장시간 실행 에이전트를 위한 inbox 모니터링:

```bash
collab heartbeat claude-01            # 지속 모드 (5분 간격)
collab heartbeat claude-01 --once     # 단일 확인
collab heartbeat claude-01 --interval 60  # 사용자 정의 간격
```

## 충돌 해결

3단계 보호:

1. **예방** — 작업 `assignee` 명시, `scope`로 작업 디렉토리 제한
2. **탐지** — frontmatter의 `last_updated_by` + `last_updated_at` 낙관적 잠금
3. **중재** — `conflicts/`에 기록, 총공이 24시간 이내 해결

## 프로토콜 호환성

모든 에이전트가 동일한 `.shared/` 파일 구조를 공유합니다. 프로토콜 계층은 **순수 Markdown + YAML** — 에이전트별 메커니즘에 의존하지 않습니다.

- **파일 = 프로토콜** — 파일 읽기/쓰기가 가능한 에이전트는 모두 참여 가능
- **CLI는 편의성** — 에이전트는 `read_file` / `write_file`로 직접 조작도 가능
- **MCP는 확장** — 플러그인 메커니즘으로 구조화된 도구 호출 제공

## 개발

```bash
npm install
npm test          # 64개 테스트
npm link          # 로컬 개발
npm publish       # npm에 게시
```

## 라이선스

MIT
