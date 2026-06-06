<p align="center">
  <strong>English</strong> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/collab-cli?color=cb3837&labelColor=161b22&logo=npm" alt="npm"/>
  <img src="https://img.shields.io/npm/dm/collab-cli?color=3fb950&labelColor=161b22" alt="downloads"/>
  <img src="https://img.shields.io/github/stars/yinsang0910-star/collab-cli?color=dbab09&labelColor=161b22&logo=github" alt="stars"/>
  <img src="https://img.shields.io/npm/l/collab-cli?color=8b949e&labelColor=161b22" alt="license"/>
  <img src="https://img.shields.io/badge/tests-90%20passing-brightgreen?labelColor=161b22" alt="tests"/>
</p>

<br/>

<p align="center">
  <h1 align="center">🤝 collab-cli</h1>
  <p align="center"><strong>Make multiple AI agents collaborate like a real team</strong></p>
  <p align="center">A universal protocol + CLI tool that lets any AI agent — Claude Code, Reasonix, WorkBuddy, Cursor, Codex, and more — work together in the same project: sharing memory, assigning tasks, and communicating across sessions.</p>
</p>

<br/>

---

## 🤔 Sound familiar?

| Problem | Scenario |
|:--|:--|
| 😵 **Out of sync** | Claude Code changed the code, WorkBuddy didn't know, implemented the same thing again |
| 🔄 **Repeating yourself** | Every new session means re-explaining the project background, architecture, and past decisions |
| 🚫 **Permission chaos** | An executor agent accidentally modified a config file it shouldn't have touched |
| 📨 **Lost messages** | You sent a review request to another agent, but they never saw it |
| 📝 **Memory bloat** | Shared docs keep growing, every startup reads hundreds of lines, wasting tokens |

**collab-cli solves all of these.**

<br/>

## ✨ Feature overview

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   🪪 Badge System       Issue identities to agents, L0-L4      │
│   🧠 3-Layer Memory     Live (80 lines) + Fragments + Archive  │
│   📋 Task Board         Create → Assign → Execute → Review     │
│   📬 Inbox              P0-P3 priority, linked tasks, flags    │
│   🤝 Handshake          Auto on startup: state + badge + msgs  │
│   💓 Heartbeat          Persistent inbox monitoring             │
│   ⚡ Conflict Resolution Optimistic lock + auto-detect + arb   │
│   🔌 MCP Server         Plugin integration, 12 structured tools│
│   🌐 LAN Node           Cross-device collaboration over LAN    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

<br/>

## 🚀 Quick start (30 seconds)

```bash
# Step 1: Install
npm i -g collab-cli

# Step 2: Initialize in your project
cd my-awesome-project
collab init --project "My Project"

# Step 3: Issue badges for agents
collab badge issue claude-01 --role L4 --assigned-by user     # Claude = Chief Engineer
collab badge issue reasonix-01 --role L2 --assigned-by user   # Reasonix = Contributor

# Step 4: Try it out
collab task create "Implement user login" --assignee claude-01 --priority P0
collab inbox send --from claude-01 --to reasonix-01 --title "Review login module" --priority P1 --needs-reply
collab handshake claude-01   # Claude reads everything automatically on entry
```

Run `collab status` to see the big picture:

```
📋 Collaboration Status — My Project
──────────────────────────────────────────────────

📝 SHARD (L0 Live Memory): 13/80 lines

🪪 Badges (2):
   claude-01: L4 (user)
   reasonix-01: L2 (user)

📋 Tasks: 1 total
   IN_PROGRESS: 0 | ASSIGNED: 1

📬 Inbox: 1 unread
   reasonix-01: 1 unread (P0:0 P1:1)

🧠 Memory: L1 0 files, L2 Archive 0
```

<br/>

## 🎯 Who is this for?

| You are... | You get... |
|:--|:--|
| 🧑‍💻 **A developer using multiple AI coding tools** | All agents share the same project state — no more repeating context |
| 🏗️ **An architect building an AI team** | Standardized role permissions, task dispatch, review workflow |
| 🔬 **An AI agent researcher** | A reusable multi-agent collaboration protocol reference implementation |
| 🤖 **An AI agent developer** | Plug your agent into any project via MCP plugin |

<br/>

## 📖 A Complete Real-World Walkthrough

> **Scenario**: You're building an e-commerce platform. Claude Code writes the backend API, Reasonix does code review, and a scheduler agent runs nightly batch jobs.

### Step 1: Initialize the project

```bash
collab init --project "E-Commerce Platform"
```

This creates a `.shared/` directory with all collaboration files.

### Step 2: Issue badges

```bash
# Claude is Chief Engineer (L4) — full access
collab badge issue claude-01 --role L4 --assigned-by user

# WorkBuddy is Executor (L1) — can only write own tasks
collab badge issue workbuddy-01 --role L1 --assigned-by user

# Reasonix is Reviewer (L3) — can approve tasks
collab badge issue reasonix-01 --role L3 --assigned-by user
```

### Step 3: Chief Engineer assigns tasks

```bash
# Claude (Chief Engineer) assigns a task to WorkBuddy
collab task create "Product search optimization" \
  --assignee workbuddy-01 \
  --priority P1 \
  --deadline "2026-06-09T09:30:00+08:00" \
  --by claude-01

# Claude assigns a task to itself
collab task create "Payment module refactor" \
  --assignee claude-01 \
  --priority P0 \
  --by user
```

### Step 4: Cross-agent communication

```bash
# WorkBuddy finishes the task and sends a review request to Claude
collab inbox send \
  --from workbuddy-01 \
  --to claude-01 \
  --title "Search optimization done, please review" \
  --priority P1 \
  --type review_request \
  --body "Script at services/search.py, passed local tests" \
  --task T-001 \
  --needs-reply
```

### Step 5: Claude auto-detects on next startup

When Claude Code opens the project, the handshake protocol runs automatically:

```
🤝 Handshake complete
🪪 Badge: L4 Chief Engineer | 📬 Unread: 1 (P1) | 📋 Active tasks: 2
⚠️ 1 P1 unread message needs attention: "Search optimization done, please review"
```

**No need to manually tell Claude "WorkBuddy sent you a message" — it already knows.**

### Step 6: Review and approve

```bash
# Claude reviews, then updates task status
collab task update T-001 REVIEW --by claude-01 --note "Code quality looks good"
collab task update T-001 DONE --by user --note "User confirmed"

# Reply to sender
collab inbox send \
  --from claude-01 \
  --to workbuddy-01 \
  --title "Review approved" \
  --type response \
  --body "Code quality is good, merged" \
  --task T-001
```

<br/>

## 🏗️ Architecture

```
your-project/
├── .shared/                        ← Collaboration root
│   ├── MANIFEST.md                    System declaration + role definitions
│   ├── SHARD.md                       L0 Live Memory (required reading, ≤80 lines)
│   ├── BADGE-claude-01.md             Claude's badge
│   ├── BADGE-workbuddy-01.md          WorkBuddy's badge
│   ├── inbox/
│   │   ├── claude-01/                 Claude's inbox
│   │   │   └── 001-review-request.md
│   │   └── workbuddy-01/             WorkBuddy's inbox
│   ├── tasks/
│   │   ├── T-001-search-optimize.md   Task file (state machine + progress log)
│   │   └── T-002-payment-refactor.md
│   ├── memory/                        L1 Memory fragments (by topic, ≤50 lines each)
│   │   ├── decisions.md
│   │   ├── lessons.md
│   │   └── architecture.md
│   ├── archive/                       L2 Archive (by date, auto-compressed)
│   └── conflicts/                     Conflict records (awaiting arbitration)
│
├── .claude/CLAUDE.md                ← Claude Code handshake instructions
├── .reasonix/system.md              ← Reasonix handshake instructions
└── reasonix.toml                    ← Reasonix MCP plugin config
```

<br/>

## 🪪 Badge Permissions

```
L4 Chief Engineer ──┬── Full read/write + assign tasks + manage badges
                    │
L3 Reviewer ────────┤── Approve tasks + write SHARD + write memory
                    │
L2 Contributor ─────┤── Write memory + submit reviews
                    │
L1 Executor ────────┤── Write own tasks + write inbox
                    │
L0 Observer ────────┴── Read-only (cannot modify any files)
```

- Different sessions of the same agent can hold **different badges**
- When no Chief Engineer exists, the first agent self-nominates, user confirms
- Badges expire at session end

<br/>

## 🧠 Memory Decay Mechanism

```
                 Write time
                   │
                   ▼
           ┌──────────────┐
           │   SHARD.md   │  ← L0: Only "currently true" facts (≤80 lines)
           └──────┬───────┘
                  │
        Exceeds 80 lines or task completed
                  │
                  ▼
           ┌──────────────┐
           │   memory/    │  ← L1: By topic (≤50 lines/file)
           └──────┬───────┘
                  │
          Weekly or L1 exceeds limit
                  │
                  ▼
           ┌──────────────┐
           │   archive/   │  ← L2: Compressed by date (≤50 lines/day)
           └──────────────┘
```

**Result**: New agents only need to read 80 lines to understand the full picture.

<br/>

## 🔌 Agent Integration Guide

### Claude Code (one line)

```bash
cat node_modules/collab-cli/src/templates/CLAUDE_PROTOCOL.md >> .claude/CLAUDE.md
```

Claude Code will automatically handshake on each startup: read SHARD → get badge → check inbox → review tasks.

### Reasonix (three options)

**Option A: MCP Plugin (recommended, strongest integration)**

Add to `reasonix.toml`:

```toml
[[plugins]]
name = "collab"
type = "stdio"
command = "collab"
args = ["mcp"]
```

Reasonix gains 12 tools natively (`mcp__collab__inbox_check`, `mcp__collab__task_create`, etc.).

**Option B: Custom Command**

```bash
mkdir -p .reasonix/commands
cp node_modules/collab-cli/src/templates/reasonix-commands/collab.md .reasonix/commands/
```

Type `/collab handshake` to trigger handshake.

**Option C: Protocol Injection**

```bash
mkdir -p .reasonix
cp node_modules/collab-cli/src/templates/REASONIX_PROTOCOL.md .reasonix/system.md
```

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

## 📬 Messaging System

### Send a message

```bash
collab inbox send \
  --from claude-01 \
  --to workbuddy-01 \
  --title "URGENT: Fix payment timeout" \
  --priority P0 \
  --type task \
  --body "Payment API not responding, orders stuck in pending state" \
  --task T-003 \
  --needs-reply
```

### Check unread

```bash
$ collab inbox check workbuddy-01

📬 Unread Messages:

| ID     | Priority | Type | From      | Title                  | Needs Reply |
|--------|----------|------|-----------|------------------------|:-----------:|
| MSG-001| P0       | task | claude-01 | URGENT: Fix payment    |     ✅      |
```

### Message types

| Type | Use case |
|:--|:--|
| `task` | Assign a task |
| `review_request` | Request code review |
| `approval` | Approve or reject |
| `question` | Ask a question |
| `notification` | General notification |
| `response` | Reply to a message |

<br/>

## 💓 Heartbeat Monitoring

Persistent inbox monitoring for long-running agents:

```bash
# Persistent mode — check every 5 minutes
collab heartbeat workbuddy-01

# Single check — for scripts and CI
collab heartbeat claude-01 --once
# exit 0 = no messages
# exit 2 = high priority messages (P0/P1)

# Custom interval
collab heartbeat claude-01 --interval 60  # every minute
```

Notification output (machine-parseable):

```
[COLLAB_HEARTBEAT] {"type":"new_message","agentId":"claude-01","message":{"id":"MSG-001","priority":"P0",...}}
🚨 New message: [P0] workbuddy-01 → URGENT: Fix payment timeout (needs reply)
```

<br/>

## ⚡ Conflict Resolution

When two agents try to modify the same file simultaneously:

```
Layer 1: Prevention
├─ Task assignee is explicit → others don't touch it
├─ SHARD.md checks last_updated_by before writing
└─ Scope limits each agent's working directories

Layer 2: Detection
├─ Frontmatter last_updated_by + last_updated_at
└─ Optimistic lock compares version on write

Layer 3: Arbitration
├─ Conflict written to conflicts/C-{timestamp}.md
├─ Chief Engineer resolves within 24h
└─ If Chief Engineer can't decide → escalate to user
```

<br/>

## 🌐 LAN Node — Cross-Device Collaboration

Agents on **different devices** can collaborate over the local network. Zero configuration — UDP auto-discovery.

```
Device A (192.168.1.100)              Device B (192.168.1.101)
┌──────────────────────┐              ┌──────────────────────┐
│ collab node start    │◄──HTTP──►   │ collab node start    │
│ agents: claude-01    │  UDP auto   │ agents: workbuddy-01 │
│ port: 9527           │  discovery  │ port: 9527           │
└──────────────────────┘              └──────────────────────┘
```

### Usage

```bash
# Device A (Claude Code machine)
collab node start --agents claude-01

# Device B (WorkBuddy machine)
collab node start --agents workbuddy-01

# Now send messages across devices — automatic routing!
collab inbox send --from claude-01 --to workbuddy-01 \
  --title "Review request" --priority P1
```

### How it works

1. **UDP Broadcast** (port 9528): Nodes announce themselves every 5 seconds
2. **Auto Discovery**: Nodes find each other on the LAN automatically
3. **Smart Routing**: Messages route to local files or remote HTTP API
4. **Token Auth**: Random token per node for security

### API Endpoints

| Endpoint | Method | Description |
|:--|:--|:--|
| `/api/status` | GET | Node status |
| `/api/discovery` | GET | Peer info |
| `/api/inbox/send` | POST | Send message |
| `/api/inbox/check/:id` | GET | Check unread |
| `/api/shard` | GET | Get SHARD.md |
| `/api/tasks` | GET | List tasks |

<br/>

## 🆚 How does it compare?

| Feature | Manual coordination | Git branches | **collab-cli** |
|:--|:--:|:--:|:--:|
| Real-time messaging | ❌ | ❌ | ✅ |
| Role-based permissions | ❌ | Branch-level | File-level |
| Shared memory | Verbal | Commit messages | Structured 3-layer |
| Task lifecycle | Verbal | PR/Issue | Built-in state machine |
| New agent onboarding | Re-explain everything | Clone repo | Handshake auto-aligns |
| Token cost | Re-read everything | N/A | ≤80 lines live memory |

<br/>

## 🛠️ Development

```bash
# Clone the repo
git clone https://github.com/yinsang0910-star/collab-cli.git
cd collab-cli

# Install dependencies
npm install

# Run tests (73 passing — unit + stress)
npm test

# Local development link
npm link
```

### Project structure

```
collab-cli/
├── bin/collab.js              CLI entry (19 subcommands)
├── src/
│   ├── commands/              Command implementations
│   │   ├── init.js            Initialization + migration
│   │   ├── status.js          Global status
│   │   ├── badge.js           Badge management
│   │   ├── task.js            Task lifecycle
│   │   ├── inbox.js           Messaging
│   │   ├── memory.js          Memory decay
│   │   ├── conflict.js        Conflict resolution
│   │   ├── heartbeat.js       Heartbeat monitoring
│   │   └── mcp-server.js      MCP server
│   ├── core/                  Core modules
│   │   ├── protocol.js        Handshake protocol + permissions
│   │   ├── shard.js           SHARD management
│   │   ├── fs-lock.js         Optimistic locking
│   │   └── yaml.js            Frontmatter engine
│   ├── templates/             Protocol templates
│   │   ├── CLAUDE_PROTOCOL.md
│   │   ├── REASONIX_PROTOCOL.md
│   │   ├── CURSOR_PROTOCOL.md
│   │   ├── CODEX_PROTOCOL.md
│   │   └── AGENT_PROTOCOL.md
│   └── utils/                 Utilities
├── package.json               collab-cli@1.0.7
├── README.md                  English
├── README.zh-CN.md            Chinese
├── README.ja.md               Japanese
└── README.ko.md               Korean
```

<br/>

## 📄 License

MIT — use it however you want, including commercial use.

<br/>

---

<p align="center">
  If this project helped you, give it a ⭐!
</p>
