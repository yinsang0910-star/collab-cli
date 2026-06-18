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
import * as setupCmd from '../src/commands/setup.js';
import * as dashboardCmd from '../src/commands/dashboard.js';
import * as gitSyncCmd from '../src/commands/git-sync.js';
import * as commandCmd from '../src/commands/command.js';
import * as reviewCmd from '../src/commands/review.js';
import * as discoverCmd from '../src/commands/discover.js';
import { executePendingCommands, formatExecutionReport } from '../src/commands/executor.js';
import { Orchestrator } from '../src/orchestrator/engine.js';
import * as pipelineCmd from '../src/orchestrator/pipeline.js';
import * as yaml from '../src/core/yaml.js';
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
    case 'setup':
      cmdSetup();
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
    case 'dashboard':
      cmdDashboard();
      break;
    case 'git':
      cmdGit();
      break;
    case 'cmd':
      cmdCmd();
      break;
    case 'review':
      cmdReview();
      break;
    case 'run':
      await cmdRun();
      break;
    case 'pipeline':
      await cmdPipeline();
      break;
    case 'agent':
      cmdAgent();
      break;
    case 'discover':
      cmdDiscover();
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
  console.log('  💡 或者直接运行 collab setup 进入交互式引导');
  console.log('');
}

function cmdSetup() {
  const sharedDir = getSharedDir();

  // 解析命令行参数（非交互模式）
  const devicesFlag = getFlag('devices', '1');
  const projectFlag = getFlag('project', path.basename(process.cwd()));
  const agentsFlag = getFlag('agents');

  const deviceCount = parseInt(devicesFlag);

  // 构建答案
  const answers = {
    project: projectFlag,
    devices: deviceCount,
  };

  if (deviceCount === 1) {
    // 单机模式
    const agentDefs = agentsFlag
      ? agentsFlag.split(',').map((a, i) => {
          const [id, type] = a.split(':');
          return { id: id.trim(), type: type?.trim() || 'Agent', role: i === 0 ? 'L4' : 'L2' };
        })
      : [{ id: 'claude-01', type: 'Claude Code', role: 'L4' }];

    answers.agents = agentDefs;
  } else {
    // 多机模式
    const devicesList = [];
    for (let i = 0; i < deviceCount; i++) {
      const deviceFlag = getFlag(`device-${i + 1}`);
      if (deviceFlag) {
        const [name, agentSpec] = deviceFlag.split(':');
        const agentParts = agentSpec.split(',');
        const agents = agentParts.map((a, j) => {
          const [id, type] = a.split('@');
          return { id: id.trim(), type: type?.trim() || 'Agent', role: i === 0 && j === 0 ? 'L4' : 'L2' };
        });
        devicesList.push({ name: name.trim(), agents });
      }
    }

    if (devicesList.length === 0) {
      // 默认值
      answers.devices_list = [
        { name: '设备A', agents: [{ id: 'codex-1', type: 'Codex', role: 'L4' }] },
        { name: '设备B', agents: [{ id: 'codex-2', type: 'Codex', role: 'L2' }] },
      ];
    } else {
      answers.devices_list = devicesList;
    }
  }

  const result = setupCmd.setup(sharedDir, answers);
  console.log(setupCmd.formatSetupResult(result));
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
    case 'check': {
      const agentId = args[2];
      const operation = args[3];
      if (!agentId || !operation) {
        console.error('用法: collab badge check <agent-id> <operation>');
        console.error('可用操作: write_shard, review_tasks, write_memory, manage_badges, manage_conflicts');
        process.exit(1);
      }
      const result = badgeCmd.check(sharedDir, agentId, operation);
      console.log(badgeCmd.formatCheckResult(result));
      if (!result.allowed) process.exit(1);
      break;
    }
    default:
      console.error('用法: collab badge <issue|show|list|check>');
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

function cmdDashboard() {
  const sharedDir = getSharedDir();
  const port = getFlag('port', '8080');
  dashboardCmd.startDashboard(sharedDir, port);
}

function cmdGit() {
  const sharedDir = getSharedDir();
  const gitSubcommand = subcommand;

  switch (gitSubcommand) {
    case 'init': {
      const result = gitSyncCmd.gitInit(sharedDir);
      console.log(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
      break;
    }
    case 'sync': {
      const agentId = getFlag('agent', 'system');
      const push = hasFlag('push');
      const pull = hasFlag('pull');
      const result = gitSyncCmd.gitSync(sharedDir, { agentId, push, pull });
      console.log(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
      break;
    }
    case 'status': {
      const status = gitSyncCmd.gitStatus(sharedDir);
      console.log(gitSyncCmd.formatGitStatus(status));
      break;
    }
    default:
      console.error('用法: collab git <init|sync|status>');
      console.error('  collab git init                  初始化 .shared/ 的 git 管理');
      console.error('  collab git sync [--push] [--pull] 自动 commit + push + pull');
      console.error('  collab git status                显示未同步的变更');
      process.exit(1);
  }
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
    case 'pull': {
      const host = getFlag('host', '127.0.0.1');
      const port = parseInt(getFlag('port', '9527'));
      const token = getFlag('token', '');
      const { pullFromPeer } = await import('../src/node/sync.js');
      console.log(`📥 从 ${host}:${port} 拉取数据...`);
      const result = await pullFromPeer(host, port, sharedDir, token);
      if (result.shard) {
        console.log(`   ✅ SHARD v${result.shard.version} 已同步`);
      }
      if (result.tasks) {
        console.log(`   ✅ ${result.tasks.count} 个任务已同步`);
      }
      if (!result.shard && !result.tasks) {
        console.log(`   ⚠️ 未获取到数据，请检查目标节点是否在线`);
      }
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

function cmdCmd() {
  const sharedDir = getSharedDir();
  const cmdSubcommand = subcommand;

  switch (cmdSubcommand) {
    case 'send': {
      const from = getFlag('from');
      const to = getFlag('to');
      const type = getFlag('type', 'command');
      const priority = getFlag('priority', 'P2');
      const instruction = getFlag('instruction') || getFlag('body', '');
      const taskId = getFlag('task');
      const context = getFlag('context');

      const result = commandCmd.createCommand(sharedDir, {
        from, to, type, priority, instruction, task_id: taskId, context,
      });

      if (result.success) {
        console.log(`✅ 指令已发送: ${result.id}`);
      } else {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }
      break;
    }
    case 'list': {
      const to = getFlag('to');
      const from = getFlag('from');
      const status = getFlag('status');
      const commands = commandCmd.listCommands(sharedDir, { to, from, status });
      console.log(commandCmd.formatCommandList(commands));
      break;
    }
    case 'exec': {
      const agentId = getFlag('agent');
      if (!agentId) {
        console.error('用法: collab cmd exec --agent <id>');
        process.exit(1);
      }
      // 同步执行待处理指令
      executePendingCommands(sharedDir, agentId, async (cmd) => {
        console.log(`   执行: ${cmd.id} — ${cmd.instruction?.split('\n')[0]?.slice(0, 60)}`);
        // 默认执行器：只处理 notify 类型
        if (cmd.type === 'notify') {
          return { success: true, result: '已通知' };
        }
        return { success: false, result: '需要 agent 自行执行' };
      }).then(report => {
        const text = formatExecutionReport(report);
        if (text) console.log(text);
      });
      break;
    }
    case 'status': {
      const cmdId = args[3];
      if (!cmdId) {
        console.error('用法: collab cmd status <cmd-id>');
        process.exit(1);
      }
      const cmd = commandCmd.getCommand(sharedDir, cmdId);
      console.log(commandCmd.formatCommandDetail(cmd));
      break;
    }
    default:
      console.error('用法: collab cmd <send|list|exec|status>');
      console.error('  collab cmd send --from A --to B --type command --instruction "做X"');
      console.error('  collab cmd list [--to <id>] [--status pending]');
      console.error('  collab cmd exec --agent <id>');
      console.error('  collab cmd status <cmd-id>');
      process.exit(1);
  }
}

function cmdReview() {
  const sharedDir = getSharedDir();
  const reviewSubcommand = subcommand;

  switch (reviewSubcommand) {
    case 'create': {
      const taskId = getFlag('task');
      const requestedBy = getFlag('by', 'system');
      const checks = getFlag('checks') ? getFlag('checks').split(',') : null;

      const result = reviewCmd.createReview(sharedDir, { taskId, requestedBy, checks });
      if (result.success) {
        console.log(`✅ 审查已创建: ${result.id}`);
      } else {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }
      break;
    }
    case 'submit': {
      const reviewId = args[3];
      const checkName = args[4];
      const passed = getFlag('passed', 'true') === 'true';
      const score = parseInt(getFlag('score', '80'));
      const notes = getFlag('notes', '');
      const reviewer = getFlag('reviewer', 'system');

      const result = reviewCmd.submitCheck(sharedDir, reviewId, checkName, {
        reviewer, passed, score, notes,
      });

      if (result.success) {
        console.log(`✅ 审查维度 "${checkName}" 已提交`);
        if (result.allDone) {
          console.log(`   审查 ${reviewId} 全部完成: ${result.status}`);
        }
      } else {
        console.error(`❌ ${result.error}`);
      }
      break;
    }
    case 'self': {
      const taskId = args[3];
      const agentId = getFlag('agent', 'system');

      if (!taskId) {
        console.error('用法: collab review self <task-id> --agent <id>');
        process.exit(1);
      }

      const result = reviewCmd.selfReview(sharedDir, taskId, agentId);
      console.log(reviewCmd.formatReview(result.review));

      if (result.passed) {
        console.log('\n✅ 自审通过，可以提交用户确认');
      } else {
        console.log('\n❌ 自审未通过，需要修改后重新审查');
      }
      break;
    }
    case 'status': {
      const reviewId = args[3];
      if (!reviewId) {
        console.error('用法: collab review status <review-id>');
        process.exit(1);
      }
      const review = reviewCmd.getReview(sharedDir, reviewId);
      console.log(reviewCmd.formatReview(review));
      break;
    }
    default:
      console.error('用法: collab review <create|submit|self|status>');
      console.error('  collab review create --task T-xxx --by agent-id');
      console.error('  collab review submit <review-id> <check-name> --passed true --score 85');
      console.error('  collab review self <task-id> --agent agent-id');
      console.error('  collab review status <review-id>');
      process.exit(1);
  }
}

async function cmdRun() {
  const sharedDir = getSharedDir();
  const agentId = subcommand;
  const prompt = args.slice(3).join(' ');

  if (!agentId || !prompt) {
    console.error('用法: collab run <agent-id> "prompt"');
    console.error('  collab run claude-01 "审查 src/auth/login.py"');
    console.error('  collab run codex-01 "运行测试"');
    process.exit(1);
  }

  // 加载 orchestrator 配置
  const orch = new Orchestrator(sharedDir);
  const configPath = path.join(sharedDir, 'orchestrator.yaml');

  if (fs.existsSync(configPath)) {
    // 配置文件已存在，自动注册
  } else {
    // 根据 agentId 推断类型
    const type = inferAgentType(agentId);
    orch.registerAgent(agentId, {
      type,
      timeout: parseInt(getFlag('timeout', '300000')),
      model: getFlag('model'),
    });
  }

  console.log(`🚀 执行: ${agentId} ← "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`);
  console.log('');

  const result = await orch.run(agentId, prompt, {
    timeout: parseInt(getFlag('timeout', '300000')),
    model: getFlag('model'),
  });

  if (result.success) {
    console.log(`✅ 完成 (${(result.duration / 1000).toFixed(1)}s)`);
    console.log('─'.repeat(50));
    console.log(result.output);
    if (result.sessionId) {
      console.log(`\n💡 会话 ID: ${result.sessionId}（可用于续接）`);
    }
  } else {
    console.error(`❌ 失败: ${result.error}`);
    process.exit(1);
  }
}

async function cmdPipeline() {
  const sharedDir = getSharedDir();
  const pipeSubcommand = subcommand;

  switch (pipeSubcommand) {
    case 'list': {
      const pipelines = pipelineCmd.listPipelines(sharedDir);
      console.log(pipelineCmd.formatPipelineList(pipelines));
      break;
    }
    case 'run': {
      const pipelineId = args[3];
      if (!pipelineId) {
        console.error('用法: collab pipeline run <pipeline-id>');
        process.exit(1);
      }

      const pipeline = pipelineCmd.loadPipeline(sharedDir, pipelineId);
      if (!pipeline) {
        console.error(`流水线 ${pipelineId} 不存在`);
        process.exit(1);
      }

      const orch = new Orchestrator(sharedDir);
      // 注册流水线中用到的所有 agent
      const agentTypes = new Set(pipeline.steps.map(s => inferAgentType(s.agent)));
      for (const type of agentTypes) {
        // 会在执行时自动按需注册
      }

      // 手动注册所有步骤中的 agent
      for (const step of pipeline.steps) {
        if (!orch.agents.has(step.agent)) {
          orch.registerAgent(step.agent, {
            type: inferAgentType(step.agent),
            timeout: 300000,
          });
        }
      }

      console.log(`📋 执行流水线: ${pipeline.name}`);
      console.log(`   步骤: ${pipeline.steps.length}`);
      console.log('');

      const execId = `EX-${Date.now()}`;
      pipelineCmd.updatePipelineStatus(sharedDir, pipelineId, 'running', execId);

      const result = await orch.executePipeline(pipeline);

      pipelineCmd.updatePipelineStatus(sharedDir, pipelineId,
        result.needsApproval ? 'awaiting_approval' : 'completed',
        execId
      );

      console.log('');
      console.log('═'.repeat(50));
      console.log(`📋 流水线 ${pipeline.name} 执行完成`);
      console.log(`   执行 ID: ${result.executionId}`);

      for (const [stepId, output] of Object.entries(result.results)) {
        const isError = String(output).startsWith('ERROR:');
        console.log(`\n   ${isError ? '❌' : '✅'} ${stepId}:`);
        console.log(`   ${String(output).slice(0, 200)}${String(output).length > 200 ? '...' : ''}`);
      }

      if (result.needsApproval) {
        console.log('\n   ⏳ 等待用户确认...');
      }

      break;
    }
    case 'create': {
      const file = getFlag('file');
      if (!file) {
        console.error('用法: collab pipeline create --file pipeline.yaml');
        process.exit(1);
      }

      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        console.error(`文件不存在: ${filePath}`);
        process.exit(1);
      }

      const { data } = yaml.read(filePath);
      const result = pipelineCmd.createPipeline(sharedDir, data);
      if (result.success) {
        console.log(`✅ 流水线已创建: ${result.id}`);
        console.log(`   文件: ${result.path}`);
      } else {
        console.error('创建失败');
      }
      break;
    }
    default:
      console.error('用法: collab pipeline <list|run|create>');
      console.error('  collab pipeline list                    列出流水线');
      console.error('  collab pipeline run <id>                执行流水线');
      console.error('  collab pipeline create --file <path>    创建流水线');
      process.exit(1);
  }
}

function cmdAgent() {
  const sharedDir = getSharedDir();
  const agentSubcommand = subcommand;

  switch (agentSubcommand) {
    case 'list': {
      const configPath = path.join(sharedDir, 'orchestrator.yaml');
      if (!fs.existsSync(configPath)) {
        console.log('📋 未配置编排器。运行 collab init 或创建 .shared/orchestrator.yaml');
        break;
      }
      const { data } = yaml.safeRead(configPath);
      if (!data.agents || Object.keys(data.agents).length === 0) {
        console.log('📋 无注册 agent');
        break;
      }
      console.log('📋 已注册 Agent:');
      for (const [id, config] of Object.entries(data.agents)) {
        console.log(`   ${id}: type=${config.type}, timeout=${config.timeout || 300000}ms`);
      }
      break;
    }
    case 'test': {
      const agentId = args[3];
      if (!agentId) {
        console.error('用法: collab agent test <agent-id>');
        process.exit(1);
      }

      const orch = new Orchestrator(sharedDir);
      const type = inferAgentType(agentId);
      orch.registerAgent(agentId, { type, timeout: 30000 });

      console.log(`🧪 测试 agent: ${agentId} (type: ${type})`);

      orch.testAgent(agentId).then(result => {
        if (result.success) {
          console.log(`✅ ${agentId} 可用 (${(result.duration / 1000).toFixed(1)}s)`);
        } else {
          console.error(`❌ ${agentId} 不可用: ${result.error}`);
        }
      });
      break;
    }
    default:
      console.error('用法: collab agent <list|test>');
      process.exit(1);
  }
}

/**
 * 根据 agent ID 推断类型
 */
function cmdDiscover() {
  const projectRoot = process.cwd();
  const agents = discoverCmd.discoverAgents(projectRoot);
  console.log(discoverCmd.formatDiscovery(agents));

  if (hasFlag('generate-config')) {
    const config = discoverCmd.generateConfig(agents);
    console.log('\n--- 生成的 orchestrator.yaml ---');
    console.log(config);
  }
}

function inferAgentType(agentId) {
  const id = agentId.toLowerCase();
  if (id.includes('claude')) return 'claude';
  if (id.includes('reasonix') || id.includes('rx')) return 'reasonix';
  if (id.includes('codex')) return 'codex';
  if (id.includes('aider')) return 'aider';
  if (id.includes('workbuddy') || id.includes('wb')) return 'workbuddy';
  if (id.includes('cursor')) return 'cursor';
  if (id.includes('windsurf') || id.includes('codeium')) return 'windsurf';
  if (id.includes('devin')) return 'devin';
  if (id.includes('copilot')) return 'copilot';
  if (id.includes('continue')) return 'continue';
  return 'generic';
}

function showHelp() {
  console.log(`
collab — 多智能体协作任务体系 CLI

用法: collab <command> [subcommand] [options]

命令:
  setup                          交互式引导（推荐新手使用）
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

  dashboard                      启动 Web 控制面板（默认 :8080）
  dashboard --port 8080          自定义端口

  git init                       初始化 .shared/ 的 git 管理
  git sync [--push] [--pull]     自动 commit + push + pull
  git status                     显示未同步的变更

  cmd send --from A --to B       发送指令给另一个 agent
  cmd list [--to <id>]           列出待处理指令
  cmd exec --agent <id>          执行待处理指令
  cmd status <cmd-id>            查看指令详情

  review create --task <id>      创建审查请求
  review self <task-id>          自审（自检清单）
  review submit <id> <check>     提交审查结果
  review status <id>             查看审查状态

  run <agent-id> "prompt"        编排器：直接调用 agent
  pipeline list                  列出流水线
  pipeline run <id>              执行流水线
  pipeline create --file <path>  创建流水线
  agent list                     列出已注册 agent
  agent test <id>                测试 agent 是否可用

  discover                       自动检测已安装的 agent
  discover --generate-config     检测并生成 orchestrator.yaml

  node start                     启动 LAN 节点（跨设备协作）
  node pull --host <ip>          从远程节点拉取 SHARD + tasks
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
