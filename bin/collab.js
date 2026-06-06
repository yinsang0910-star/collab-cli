#!/usr/bin/env node

/**
 * collab — 多智能体协作任务体系 CLI
 *
 * 用法:
 *   collab init [--project <name>] [--shared <dir>] [--migrate]
 *   collab status [--shared <dir>]
 *   collab handshake <agent-id> [--shared <dir>]
 *   collab badge issue <agent-id> --role <L0-L4> [--assigned-by <who>] [--scope <path>...]
 *   collab badge show <agent-id>
 *   collab badge list
 *   collab task create <title> [--assignee <id>] [--priority <P0-P3>] [--deadline <date>]
 *   collab task list [--status <status>] [--assignee <id>]
 *   collab task status <task-id>
 *   collab task update <task-id> <new-status> [--by <operator>] [--note <text>]
 *   collab inbox check <agent-id> [--priority <P0-P3>]
 *   collab inbox send --from <id> --to <id> --title <text> [--priority <P0-P3>] [--body <text>]
 *   collab inbox read <agent-id> <msg-id>
 *   collab inbox done <agent-id> <msg-id>
 *   collab memory compact [--agent <id>]
 *   collab memory stats
 *   collab memory archive <date> [--content <text>]
 *   collab conflict list [--status <open|resolved>]
 *   collab conflict resolve <conflict-id> --by <who> --resolution <text>
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as initCmd from '../src/commands/init.js';
import * as statusCmd from '../src/commands/status.js';
import * as badgeCmd from '../src/commands/badge.js';
import * as taskCmd from '../src/commands/task.js';
import * as inboxCmd from '../src/commands/inbox.js';
import * as memoryCmd from '../src/commands/memory.js';
import * as conflictCmd from '../src/commands/conflict.js';
import * as heartbeatCmd from '../src/commands/heartbeat.js';
import * as nodeCmd from '../src/commands/node.js';
import { handshake } from '../src/core/protocol.js';

// ── 参数解析 ──

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

function getFlag(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] || fallback;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function getSharedDir() {
  const dir = getFlag('shared', null);
  if (dir) return path.resolve(dir);

  // 自动查找 .shared/ 目录
  let cwd = process.cwd();
  while (cwd !== path.dirname(cwd)) {
    const candidate = path.join(cwd, '.shared');
    if (fs.existsSync(candidate)) return candidate;
    cwd = path.dirname(cwd);
  }

  return path.join(process.cwd(), '.shared');
}

// ── 命令分发 ──

(async () => {
try {
  switch (command) {
    case 'init':
      cmdInit();
      break;
    case 'status':
      cmdStatus();
      break;
    case 'handshake':
      cmdHandshake();
      break;
    case 'badge':
      cmdBadge();
      break;
    case 'task':
      cmdTask();
      break;
    case 'inbox':
      cmdInbox();
      break;
    case 'memory':
      cmdMemory();
      break;
    case 'conflict':
      cmdConflict();
      break;
    case 'heartbeat':
      cmdHeartbeat();
      break;
    case 'mcp':
      cmdMcp();
      break;
    case 'node':
      await cmdNode();
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    case 'version':
    case '--version':
    case '-v':
      showVersion();
      break;
    default:
      if (!command) {
        showHelp();
      } else {
        console.error(`未知命令: ${command}`);
        console.error('运行 collab help 查看帮助');
        process.exit(1);
      }
  }
} catch (err) {
  console.error(`错误: ${err.message}`);
  process.exit(1);
}
})();

// ── 命令实现 ──

function cmdInit() {
  const projectName = getFlag('project', path.basename(process.cwd()));
  const sharedDir = getSharedDir();
  const migrate = hasFlag('migrate');

  const result = initCmd.init({ projectName, sharedDir, migrate });

  console.log('');
  console.log('🚀 协作体系初始化完成');
  console.log('─'.repeat(40));

  if (result.created.length > 0) {
    console.log('\n创建:');
    for (const item of result.created) {
      console.log(`  ✅ ${item}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log('\n警告:');
    for (const w of result.warnings) {
      console.log(`  ⚠️ ${w}`);
    }
  }

  console.log('');
  console.log('下一步:');
  console.log('  1. 编辑 .shared/MANIFEST.md，注册你的 agent');
  console.log('  2. 运行 collab badge issue <agent-id> --role L4 为总工签发工牌');
  console.log('  3. 将 src/templates/AGENT_PROTOCOL.md 内容复制到 agent 指令文件');
  console.log('');
}

function cmdStatus() {
  const sharedDir = getSharedDir();
  const report = statusCmd.status(sharedDir);
  console.log(statusCmd.formatStatus(report));
}

function cmdHandshake() {
  const agentId = subcommand;
  if (!agentId) {
    console.error('用法: collab handshake <agent-id>');
    process.exit(1);
  }

  const sharedDir = getSharedDir();
  const report = handshake(sharedDir, agentId);

  console.log('');
  console.log(`🤝 握手报告 — ${agentId}`);
  console.log('─'.repeat(40));

  if (report.manifest) {
    console.log(`\n📋 项目: ${report.manifest.project} (v${report.manifest.version})`);
    console.log(`   总工: ${report.manifest.chiefEngineer}`);
  }

  if (report.shard) {
    console.log(`\n📝 SHARD: v${report.shard.version}, 最后更新: ${report.shard.lastUpdatedBy}`);
  }

  if (report.badge) {
    console.log(`\n🪪 工牌: ${report.badge.role} (${report.badge.assignedBy})`);
  } else {
    console.log('\n🪪 工牌: ❌ 未签发');
  }

  if (report.unreadMessages.length > 0) {
    console.log(`\n📬 未读消息: ${report.unreadMessages.length} 条`);
    for (const m of report.unreadMessages) {
      console.log(`   ${m.priority} | ${m.from} | ${m.title}${m.requiresResponse ? ' ⚠️需回复' : ''}`);
    }
  } else {
    console.log('\n📬 无未读消息');
  }

  if (report.activeTasks.length > 0) {
    console.log(`\n📋 活跃任务: ${report.activeTasks.length} 个`);
    for (const t of report.activeTasks) {
      console.log(`   ${t.id} | ${t.priority} | ${t.title} | ${t.status}`);
    }
  }

  if (report.actions.length > 0) {
    console.log('\n📌 建议动作:');
    for (const a of report.actions) {
      console.log(`   → ${a}`);
    }
  }

  if (report.warnings.length > 0) {
    console.log('\n⚠️ 警告:');
    for (const w of report.warnings) {
      console.log(`   ${w}`);
    }
  }

  console.log('');
}

function cmdBadge() {
  const sharedDir = getSharedDir();

  switch (subcommand) {
    case 'issue': {
      const agentId = args[2];
      const role = getFlag('role');
      const assignedBy = getFlag('assigned-by', 'user');
      const scope = getFlag('scope') ? getFlag('scope').split(',') : ['**'];

      const result = badgeCmd.issue(sharedDir, { agentId, role, assignedBy, scope });
      if (result.success) {
        console.log(`✅ 工牌已签发: ${result.path}`);
      } else {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }
      break;
    }
    case 'show': {
      const agentId = args[2];
      const result = badgeCmd.show(sharedDir, agentId);
      console.log(badgeCmd.formatBadge(result.data));
      break;
    }
    case 'list': {
      const badges = badgeCmd.list(sharedDir);
      if (badges.length === 0) {
        console.log('🪪 无活跃工牌');
      } else {
        console.log('🪪 工牌列表:');
        for (const b of badges) {
          console.log(`   ${b.agentId}: ${b.role} (${b.assignedBy}) — ${b.sessionId}`);
        }
      }
      break;
    }
    default:
      console.error('用法: collab badge <issue|show|list>');
      process.exit(1);
  }
}

function cmdTask() {
  const sharedDir = getSharedDir();

  switch (subcommand) {
    case 'create': {
      const title = args[2];
      const assignee = getFlag('assignee');
      const priority = getFlag('priority', 'P2');
      const deadline = getFlag('deadline');
      const reviewer = getFlag('reviewer', 'user');
      const createdBy = getFlag('by', 'user');
      const description = getFlag('description');
      const acceptance = getFlag('acceptance') ? getFlag('acceptance').split('|') : [];

      const result = taskCmd.create(sharedDir, {
        title, assignee, priority, reviewer, createdBy, deadline, description, acceptance,
      });

      if (result.success) {
        console.log(`✅ 任务已创建: ${result.id}`);
        console.log(`   文件: ${result.path}`);
      } else {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }
      break;
    }
    case 'list': {
      const statusFilter = getFlag('status');
      const assigneeFilter = getFlag('assignee');
      const tasks = taskCmd.list(sharedDir, {
        status: statusFilter,
        assignee: assigneeFilter,
      });
      console.log(taskCmd.formatTaskList(tasks));
      break;
    }
    case 'status': {
      const taskId = args[2];
      console.log(taskCmd.formatTaskDetail(sharedDir, taskId));
      break;
    }
    case 'update': {
      const taskId = args[2];
      const newStatus = args[3];
      const operator = getFlag('by', 'system');
      const note = getFlag('note');

      const result = taskCmd.updateStatus(sharedDir, taskId, newStatus, { operator, note });
      if (result.success) {
        console.log(`✅ ${taskId}: ${result.oldStatus} → ${result.newStatus}`);
      } else {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }
      break;
    }
    default:
      console.error('用法: collab task <create|list|status|update>');
      process.exit(1);
  }
}

function cmdInbox() {
  const sharedDir = getSharedDir();

  switch (subcommand) {
    case 'check': {
      const agentId = args[2];
      if (!agentId) {
        console.error('用法: collab inbox check <agent-id>');
        process.exit(1);
      }
      const priority = getFlag('priority');
      const messages = inboxCmd.check(sharedDir, agentId, { priority });
      console.log(inboxCmd.formatMessageList(messages));
      break;
    }
    case 'send': {
      const from = getFlag('from');
      const to = getFlag('to');
      const title = getFlag('title');
      const priority = getFlag('priority', 'P2');
      const type = getFlag('type', 'notification');
      const body = getFlag('body', '');
      const relatedTask = getFlag('task');
      const requiresResponse = hasFlag('needs-reply');

      const result = inboxCmd.send(sharedDir, {
        from, to, priority, type, title, body, relatedTask, requiresResponse,
      });

      if (result.success) {
        console.log(`✅ 消息已发送: ${result.id}`);
        console.log(`   文件: ${result.path}`);
      } else {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }
      break;
    }
    case 'read': {
      const agentId = args[2];
      const msgId = args[3];
      if (!agentId || !msgId) {
        console.error('用法: collab inbox read <agent-id> <msg-id>');
        process.exit(1);
      }
      console.log(inboxCmd.formatMessageDetail(sharedDir, agentId, msgId));
      inboxCmd.markRead(sharedDir, agentId, msgId);
      break;
    }
    case 'done': {
      const agentId = args[2];
      const msgId = args[3];
      if (!agentId || !msgId) {
        console.error('用法: collab inbox done <agent-id> <msg-id>');
        process.exit(1);
      }
      const result = inboxCmd.markDone(sharedDir, agentId, msgId);
      if (result.success) {
        console.log(`✅ 消息 ${msgId} 已标记为完成`);
      } else {
        console.error(`❌ ${result.error}`);
      }
      break;
    }
    default:
      console.error('用法: collab inbox <check|send|read|done>');
      process.exit(1);
  }
}

function cmdMemory() {
  const sharedDir = getSharedDir();

  switch (subcommand) {
    case 'compact': {
      const agentId = getFlag('agent', 'system');
      const result = memoryCmd.compact(sharedDir, agentId);
      console.log('🧠 记忆压缩结果:');
      for (const msg of result.messages) {
        console.log(`   ${msg}`);
      }
      break;
    }
    case 'stats': {
      const data = memoryCmd.stats(sharedDir);
      console.log(memoryCmd.formatStats(data));
      break;
    }
    case 'archive': {
      const date = args[2];
      if (!date) {
        console.error('用法: collab memory archive <date>');
        process.exit(1);
      }
      const content = getFlag('content', '');
      const result = memoryCmd.archive(sharedDir, date, content);
      if (result.success) {
        console.log(`✅ 已归档: ${result.path}`);
      }
      break;
    }
    default:
      console.error('用法: collab memory <compact|stats|archive>');
      process.exit(1);
  }
}

function cmdConflict() {
  const sharedDir = getSharedDir();

  switch (subcommand) {
    case 'list': {
      const statusFilter = getFlag('status');
      const conflicts = conflictCmd.list(sharedDir, { status: statusFilter });
      console.log(conflictCmd.formatConflictList(conflicts));
      break;
    }
    case 'resolve': {
      const conflictId = args[2];
      const resolvedBy = getFlag('by', 'user');
      const resolution = getFlag('resolution', '已解决');

      if (!conflictId) {
        console.error('用法: collab conflict resolve <conflict-id> --by <who> --resolution <text>');
        process.exit(1);
      }

      const result = conflictCmd.resolve(sharedDir, conflictId, { resolvedBy, resolution });
      if (result.success) {
        console.log(`✅ 冲突 ${conflictId} 已解决`);
      } else {
        console.error(`❌ ${result.error}`);
      }
      break;
    }
    default:
      console.error('用法: collab conflict <list|resolve>');
      process.exit(1);
  }
}

function cmdHeartbeat() {
  const sharedDir = getSharedDir();
  const agentId = subcommand;
  const interval = parseInt(getFlag('interval', '300'));
  const once = hasFlag('once');

  if (!agentId) {
    console.error('用法: collab heartbeat <agent-id> [--interval <seconds>] [--once]');
    process.exit(1);
  }

  if (once) {
    // 单次检查模式
    const result = heartbeatCmd.checkOnce(sharedDir, agentId);
    console.log(heartbeatCmd.formatHeartbeatStatus(result));
    process.exit(result.hasHighPriority ? 2 : 0);
  } else {
    // 长驻模式
    console.log(`💓 心跳监控启动 — ${agentId} (每 ${interval}s 检查一次)`);
    console.log('   按 Ctrl+C 停止');
    console.log('');

    heartbeatCmd.startHeartbeat(sharedDir, agentId, { interval });
  }
}

function cmdMcp() {
  // 启动 MCP server — 直接执行 mcp-server.js
  const mcpPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'commands', 'mcp-server.js');
  const shared = getSharedDir();

  // 设置环境变量传递 sharedDir
  process.env.COLLAB_SHARED_DIR = shared;

  // 动态导入并启动 MCP server
  import(mcpPath);
}

async function cmdNode() {
  const sharedDir = getSharedDir();
  const nodeSubcommand = subcommand;

  switch (nodeSubcommand) {
    case 'start': {
      const agents = getFlag('agents', 'claude-01');
      const port = getFlag('port', '9527');
      const token = getFlag('token');
      await nodeCmd.startNode(sharedDir, { agents, port, token });
      break;
    }
    case 'status': {
      const status = nodeCmd.nodeStatus();
      console.log(nodeCmd.formatNodeStatus(status));
      break;
    }
    default:
      console.error('用法: collab node <start|status>');
      console.error('  collab node start [--agents <id1,id2>] [--port <port>] [--token <token>]');
      console.error('  collab node status');
      process.exit(1);
  }
}

// ── 帮助和版本 ──

function showHelp() {
  console.log(`
collab — 多智能体协作任务体系 CLI

用法: collab <command> [subcommand] [options]

命令:
  init                           初始化协作体系
  status                         查看全局状态
  handshake <agent-id>           Agent 启动握手

  badge issue <id> --role <L>    签发工牌
  badge show <id>                查看工牌
  badge list                     列出所有工牌

  task create <title>            创建任务
  task list                      列出任务
  task status <id>               查看任务详情
  task update <id> <status>      更新任务状态

  inbox check <id>               检查未读消息
  inbox send                     发送消息
  inbox read <id> <msg-id>       阅读消息（标记已读）
  inbox done <id> <msg-id>       标记消息完成

  memory compact                 压缩记忆
  memory stats                   记忆统计
  memory archive <date>          归档指定日期

  conflict list                  列出冲突
  conflict resolve <id>          解决冲突

  heartbeat <agent-id>           启动 inbox 心跳监控
  heartbeat <agent-id> --once    单次检查（不长驻）

  mcp                            启动 MCP server（stdio JSON-RPC）

  node start                     启动 LAN 节点（跨设备协作）
  node status                    查看节点状态

选项:
  --shared <dir>                 指定 .shared/ 目录路径
  --project <name>               项目名称 (init)
  --migrate                      迁移现有文件 (init)
  --role <L0-L4>                 工牌角色级别
  --assigned-by <who>            工牌签发者
  --priority <P0-P3>             优先级
  --assignee <id>                指定执行人
  --from <id>                    发送者
  --to <id>                      接收者
  --title <text>                 标题
  --body <text>                  正文
  --needs-reply                  需要回复

示例:
  collab init --project "我的项目"
  collab badge issue claude-01 --role L4 --assigned-by user
  collab handshake claude-01
  collab task create "实现登录功能" --assignee claude-01 --priority P0
  collab inbox send --from workbuddy --to claude-01 --title "审查请求" --priority P1
  collab memory compact --agent claude-01
`);
}

function showVersion() {
  const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  console.log(`collab v${pkg.version}`);
}
