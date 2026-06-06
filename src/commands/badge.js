/**
 * badge.js — collab badge 命令
 *
 * 管理工牌：签发、查看、续期
 */

import fs from 'node:fs';
import path from 'node:path';
import * as yaml from '../core/yaml.js';
import { createBadge, hasPermission } from '../core/protocol.js';

/**
 * 签发工牌
 *
 * @param {string} sharedDir
 * @param {Object} opts
 * @param {string} opts.agentId
 * @param {string} opts.role - L0/L1/L2/L3/L4
 * @param {string} opts.assignedBy - user | chief-engineer | agent-id
 * @param {string[]} opts.capabilities
 * @param {string[]} opts.restrictions
 * @param {string[]} opts.scope
 * @returns {{ success: boolean, path?: string, error?: string }}
 */
export function issue(sharedDir, { agentId, role, assignedBy, capabilities, restrictions, scope }) {
  if (!agentId) return { success: false, error: '缺少 agentId' };
  if (!role) return { success: false, error: '缺少 role (L0-L4)' };

  const validRoles = ['L0', 'L1', 'L2', 'L3', 'L4'];
  if (!validRoles.includes(role)) {
    return { success: false, error: `无效角色: ${role}，可选: ${validRoles.join(', ')}` };
  }

  const badgePath = path.join(sharedDir, `BADGE-${agentId}.md`);
  const { data, content } = createBadge({
    agentId,
    role,
    assignedBy: assignedBy || 'user',
    capabilities,
    restrictions,
    scope,
  });

  yaml.write(badgePath, data, content);

  // 同时注册到 MANIFEST
  registerAgent(sharedDir, agentId, role);

  return { success: true, path: badgePath };
}

/**
 * 查看工牌
 *
 * @param {string} sharedDir
 * @param {string} agentId
 * @returns {{ exists: boolean, data?: Object, error?: string }}
 */
export function show(sharedDir, agentId) {
  if (!agentId) return { exists: false, error: '缺少 agentId' };

  const badgePath = path.join(sharedDir, `BADGE-${agentId}.md`);
  if (!fs.existsSync(badgePath)) {
    return { exists: false, error: `工牌 BADGE-${agentId}.md 不存在` };
  }

  const { data } = yaml.read(badgePath);
  return { exists: true, data };
}

/**
 * 列出所有工牌
 *
 * @param {string} sharedDir
 * @returns {Object[]}
 */
export function list(sharedDir) {
  if (!fs.existsSync(sharedDir)) return [];

  const files = fs.readdirSync(sharedDir)
    .filter(f => f.startsWith('BADGE-') && f.endsWith('.md'));

  return files.map(f => {
    const { data } = yaml.read(path.join(sharedDir, f));
    return {
      agentId: data.agent_id,
      role: data.role,
      sessionId: data.session_id,
      assignedBy: data.assigned_by,
      issuedAt: data.issued_at,
    };
  });
}

/**
 * 格式化工牌信息
 * @param {Object} data
 * @returns {string}
 */
export function formatBadge(data) {
  if (!data) return '工牌不存在';

  const lines = [
    `🪪 工牌: ${data.agent_id}`,
    `   角色: ${data.role} (${getRoleName(data.role)})`,
    `   会话: ${data.session_id}`,
    `   签发: ${data.assigned_by}`,
    `   权限: ${(data.capabilities || []).join(', ')}`,
    `   限制: ${(data.restrictions || []).join(', ') || '无'}`,
    `   范围: ${(data.scope || ['**']).join(', ')}`,
    `   有效期: ${data.expires_at}`,
  ];
  return lines.join('\n');
}

// ── 内部工具 ──

function registerAgent(sharedDir, agentId, role) {
  const manifestPath = path.join(sharedDir, 'MANIFEST.md');
  if (!fs.existsSync(manifestPath)) return;

  const { data, content } = yaml.read(manifestPath);

  // 检查是否已注册
  if (content.includes(agentId)) return;

  // 在 Agent 注册表末尾追加
  const lines = content.split('\n');
  const tableEnd = findAgentTableEnd(lines);

  if (tableEnd !== -1) {
    const newRow = `| ${agentId} | Agent | ${getRoleName(role)} | ${role} | auto-registered |`;
    lines.splice(tableEnd, 0, newRow);
    yaml.write(manifestPath, data, lines.join('\n'));
  }
}

function findAgentTableEnd(lines) {
  let inTable = false;
  let lastTableRow = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Agent ID') && lines[i].includes('|')) {
      inTable = true;
      continue;
    }
    if (inTable && lines[i].includes('---')) continue;
    if (inTable && lines[i].trim().startsWith('|')) {
      lastTableRow = i;
    } else if (inTable && lastTableRow !== -1) {
      return lastTableRow + 1; // 在最后一行表格之后插入
    }
  }

  // 表格在文件末尾
  if (inTable && lastTableRow !== -1) return lastTableRow + 1;
  return -1;
}

function getRoleName(role) {
  const names = { L0: '观察者', L1: '执行者', L2: '贡献者', L3: '审查者', L4: '总工' };
  return names[role] || '未知';
}
