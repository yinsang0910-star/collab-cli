/**
 * mcp-server.js — Collab MCP Server (stdio JSON-RPC 2.0)
 *
 * 让任何 MCP 兼容的 agent（Reasonix、Claude Desktop 等）
 * 通过插件机制直接调用 collab 工具。
 *
 * 用法:
 *   node mcp-server.js [--shared <dir>]
 *
 * 在 reasonix.toml 中配置:
 *   [[plugins]]
 *   name = "collab"
 *   type = "stdio"
 *   command = "node"
 *   args = ["path/to/mcp-server.js", "--shared", ".shared"]
 */

import path from 'node:path';
import fs from 'node:fs';
import * as statusCmd from '../commands/status.js';
import * as badgeCmd from '../commands/badge.js';
import * as taskCmd from '../commands/task.js';
import * as inboxCmd from '../commands/inbox.js';
import * as memoryCmd from '../commands/memory.js';
import * as conflictCmd from '../commands/conflict.js';
import * as yaml from '../core/yaml.js';
import { now } from '../utils/timestamp.js';
import { handshake } from '../core/protocol.js';

// ── 配置 ──

let sharedDir = findSharedDir();

const args = process.argv.slice(2);
const sharedFlagIdx = args.indexOf('--shared');
if (sharedFlagIdx !== -1 && args[sharedFlagIdx + 1]) {
  sharedDir = path.resolve(args[sharedFlagIdx + 1]);
}

// ── 工具定义 ──

const TOOLS = [
  {
    name: 'collab_status',
    description: 'Get the global collaboration status: badges, tasks, inbox, memory stats, and conflicts.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'collab_handshake',
    description: 'Perform agent handshake: check SHARD, badge, inbox messages, and active tasks for an agent.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'The agent ID to perform handshake for' },
      },
      required: ['agent_id'],
    },
  },
  {
    name: 'collab_inbox_check',
    description: 'Check unread inbox messages for an agent. Returns messages sorted by priority.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent ID to check inbox for' },
        priority: { type: 'string', description: 'Filter by priority (P0/P1/P2/P3)', enum: ['P0', 'P1', 'P2', 'P3'] },
      },
      required: ['agent_id'],
    },
  },
  {
    name: 'collab_inbox_send',
    description: 'Send a message to another agent\'s inbox.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Sender agent ID' },
        to: { type: 'string', description: 'Recipient agent ID' },
        title: { type: 'string', description: 'Message title' },
        body: { type: 'string', description: 'Message body' },
        priority: { type: 'string', description: 'Priority level', enum: ['P0', 'P1', 'P2', 'P3'] },
        type: { type: 'string', description: 'Message type', enum: ['approval', 'review_request', 'question', 'notification', 'task', 'response'] },
        related_task: { type: 'string', description: 'Related task ID (optional)' },
        requires_response: { type: 'boolean', description: 'Whether a response is needed' },
      },
      required: ['from', 'to', 'title'],
    },
  },
  {
    name: 'collab_inbox_read',
    description: 'Read a specific message and mark it as read.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent ID who owns the inbox' },
        message_id: { type: 'string', description: 'Message ID (e.g. MSG-001)' },
      },
      required: ['agent_id', 'message_id'],
    },
  },
  {
    name: 'collab_task_create',
    description: 'Create a new task.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        assignee: { type: 'string', description: 'Assigned agent ID' },
        priority: { type: 'string', description: 'Priority level', enum: ['P0', 'P1', 'P2', 'P3'] },
        deadline: { type: 'string', description: 'Deadline (ISO 8601)' },
        description: { type: 'string', description: 'Task description' },
        acceptance: {
          type: 'array',
          items: { type: 'string' },
          description: 'Acceptance criteria',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'collab_task_list',
    description: 'List tasks with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status', enum: ['DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'] },
        assignee: { type: 'string', description: 'Filter by assignee agent ID' },
        priority: { type: 'string', description: 'Filter by priority', enum: ['P0', 'P1', 'P2', 'P3'] },
      },
      required: [],
    },
  },
  {
    name: 'collab_task_update',
    description: 'Update a task\'s status. Only the assignee can change status.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'Task ID (e.g. T-001)' },
        status: { type: 'string', description: 'New status', enum: ['DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'] },
        operator: { type: 'string', description: 'Who is performing the update' },
        note: { type: 'string', description: 'Progress note' },
      },
      required: ['task_id', 'status'],
    },
  },
  {
    name: 'collab_badge_issue',
    description: 'Issue a badge for an agent.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent ID' },
        role: { type: 'string', description: 'Role level', enum: ['L0', 'L1', 'L2', 'L3', 'L4'] },
        assigned_by: { type: 'string', description: 'Who issued the badge' },
        scope: {
          type: 'array',
          items: { type: 'string' },
          description: 'File scope patterns (e.g. ["v5.0_options/**"])',
        },
      },
      required: ['agent_id', 'role'],
    },
  },
  {
    name: 'collab_memory_stats',
    description: 'Get memory layer statistics: SHARD size, L1 files, L2 archives.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'collab_memory_compact',
    description: 'Trigger memory compaction: auto-archive old SHARD entries and check L1 sizes.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent performing the compaction' },
      },
      required: [],
    },
  },
  {
    name: 'collab_conflict_list',
    description: 'List unresolved conflicts.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status', enum: ['open', 'resolved'] },
      },
      required: [],
    },
  },
  {
    name: 'collab_memory_write',
    description: 'Write a memory fragment to L1 memory layer (max 50 lines per file).',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Memory filename (e.g. "lessons.md")' },
        content: { type: 'string', description: 'Content to write (appends if file exists)' },
        agent_id: { type: 'string', description: 'Agent writing the memory' },
      },
      required: ['filename', 'content'],
    },
  },
  {
    name: 'collab_shard_update',
    description: 'Update SHARD.md live memory. Requires L3+ permission.',
    inputSchema: {
      type: 'object',
      properties: {
        section: { type: 'string', description: 'Section to update (e.g. "当前焦点", "待办")' },
        content: { type: 'string', description: 'New content for the section' },
        agent_id: { type: 'string', description: 'Agent updating the SHARD' },
      },
      required: ['section', 'content', 'agent_id'],
    },
  },
  {
    name: 'collab_peer_list',
    description: 'List discovered LAN peers (only available when collab node is running).',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'collab_conflict_create',
    description: 'Create a conflict record when two agents try to modify the same file.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'The conflicting file path' },
        agent1: { type: 'string', description: 'First agent ID' },
        agent2: { type: 'string', description: 'Second agent ID' },
        reason: { type: 'string', description: 'Description of the conflict' },
      },
      required: ['file', 'agent1', 'agent2', 'reason'],
    },
  },
];

// ── MCP 协议处理 ──

const SERVER_INFO = {
  name: 'collab',
  version: '1.0.2',
};

function handleRequest(request) {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      };

    case 'notifications/initialized':
      // No response needed for notifications
      return null;

    case 'tools/list':
      return { tools: TOOLS };

    case 'tools/call':
      return handleToolCall(params);

    default:
      throw { code: -32601, message: `Method not found: ${method}` };
  }
}

function handleToolCall(params) {
  const { name, arguments: args } = params;

  try {
    let result;
    switch (name) {
      case 'collab_status': {
        const report = statusCmd.status(sharedDir);
        result = statusCmd.formatStatus(report);
        break;
      }
      case 'collab_handshake': {
        const report = handshake(sharedDir, args.agent_id);
        result = formatHandshakeReport(report);
        break;
      }
      case 'collab_inbox_check': {
        const messages = inboxCmd.check(sharedDir, args.agent_id, {
          priority: args.priority,
        });
        result = inboxCmd.formatMessageList(messages);
        break;
      }
      case 'collab_inbox_send': {
        const sendResult = inboxCmd.send(sharedDir, {
          from: args.from,
          to: args.to,
          title: args.title,
          body: args.body || '',
          priority: args.priority || 'P2',
          type: args.type || 'notification',
          relatedTask: args.related_task,
          requiresResponse: args.requires_response || false,
        });
        result = sendResult.success
          ? `Message sent: ${sendResult.id}`
          : `Error: ${sendResult.error}`;
        break;
      }
      case 'collab_inbox_read': {
        const detail = inboxCmd.formatMessageDetail(sharedDir, args.agent_id, args.message_id);
        inboxCmd.markRead(sharedDir, args.agent_id, args.message_id);
        result = detail;
        break;
      }
      case 'collab_task_create': {
        const createResult = taskCmd.create(sharedDir, {
          title: args.title,
          assignee: args.assignee,
          priority: args.priority || 'P2',
          deadline: args.deadline,
          description: args.description,
          acceptance: args.acceptance,
          createdBy: args.assignee || 'user',
        });
        result = createResult.success
          ? `Task created: ${createResult.id}\nFile: ${createResult.path}`
          : `Error: ${createResult.error}`;
        break;
      }
      case 'collab_task_list': {
        const tasks = taskCmd.list(sharedDir, {
          status: args.status,
          assignee: args.assignee,
          priority: args.priority,
        });
        result = taskCmd.formatTaskList(tasks);
        break;
      }
      case 'collab_task_update': {
        const updateResult = taskCmd.updateStatus(sharedDir, args.task_id, args.status, {
          operator: args.operator || 'system',
          note: args.note,
        });
        result = updateResult.success
          ? `${args.task_id}: ${updateResult.oldStatus} → ${updateResult.newStatus}`
          : `Error: ${updateResult.error}`;
        break;
      }
      case 'collab_badge_issue': {
        const badgeResult = badgeCmd.issue(sharedDir, {
          agentId: args.agent_id,
          role: args.role,
          assignedBy: args.assigned_by || 'user',
          scope: args.scope,
        });
        result = badgeResult.success
          ? `Badge issued: ${badgeResult.path}`
          : `Error: ${badgeResult.error}`;
        break;
      }
      case 'collab_memory_stats': {
        const stats = memoryCmd.stats(sharedDir);
        result = memoryCmd.formatStats(stats);
        break;
      }
      case 'collab_memory_compact': {
        const compactResult = memoryCmd.compact(sharedDir, args.agent_id || 'system');
        result = compactResult.messages.join('\n');
        break;
      }
      case 'collab_conflict_list': {
        const conflicts = conflictCmd.list(sharedDir, { status: args.status });
        result = conflictCmd.formatConflictList(conflicts);
        break;
      }
      case 'collab_memory_write': {
        const memDir = path.join(sharedDir, 'memory');
        if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });
        const memPath = path.join(memDir, args.filename);
        const existing = fs.existsSync(memPath) ? fs.readFileSync(memPath, 'utf-8') : '';
        const timestamp = now();
        const entry = `\n\n## ${timestamp} (${args.agent_id || 'agent'})\n\n${args.content}`;
        fs.writeFileSync(memPath, existing + entry, 'utf-8');
        result = `Memory written to memory/${args.filename}`;
        break;
      }
      case 'collab_shard_update': {
        const shardPath = path.join(sharedDir, 'SHARD.md');
        const { data, content } = yaml.safeRead(shardPath);
        // 简单的 section 替换
        const sectionRegex = new RegExp(`(## ${args.section}[\\s\\S]*?)(?=## |$)`);
        if (content.match(sectionRegex)) {
          const newContent = content.replace(sectionRegex, `## ${args.section}\n\n${args.content}\n`);
          yaml.write(shardPath, { ...data, last_updated_by: args.agent_id, last_updated_at: now() }, newContent);
          result = `SHARD section "${args.section}" updated`;
        } else {
          result = `Section "${args.section}" not found in SHARD`;
        }
        break;
      }
      case 'collab_peer_list': {
        // 从 LAN node 的内存状态读取（如果有的话）
        result = 'Peer listing requires collab node to be running. Use `collab node status` instead.';
        break;
      }
      case 'collab_conflict_create': {
        const cResult = conflictCmd.create(sharedDir, {
          file: args.file,
          agent1: args.agent1,
          agent2: args.agent2,
          reason: args.reason,
        });
        result = cResult.success
          ? `Conflict record created: ${cResult.id}`
          : `Error creating conflict: ${cResult.error}`;
        break;
      }
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: 'text', text: String(result) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    };
  }
}

// ── stdio JSON-RPC 传输 ──

let buffer = '';

process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;

  // MCP stdio: 一行一个 JSON-RPC 消息
  const lines = buffer.split('\n');
  buffer = lines.pop(); // 保留不完整的行

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const request = JSON.parse(trimmed);
      const response = processMessage(request);
      if (response !== null) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (err) {
      // JSON parse error
      const errorResponse = {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

function processMessage(request) {
  // Notification (no id) → no response
  if (request.id === undefined || request.id === null) {
    if (request.method === 'notifications/initialized') return null;
    if (request.method === 'notifications/cancelled') return null;
    // Other notifications: still no response
    if (!request.id && request.id !== 0) return null;
  }

  try {
    const result = handleRequest(request);
    return {
      jsonrpc: '2.0',
      id: request.id,
      result,
    };
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: err.code ? err : { code: -32603, message: err.message },
    };
  }
}

// ── 工具函数 ──

function findSharedDir() {
  let cwd = process.cwd();
  while (cwd !== path.dirname(cwd)) {
    const candidate = path.join(cwd, '.shared');
    if (fs.existsSync(candidate)) return candidate;
    cwd = path.dirname(cwd);
  }
  return path.join(process.cwd(), '.shared');
}

function formatHandshakeReport(report) {
  const lines = [];

  if (report.manifest) {
    lines.push(`Project: ${report.manifest.project} (v${report.manifest.version})`);
    lines.push(`Chief Engineer: ${report.manifest.chiefEngineer}`);
  }

  if (report.badge) {
    lines.push(`Badge: ${report.badge.role} (${report.badge.assignedBy})`);
  } else {
    lines.push('Badge: NOT ISSUED');
  }

  if (report.unreadMessages.length > 0) {
    lines.push(`\nUnread Messages: ${report.unreadMessages.length}`);
    for (const m of report.unreadMessages) {
      lines.push(`  ${m.priority} | ${m.from} | ${m.title}${m.requiresResponse ? ' [RESPONSE REQUIRED]' : ''}`);
    }
  } else {
    lines.push('\nNo unread messages');
  }

  if (report.activeTasks.length > 0) {
    lines.push(`\nActive Tasks: ${report.activeTasks.length}`);
    for (const t of report.activeTasks) {
      lines.push(`  ${t.id} | ${t.priority} | ${t.title} | ${t.status}`);
    }
  }

  if (report.actions.length > 0) {
    lines.push('\nSuggested Actions:');
    for (const a of report.actions) {
      lines.push(`  → ${a}`);
    }
  }

  return lines.join('\n');
}

// 启动日志（stderr，不干扰 stdout 的 JSON-RPC）
process.stderr.write(`[collab-mcp] Server started, sharedDir: ${sharedDir}\n`);
