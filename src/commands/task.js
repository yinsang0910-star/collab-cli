/**
 * task.js — collab task 命令
 *
 * 任务生命周期管理：创建、列出、更新状态、完成
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as yaml from '../core/yaml.js';
import { now } from '../utils/timestamp.js';

const VALID_STATUSES = ['DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'];
const VALID_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

const STATUS_TRANSITIONS = {
  DRAFT: ['ASSIGNED', 'BLOCKED'],
  ASSIGNED: ['IN_PROGRESS', 'BLOCKED', 'DRAFT'],
  IN_PROGRESS: ['REVIEW', 'BLOCKED'],
  REVIEW: ['DONE', 'IN_PROGRESS'], // DONE=approved, IN_PROGRESS=rework
  BLOCKED: ['DRAFT', 'ASSIGNED', 'IN_PROGRESS'],
  DONE: [], // 终态
};

/**
 * 创建任务
 *
 * @param {string} sharedDir
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.assignee - agent-id
 * @param {string} opts.priority - P0/P1/P2/P3
 * @param {string} opts.reviewer - 审查者（默认: user）
 * @param {string} opts.createdBy
 * @param {string} opts.deadline
 * @param {string} opts.description
 * @param {string[]} opts.acceptance - 验收标准
 * @returns {{ success: boolean, id?: string, path?: string, error?: string }}
 */
export function create(sharedDir, { title, assignee, priority, reviewer, createdBy, deadline, description, acceptance }) {
  if (!title) return { success: false, error: '缺少任务标题' };

  const tasksDir = path.join(sharedDir, 'tasks');
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }

  // 生成唯一 ID（防碰撞）
  const shortId = crypto.randomUUID().slice(0, 8);
  const taskId = `T-${shortId}`;

  const safeTitle = title.replace(/[^a-zA-Z0-9一-鿿]/g, '-').slice(0, 40);
  const fileName = `${taskId}-${safeTitle}.md`;
  const filePath = path.join(tasksDir, fileName);

  const assigneeVal = assignee || null;
  const status = assigneeVal ? 'ASSIGNED' : 'DRAFT';

  const data = {
    id: taskId,
    title,
    status,
    priority: priority || 'P2',
    assignee: assigneeVal,
    reviewer: reviewer || 'user',
    created_by: createdBy || 'user',
    created_at: now(),
    deadline: deadline || null,
    depends_on: [],
    related_inbox: [],
  };

  const acceptanceLines = (acceptance || []).map(a => `- [ ] ${a}`);
  const content = [
    `# ${taskId}: ${title}`,
    '',
    description ? `${description}\n` : '',
    '## 验收标准',
    '',
    acceptanceLines.length > 0 ? acceptanceLines.join('\n') : '_（由总工定义）_',
    '',
    '## 进度日志',
    '',
    '| 时间 | 操作人 | 内容 |',
    '|------|--------|------|',
    `| ${now()} | ${createdBy || 'system'} | 任务创建 |`,
    '',
  ].filter(Boolean).join('\n');

  yaml.write(filePath, data, content);

  return { success: true, id: taskId, path: filePath };
}

/**
 * 列出任务
 *
 * @param {string} sharedDir
 * @param {Object} [filters]
 * @param {string} [filters.status]
 * @param {string} [filters.assignee]
 * @param {string} [filters.priority]
 * @returns {Object[]}
 */
export function list(sharedDir, filters = {}) {
  const tasksDir = path.join(sharedDir, 'tasks');
  if (!fs.existsSync(tasksDir)) return [];

  const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md'));
  const tasks = [];

  for (const file of files) {
    const { data } = yaml.safeRead(path.join(tasksDir, file));

    // 应用过滤器
    if (filters.status && data.status !== filters.status) continue;
    if (filters.assignee && data.assignee !== filters.assignee) continue;
    if (filters.priority && data.priority !== filters.priority) continue;

    tasks.push({
      id: data.id || file.replace('.md', ''),
      title: data.title || 'Untitled',
      status: data.status || 'DRAFT',
      priority: data.priority || 'P3',
      assignee: data.assignee || '-',
      reviewer: data.reviewer || '-',
      deadline: data.deadline || '-',
      createdAt: data.created_at || '-',
    });
  }

  // 按优先级排序
  tasks.sort((a, b) => {
    const pa = parseInt((a.priority || 'P3').replace('P', ''));
    const pb = parseInt((b.priority || 'P3').replace('P', ''));
    return pa - pb;
  });

  return tasks;
}

/**
 * 更新任务状态
 *
 * @param {string} sharedDir
 * @param {string} taskId - e.g. "T-001"
 * @param {string} newStatus
 * @param {Object} opts
 * @param {string} opts.operator - 操作者
 * @param {string} opts.note - 进度说明
 * @returns {{ success: boolean, error?: string }}
 */
export function updateStatus(sharedDir, taskId, newStatus, { operator, note } = {}) {
  if (!VALID_STATUSES.includes(newStatus)) {
    return { success: false, error: `无效状态: ${newStatus}，可选: ${VALID_STATUSES.join(', ')}` };
  }

  const filePath = findTaskFile(sharedDir, taskId);
  if (!filePath) return { success: false, error: `任务 ${taskId} 不存在` };

  const { data, content } = yaml.read(filePath);
  const oldStatus = data.status;

  // 检查状态转换合法性
  const allowed = STATUS_TRANSITIONS[oldStatus] || [];
  if (!allowed.includes(newStatus)) {
    return {
      success: false,
      error: `非法状态转换: ${oldStatus} → ${newStatus}。允许: ${allowed.join(', ') || '无（终态）'}`,
    };
  }

  data.status = newStatus;
  data.last_updated_at = now();

  // 追加进度日志
  const logEntry = `| ${now()} | ${operator || 'system'} | ${oldStatus} → ${newStatus}${note ? ': ' + note : ''} |`;
  const newContent = content.replace(
    /(\| 时间.*\|\n\|[-| ]+\|\n)/,
    `$1${logEntry}\n`
  );

  yaml.write(filePath, data, newContent);

  return { success: true, oldStatus, newStatus };
}

/**
 * 格式化任务列表
 * @param {Object[]} tasks
 * @returns {string}
 */
export function formatTaskList(tasks) {
  if (tasks.length === 0) return '📋 无任务';

  const lines = ['📋 任务列表:', ''];
  lines.push('| ID | 优先级 | 标题 | 负责人 | 状态 | 截止 |');
  lines.push('|----|--------|------|--------|------|------|');

  for (const t of tasks) {
    lines.push(`| ${t.id} | ${t.priority} | ${t.title} | ${t.assignee} | ${t.status} | ${t.deadline} |`);
  }

  return lines.join('\n');
}

/**
 * 格式化单个任务详情
 * @param {string} sharedDir
 * @param {string} taskId
 * @returns {string}
 */
export function formatTaskDetail(sharedDir, taskId) {
  const filePath = findTaskFile(sharedDir, taskId);
  if (!filePath) return `任务 ${taskId} 不存在`;

  const { data, content } = yaml.read(filePath);
  const lines = [
    `📋 ${data.id}: ${data.title}`,
    `   状态: ${data.status} | 优先级: ${data.priority}`,
    `   负责人: ${data.assignee || '-'} | 审查: ${data.reviewer || '-'}`,
    `   创建: ${data.created_at} | 截止: ${data.deadline || '-'}`,
    '',
    content,
  ];

  return lines.join('\n');
}

// ── 内部工具 ──

function findTaskFile(sharedDir, taskId) {
  const tasksDir = path.join(sharedDir, 'tasks');
  if (!fs.existsSync(tasksDir)) return null;

  const files = fs.readdirSync(tasksDir).filter(f => f.startsWith(taskId + '-'));
  if (files.length === 0) return null;

  return path.join(tasksDir, files[0]);
}
