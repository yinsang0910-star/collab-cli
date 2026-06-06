/**
 * inbox.js — collab inbox 命令
 *
 * 消息收件箱管理：检查、发送、标记已读
 */

import fs from 'node:fs';
import path from 'node:path';
import * as yaml from '../core/yaml.js';
import { now } from '../utils/timestamp.js';

const VALID_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const VALID_TYPES = ['approval', 'review_request', 'question', 'notification', 'task', 'response'];

/**
 * 检查未读消息
 *
 * @param {string} sharedDir
 * @param {string} agentId
 * @param {Object} [filters]
 * @param {string} [filters.priority] - 只显示指定优先级
 * @param {boolean} [filters.unreadOnly=true]
 * @returns {Object[]}
 */
export function check(sharedDir, agentId, { priority, unreadOnly = true } = {}) {
  const inboxDir = path.join(sharedDir, 'inbox', agentId);
  if (!fs.existsSync(inboxDir)) return [];

  const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.md'));
  const messages = [];

  for (const file of files) {
    const filePath = path.join(inboxDir, file);
    const { data, content } = yaml.safeRead(filePath);

    if (unreadOnly && data.status !== 'unread') continue;
    if (priority && data.priority !== priority) continue;

    messages.push({
      file,
      id: data.id || file.replace('.md', ''),
      from: data.from || 'unknown',
      to: data.to || agentId,
      priority: data.priority || 'P3',
      type: data.type || 'notification',
      status: data.status || 'unread',
      title: extractTitle(content),
      createdAt: data.created_at || 'unknown',
      requiresResponse: data.requires_response || false,
      relatedTask: data.related_task || null,
    });
  }

  // 按优先级排序
  messages.sort((a, b) => {
    const pa = parseInt((a.priority || 'P3').replace('P', ''));
    const pb = parseInt((b.priority || 'P3').replace('P', ''));
    return pa - pb;
  });

  return messages;
}

/**
 * 发送消息
 *
 * @param {string} sharedDir
 * @param {Object} opts
 * @param {string} opts.from - 发送者 agent-id
 * @param {string} opts.to - 接收者 agent-id
 * @param {string} opts.priority - P0/P1/P2/P3
 * @param {string} opts.type - 消息类型
 * @param {string} opts.title - 消息标题
 * @param {string} opts.body - 消息正文
 * @param {string} opts.relatedTask - 关联任务 ID
 * @param {boolean} opts.requiresResponse - 是否需要回复
 * @returns {{ success: boolean, id?: string, path?: string, error?: string }}
 */
export function send(sharedDir, { from, to, priority, type, title, body, relatedTask, requiresResponse }) {
  if (!from) return { success: false, error: '缺少发送者 (from)' };
  if (!to) return { success: false, error: '缺少接收者 (to)' };
  if (!title) return { success: false, error: '缺少消息标题' };

  const inboxDir = path.join(sharedDir, 'inbox', to);
  if (!fs.existsSync(inboxDir)) {
    fs.mkdirSync(inboxDir, { recursive: true });
  }

  // 生成递增 ID
  const existingIds = fs.readdirSync(inboxDir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const match = f.match(/^(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });
  const nextId = Math.max(0, ...existingIds) + 1;
  const msgId = `MSG-${String(nextId).padStart(3, '0')}`;

  const safeTitle = title.replace(/[^a-zA-Z0-9一-鿿]/g, '-').slice(0, 30);
  const fileName = `${String(nextId).padStart(3, '0')}-${safeTitle}.md`;
  const filePath = path.join(inboxDir, fileName);

  const data = {
    id: msgId,
    from,
    to,
    priority: priority || 'P2',
    type: type || 'notification',
    status: 'unread',
    created_at: now(),
    related_task: relatedTask || null,
    requires_response: requiresResponse || false,
  };

  const content = [
    `# ${title}`,
    '',
    body || '',
    '',
  ].join('\n');

  yaml.write(filePath, data, content);

  return { success: true, id: msgId, path: filePath };
}

/**
 * 标记消息为已读
 *
 * @param {string} sharedDir
 * @param {string} agentId
 * @param {string} msgId - 消息 ID 或文件名
 * @returns {{ success: boolean, error?: string }}
 */
export function markRead(sharedDir, agentId, msgId) {
  const filePath = findMessageFile(sharedDir, agentId, msgId);
  if (!filePath) return { success: false, error: `消息 ${msgId} 不存在` };

  yaml.updateData(filePath, { status: 'read', read_at: now() });
  return { success: true };
}

/**
 * 标记消息为已完成
 *
 * @param {string} sharedDir
 * @param {string} agentId
 * @param {string} msgId
 * @returns {{ success: boolean, error?: string }}
 */
export function markDone(sharedDir, agentId, msgId) {
  const filePath = findMessageFile(sharedDir, agentId, msgId);
  if (!filePath) return { success: false, error: `消息 ${msgId} 不存在` };

  yaml.updateData(filePath, { status: 'done', done_at: now() });
  return { success: true };
}

/**
 * 格式化消息列表
 * @param {Object[]} messages
 * @returns {string}
 */
export function formatMessageList(messages) {
  if (messages.length === 0) return '📬 无未读消息';

  const lines = ['📬 未读消息:', ''];
  lines.push('| ID | 优先级 | 类型 | 来自 | 标题 | 需回复 |');
  lines.push('|----|--------|------|------|------|:------:|');

  for (const m of messages) {
    const resp = m.requiresResponse ? '✅' : '';
    lines.push(`| ${m.id} | ${m.priority} | ${m.type} | ${m.from} | ${m.title} | ${resp} |`);
  }

  return lines.join('\n');
}

/**
 * 格式化消息详情
 * @param {string} sharedDir
 * @param {string} agentId
 * @param {string} msgId
 * @returns {string}
 */
export function formatMessageDetail(sharedDir, agentId, msgId) {
  const filePath = findMessageFile(sharedDir, agentId, msgId);
  if (!filePath) return `消息 ${msgId} 不存在`;

  const { data, content } = yaml.read(filePath);
  const lines = [
    `📬 ${data.id}: ${extractTitle(content)}`,
    `   来自: ${data.from} | 优先级: ${data.priority} | 类型: ${data.type}`,
    `   状态: ${data.status} | 创建: ${data.created_at}`,
    data.related_task ? `   关联任务: ${data.related_task}` : null,
    data.requires_response ? '   ⚠️ 需要回复' : null,
    '',
    content,
  ].filter(Boolean);

  return lines.join('\n');
}

// ── 内部工具 ──

function findMessageFile(sharedDir, agentId, msgId) {
  const inboxDir = path.join(sharedDir, 'inbox', agentId);
  if (!fs.existsSync(inboxDir)) return null;

  const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.md'));

  // 先按文件名匹配
  for (const file of files) {
    if (file.includes(msgId)) return path.join(inboxDir, file);
  }

  // 再按 frontmatter id 匹配
  for (const file of files) {
    const { data } = yaml.safeRead(path.join(inboxDir, file));
    if (data.id === msgId) return path.join(inboxDir, file);
  }

  return null;
}

function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '(无标题)';
}
