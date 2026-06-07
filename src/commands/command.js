/**
 * command.js — Agent 间指令系统
 *
 * 让一个 agent 直接向另一个 agent 发送可执行的指令。
 * 接收方在启动握手时或通过心跳自动检查并执行。
 *
 * 指令类型：
 * - command: 执行一个操作
 * - review: 审查某个任务
 * - approve: 审批通过
 * - reject: 打回重做
 * - notify: 仅通知
 * - delegate: 转发任务
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as yaml from '../core/yaml.js';
import { now } from '../utils/timestamp.js';

const VALID_TYPES = ['command', 'review', 'approve', 'reject', 'notify', 'delegate'];
const VALID_STATUSES = ['pending', 'executing', 'completed', 'failed', 'cancelled'];

/**
 * 创建指令
 *
 * @param {string} sharedDir
 * @param {Object} opts
 * @returns {{ success: boolean, id?: string, path?: string, error?: string }}
 */
export function createCommand(sharedDir, {
  from, to, type, priority, task_id, instruction, context, deadline,
}) {
  if (!from) return { success: false, error: '缺少发送者 (from)' };
  if (!to) return { success: false, error: '缺少接收者 (to)' };
  if (!type || !VALID_TYPES.includes(type)) {
    return { success: false, error: `无效类型: ${type}，可选: ${VALID_TYPES.join(', ')}` };
  }
  if (!instruction) return { success: false, error: '缺少指令内容 (instruction)' };

  const cmdDir = path.join(sharedDir, 'commands');
  if (!fs.existsSync(cmdDir)) {
    fs.mkdirSync(cmdDir, { recursive: true });
  }

  const shortId = crypto.randomUUID().slice(0, 8);
  const cmdId = `CMD-${shortId}`;
  const fileName = `${cmdId}.yaml`;
  const filePath = path.join(cmdDir, fileName);

  const data = {
    id: cmdId,
    from,
    to,
    type,
    priority: priority || 'P2',
    status: 'pending',
    created_at: now(),
    task_id: task_id || null,
    deadline: deadline || null,
  };

  const content = [
    `# 指令: ${cmdId}`,
    `# ${from} → ${to} [${type}]`,
    '',
    '## 指令内容',
    '',
    instruction,
    '',
    context ? '## 上下文\n\n' + context : '',
    '',
    '## 执行结果',
    '',
    '_（由接收方填写）_',
    '',
  ].filter(Boolean).join('\n');

  yaml.write(filePath, data, content);

  return { success: true, id: cmdId, path: filePath };
}

/**
 * 列出指令
 *
 * @param {string} sharedDir
 * @param {Object} filters
 * @param {string} [filters.to] - 接收者
 * @param {string} [filters.from] - 发送者
 * @param {string} [filters.status] - 状态
 * @param {string} [filters.type] - 类型
 * @returns {Object[]}
 */
export function listCommands(sharedDir, { to, from, status, type } = {}) {
  const cmdDir = path.join(sharedDir, 'commands');
  if (!fs.existsSync(cmdDir)) return [];

  const files = fs.readdirSync(cmdDir).filter(f => f.endsWith('.yaml'));
  const commands = [];

  for (const file of files) {
    const { data, content } = yaml.safeRead(path.join(cmdDir, file));

    if (to && data.to !== to) continue;
    if (from && data.from !== from) continue;
    if (status && data.status !== status) continue;
    if (type && data.type !== type) continue;

    commands.push({
      id: data.id,
      from: data.from,
      to: data.to,
      type: data.type,
      priority: data.priority || 'P2',
      status: data.status || 'pending',
      task_id: data.task_id,
      created_at: data.created_at,
      deadline: data.deadline,
      instruction: extractSection(content, '指令内容'),
    });
  }

  // 按优先级排序
  commands.sort((a, b) => {
    const pa = parseInt((a.priority || 'P3').replace('P', ''));
    const pb = parseInt((b.priority || 'P3').replace('P', ''));
    return pa - pb;
  });

  return commands;
}

/**
 * 获取单个指令详情
 *
 * @param {string} sharedDir
 * @param {string} cmdId
 * @returns {Object|null}
 */
export function getCommand(sharedDir, cmdId) {
  const filePath = findCommandFile(sharedDir, cmdId);
  if (!filePath) return null;

  const { data, content } = yaml.read(filePath);
  return {
    ...data,
    instruction: extractSection(content, '指令内容'),
    context: extractSection(content, '上下文'),
    result: extractSection(content, '执行结果'),
    fullContent: content,
  };
}

/**
 * 更新指令状态
 *
 * @param {string} sharedDir
 * @param {string} cmdId
 * @param {string} newStatus
 * @param {Object} opts
 * @param {string} [opts.result] - 执行结果
 * @param {string} [opts.operator] - 操作者
 * @returns {{ success: boolean, error?: string }}
 */
export function updateCommand(sharedDir, cmdId, newStatus, { result, operator } = {}) {
  if (!VALID_STATUSES.includes(newStatus)) {
    return { success: false, error: `无效状态: ${newStatus}` };
  }

  const filePath = findCommandFile(sharedDir, cmdId);
  if (!filePath) return { success: false, error: `指令 ${cmdId} 不存在` };

  const { data, content } = yaml.read(filePath);

  // 状态机检查
  const allowed = {
    pending: ['executing', 'cancelled'],
    executing: ['completed', 'failed'],
    completed: [],
    failed: ['pending'], // 可以重试
    cancelled: [],
  };

  if (!allowed[data.status]?.includes(newStatus)) {
    return { success: false, error: `非法状态转换: ${data.status} → ${newStatus}` };
  }

  const oldStatus = data.status;
  data.status = newStatus;
  data.updated_at = now();
  data.updated_by = operator || 'system';

  if (newStatus === 'completed' || newStatus === 'failed') {
    data.completed_at = now();
  }

  // 写入执行结果
  let newContent = content;
  if (result) {
    newContent = content.replace(
      '_（由接收方填写）_',
      result
    );
  }

  yaml.write(filePath, data, newContent);

  return { success: true, oldStatus, newStatus };
}

/**
 * 获取 agent 的待执行指令（按优先级排序）
 *
 * @param {string} sharedDir
 * @param {string} agentId
 * @returns {Object[]}
 */
export function getPendingCommands(sharedDir, agentId) {
  return listCommands(sharedDir, { to: agentId, status: 'pending' });
}

/**
 * 标记指令为执行中
 *
 * @param {string} sharedDir
 * @param {string} cmdId
 * @param {string} agentId
 * @returns {{ success: boolean, error?: string }}
 */
export function startCommand(sharedDir, cmdId, agentId) {
  return updateCommand(sharedDir, cmdId, 'executing', { operator: agentId });
}

/**
 * 完成指令
 *
 * @param {string} sharedDir
 * @param {string} cmdId
 * @param {string} agentId
 * @param {string} result - 执行结果
 * @returns {{ success: boolean, error?: string }}
 */
export function completeCommand(sharedDir, cmdId, agentId, result) {
  return updateCommand(sharedDir, cmdId, 'completed', { operator: agentId, result });
}

/**
 * 标记指令失败
 *
 * @param {string} sharedDir
 * @param {string} cmdId
 * @param {string} agentId
 * @param {string} reason - 失败原因
 * @returns {{ success: boolean, error?: string }}
 */
export function failCommand(sharedDir, cmdId, agentId, reason) {
  return updateCommand(sharedDir, cmdId, 'failed', { operator: agentId, result: reason });
}

/**
 * 格式化指令列表
 */
export function formatCommandList(commands) {
  if (commands.length === 0) return '📨 无指令';

  const lines = ['📨 指令列表:', ''];
  lines.push('| ID | 类型 | 优先级 | 来自 | 状态 | 指令摘要 |');
  lines.push('|----|------|--------|------|------|----------|');

  for (const cmd of commands) {
    const summary = (cmd.instruction || '').split('\n')[0].slice(0, 40);
    lines.push(`| ${cmd.id} | ${cmd.type} | ${cmd.priority} | ${cmd.from} | ${cmd.status} | ${summary} |`);
  }

  return lines.join('\n');
}

/**
 * 格式化指令详情
 */
export function formatCommandDetail(cmd) {
  if (!cmd) return '指令不存在';

  const lines = [
    `📨 ${cmd.id}: ${cmd.type.toUpperCase()}`,
    `   来自: ${cmd.from} → ${cmd.to}`,
    `   优先级: ${cmd.priority} | 状态: ${cmd.status}`,
    `   创建: ${cmd.created_at}`,
    cmd.task_id ? `   关联任务: ${cmd.task_id}` : null,
    cmd.deadline ? `   截止: ${cmd.deadline}` : null,
    '',
    '## 指令内容',
    '',
    cmd.instruction,
    '',
  ];

  if (cmd.context) {
    lines.push('## 上下文', '', cmd.context, '');
  }

  if (cmd.result && cmd.result !== '_（由接收方填写）_') {
    lines.push('## 执行结果', '', cmd.result);
  }

  return lines.filter(Boolean).join('\n');
}

// ── 内部工具 ──

function findCommandFile(sharedDir, cmdId) {
  const cmdDir = path.join(sharedDir, 'commands');
  if (!fs.existsSync(cmdDir)) return null;

  const files = fs.readdirSync(cmdDir).filter(f => f.endsWith('.yaml'));

  for (const file of files) {
    if (file.includes(cmdId)) return path.join(cmdDir, file);

    const { data } = yaml.safeRead(path.join(cmdDir, file));
    if (data.id === cmdId) return path.join(cmdDir, file);
  }

  return null;
}

function extractSection(content, sectionName) {
  const regex = new RegExp(`## ${sectionName}\\n\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}
