/**
 * protocol.js — Agent 启动握手协议
 *
 * 定义每个 agent 进入项目时的强制流程：
 *   1. 读 MANIFEST.md — 了解系统规则
 *   2. 读 SHARD.md — 了解当前状态
 *   3. 读/申请工牌
 *   4. 检查 inbox 未读消息
 *   5. 检查活跃任务
 */

import fs from 'node:fs';
import path from 'node:path';
import * as yaml from './yaml.js';
import { now, sessionId } from '../utils/timestamp.js';

const ROLE_HIERARCHY = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };

/**
 * 执行握手协议，返回结构化的状态报告
 *
 * @param {string} sharedDir - .shared/ 目录路径
 * @param {string} agentId - 当前 agent ID
 * @returns {HandshakeReport}
 *
 * @typedef {Object} HandshakeReport
 * @property {boolean} ok - 握手是否成功
 * @property {Object|null} manifest - 系统声明
 * @property {Object|null} shard - SHARD 摘要
 * @property {Object|null} badge - 工牌信息（null 表示需要申请）
 * @property {Object[]} unreadMessages - 未读 inbox 消息
 * @property {Object[]} activeTasks - 活跃任务
 * @property {string[]} warnings - 警告信息
 * @property {string[]} actions - 需要 agent 执行的动作
 */
export function handshake(sharedDir, agentId) {
  const report = {
    ok: true,
    manifest: null,
    shard: null,
    badge: null,
    unreadMessages: [],
    activeTasks: [],
    warnings: [],
    actions: [],
  };

  // Step 1: 读 MANIFEST.md
  const manifestPath = path.join(sharedDir, 'MANIFEST.md');
  if (!fs.existsSync(manifestPath)) {
    report.ok = false;
    report.actions.push('MANIFEST.md 不存在。请先运行 `collab init` 初始化协作体系。');
    return report;
  }

  const manifest = yaml.read(manifestPath);
  report.manifest = {
    project: manifest.data.project || 'Unknown',
    version: manifest.data.version || '0.0.0',
    chiefEngineer: manifest.data.chief_engineer || 'unassigned',
  };

  // Step 2: 读 SHARD.md
  const shardPath = path.join(sharedDir, 'SHARD.md');
  if (fs.existsSync(shardPath)) {
    const shard = yaml.read(shardPath);
    report.shard = {
      version: shard.data.version || 0,
      lastUpdatedBy: shard.data.last_updated_by || 'unknown',
      lastUpdatedAt: shard.data.last_updated_at || 'unknown',
    };
  } else {
    report.warnings.push('SHARD.md 不存在，项目状态未知。');
  }

  // Step 3: 读工牌
  const badgePath = path.join(sharedDir, `BADGE-${agentId}.md`);
  if (fs.existsSync(badgePath)) {
    const badge = yaml.read(badgePath);
    report.badge = {
      agentId: badge.data.agent_id,
      sessionId: badge.data.session_id,
      role: badge.data.role,
      assignedBy: badge.data.assigned_by,
      capabilities: badge.data.capabilities || [],
      restrictions: badge.data.restrictions || [],
      scope: badge.data.scope || [],
      issuedAt: badge.data.issued_at,
    };
  } else {
    report.actions.push(`工牌 BADGE-${agentId}.md 不存在。需要向用户申请工牌。`);

    // 检查是否需要选举总工
    const manifestAgents = parseAgentTable(manifest.content);
    const chiefEngineer = manifest.data.chief_engineer;
    if (chiefEngineer === 'user' || !chiefEngineer) {
      // 总工由用户指定，不需要自动选举
    } else if (!manifestAgents.some(a => a.id === chiefEngineer)) {
      report.actions.push(`注册的总工 ${chiefEngineer} 不在 agent 注册表中。`);
    }
  }

  // Step 4: 检查 inbox
  const inboxDir = path.join(sharedDir, 'inbox', agentId);
  if (fs.existsSync(inboxDir)) {
    const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const filePath = path.join(inboxDir, file);
      const msg = yaml.safeRead(filePath);
      if (msg.data.status === 'unread') {
        report.unreadMessages.push({
          file,
          id: msg.data.id || file,
          from: msg.data.from || 'unknown',
          priority: msg.data.priority || 'P3',
          type: msg.data.type || 'notification',
          title: extractTitle(msg.content),
          createdAt: msg.data.created_at || 'unknown',
          requiresResponse: msg.data.requires_response || false,
        });
      }
    }

    // 按优先级排序（P0 > P1 > P2 > P3）
    report.unreadMessages.sort((a, b) => {
      const pa = parseInt(a.priority.replace('P', ''));
      const pb = parseInt(b.priority.replace('P', ''));
      return pa - pb;
    });
  }

  // Step 5: 检查活跃任务
  const tasksDir = path.join(sharedDir, 'tasks');
  if (fs.existsSync(tasksDir)) {
    const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const filePath = path.join(tasksDir, file);
      const task = yaml.safeRead(filePath);
      const status = task.data.status;
      const assignee = task.data.assignee;

      if (['IN_PROGRESS', 'ASSIGNED'].includes(status) && assignee === agentId) {
        report.activeTasks.push({
          file,
          id: task.data.id || file.replace('.md', ''),
          title: task.data.title || 'Untitled',
          status,
          priority: task.data.priority || 'P3',
          deadline: task.data.deadline || null,
        });
      }
    }
  }

  // 生成行动建议
  const p0p1 = report.unreadMessages.filter(m =>
    m.priority === 'P0' || m.priority === 'P1'
  );
  if (p0p1.length > 0) {
    report.actions.unshift(
      `⚠️ 有 ${p0p1.length} 条 P0/P1 未读消息，建议优先处理：${p0p1.map(m => m.id).join(', ')}`
    );
  }

  if (report.activeTasks.length > 0) {
    report.actions.push(
      `📋 你有 ${report.activeTasks.length} 个活跃任务：${report.activeTasks.map(t => t.id).join(', ')}`
    );
  }

  return report;
}

/**
 * 生成工牌文件内容
 *
 * @param {Object} params
 * @param {string} params.agentId
 * @param {string} params.role - L0/L1/L2/L3/L4
 * @param {string} params.assignedBy - user | chief-engineer | self-claim
 * @param {string[]} params.capabilities
 * @param {string[]} params.restrictions
 * @param {string[]} params.scope
 * @returns {{ data: Object, content: string }}
 */
export function createBadge({ agentId, role, assignedBy, capabilities, restrictions, scope }) {
  const sid = sessionId(agentId);
  const caps = capabilities || getDefaultCapabilities(role);
  const restraints = restrictions || getDefaultRestrictions(role);

  const data = {
    agent_id: agentId,
    session_id: sid,
    role,
    assigned_by: assignedBy,
    capabilities: caps,
    restrictions: restraints,
    scope: scope || ['**'],
    issued_at: now(),
    expires_at: 'session_end',
  };

  const content = [
    `# 工牌: ${agentId}`,
    '',
    `- **角色**: ${role} (${getRoleName(role)})`,
    `- **会话**: ${sid}`,
    `- **签发者**: ${assignedBy}`,
    `- **权限**: ${caps.join(', ')}`,
    restraints.length > 0 ? `- **限制**: ${restraints.join(', ')}` : null,
    `- **范围**: ${scope ? scope.join(', ') : '全部'}`,
    '',
  ].filter(Boolean).join('\n');

  return { data, content };
}

/**
 * 检查 agent 是否有指定权限
 *
 * @param {string} role - 当前角色
 * @param {string} action - 要执行的动作
 * @returns {boolean}
 */
export function hasPermission(role, action) {
  const permissions = {
    L0: ['read_shard', 'read_memory'],
    L1: ['read_shard', 'read_memory', 'write_own_tasks', 'write_inbox'],
    L2: ['read_shard', 'read_memory', 'write_own_tasks', 'write_inbox', 'write_memory', 'submit_review'],
    L3: ['read_shard', 'read_memory', 'write_own_tasks', 'write_inbox', 'write_memory',
         'submit_review', 'write_shard', 'review_tasks', 'assign_tasks'],
    L4: ['read_shard', 'read_memory', 'write_own_tasks', 'write_inbox', 'write_memory',
         'submit_review', 'write_shard', 'review_tasks', 'assign_tasks',
         'manage_badges', 'manage_conflicts', 'manage_manifest'],
  };

  const level = ROLE_HIERARCHY[role] ?? -1;
  for (const [lvl, perms] of Object.entries(permissions)) {
    if (ROLE_HIERARCHY[lvl] <= level && perms.includes(action)) {
      return true;
    }
  }
  return false;
}

// ── 内部工具 ──

function getDefaultCapabilities(role) {
  const caps = {
    L0: ['read_all'],
    L1: ['read_all', 'write_own_tasks', 'write_inbox'],
    L2: ['read_all', 'write_own_tasks', 'write_inbox', 'write_memory'],
    L3: ['read_all', 'write_all', 'review_tasks', 'write_shard'],
    L4: ['read_all', 'write_all', 'review_tasks', 'write_shard', 'manage_badges'],
  };
  return caps[role] || caps.L0;
}

function getDefaultRestrictions(role) {
  const rest = {
    L0: ['不可写入任何文件', '不可提交任务'],
    L1: ['不可修改 SHARD', '不可审批任务'],
    L2: ['不可审批任务', '不可管理工牌'],
    L3: ['不可升降他人工牌', '不可删除归档'],
    L4: [],
  };
  return rest[role] || rest.L0;
}

function getRoleName(role) {
  const names = { L0: '观察者', L1: '执行者', L2: '贡献者', L3: '审查者', L4: '总工' };
  return names[role] || '未知';
}

function parseAgentTable(markdownContent) {
  // 简单解析 Agent 注册表
  const lines = markdownContent.split('\n');
  const agents = [];
  let inTable = false;

  for (const line of lines) {
    if (line.includes('Agent ID') && line.includes('|')) {
      inTable = true;
      continue;
    }
    if (inTable && line.includes('---')) continue;
    if (inTable && line.trim().startsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        agents.push({ id: cells[0], type: cells[1] });
      }
    } else if (inTable && !line.trim().startsWith('|')) {
      inTable = false;
    }
  }

  return agents;
}

function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '(无标题)';
}
