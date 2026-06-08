/**
 * notify.js — 单机模式 inbox 通知
 *
 * 在单机模式下，当一个 agent 写入另一个 agent 的 inbox 时，
 * 自动在目标 agent 的工作目录写入一个通知文件。
 *
 * 通知文件的位置：
 * - Claude Code: .claude/inbox-notification.md
 * - WorkBuddy: .workbuddy/inbox-notification.md
 * - Reasonix: .reasonix/inbox-notification.md
 * - 通用: .shared/notifications/{agent-id}.md
 *
 * Agent 的指令文件应该包含一条规则：
 * "每次响应前检查 inbox-notification.md，如果有未读消息先处理"
 */

import fs from 'node:fs';
import path from 'node:path';
import * as yaml from '../core/yaml.js';

// Agent 类型 → 通知文件路径（相对于项目根目录）
const NOTIFY_PATHS = {
  'claude': '.claude/inbox-notification.md',
  'reasonix': '.reasonix/inbox-notification.md',
  'workbuddy': '.workbuddy/inbox-notification.md',
  'codex': 'inbox-notification.md',
  'cursor': '.cursor/inbox-notification.md',
};

/**
 * 当 inbox 有新消息时，写入通知文件
 *
 * @param {string} projectRoot - 项目根目录（不是 .shared/）
 * @param {string} toAgentId - 接收者 agent ID
 * @param {Object} message - 消息信息
 */
export function notifyAgent(projectRoot, toAgentId, message) {
  // 1. 写入通用通知目录
  const sharedNotifyDir = path.join(projectRoot, '.shared', 'notifications');
  if (!fs.existsSync(sharedNotifyDir)) {
    fs.mkdirSync(sharedNotifyDir, { recursive: true });
  }

  const notifyPath = path.join(sharedNotifyDir, `${toAgentId}.md`);
  appendNotification(notifyPath, message);

  // 2. 写入 agent 特定的通知文件
  const agentType = detectAgentType(toAgentId);
  const specificPath = NOTIFY_PATHS[agentType];
  if (specificPath) {
    const fullPath = path.join(projectRoot, specificPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    appendNotification(fullPath, message);
  }
}

/**
 * 检查并读取通知
 *
 * @param {string} projectRoot
 * @param {string} agentId
 * @returns {{ hasNotification: boolean, messages: Object[] }}
 */
export function checkNotifications(projectRoot, agentId) {
  const notifyPath = path.join(projectRoot, '.shared', 'notifications', `${agentId}.md`);
  if (!fs.existsSync(notifyPath)) {
    return { hasNotification: false, messages: [] };
  }

  const { data, content } = yaml.safeRead(notifyPath);
  if (!data.has_unread) {
    return { hasNotification: false, messages: [] };
  }

  return {
    hasNotification: true,
    messages: data.messages || [],
    summary: content,
  };
}

/**
 * 清除通知（标记为已读）
 *
 * @param {string} projectRoot
 * @param {string} agentId
 */
export function clearNotifications(projectRoot, agentId) {
  // 清除通用通知
  const notifyPath = path.join(projectRoot, '.shared', 'notifications', `${agentId}.md`);
  if (fs.existsSync(notifyPath)) {
    yaml.updateData(notifyPath, { has_unread: false, cleared_at: new Date().toISOString() });
  }

  // 清除 agent 特定通知
  const agentType = detectAgentType(toAgentId);
  const specificPath = NOTIFY_PATHS[agentType];
  if (specificPath) {
    const fullPath = path.join(projectRoot, specificPath);
    if (fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, '', 'utf-8');
    }
  }
}

// ── 内部工具 ──

function appendNotification(filePath, message) {
  const existing = fs.existsSync(filePath) ? yaml.safeRead(filePath) : { data: {}, content: '' };

  const messages = existing.data.messages || [];
  messages.push({
    from: message.from,
    priority: message.priority || 'P2',
    title: message.title,
    time: new Date().toISOString(),
  });

  // 只保留最近 10 条
  const recentMessages = messages.slice(-10);

  const data = {
    has_unread: true,
    last_message_from: message.from,
    last_message_title: message.title,
    last_message_time: new Date().toISOString(),
    unread_count: recentMessages.length,
    messages: recentMessages,
  };

  const content = [
    '# 📬 Inbox 通知',
    '',
    `**${message.from}** 给你发了一条消息：`,
    '',
    `> **[${message.priority}] ${message.title}**`,
    '',
    message.body ? message.body.split('\n').slice(0, 3).join('\n') : '',
    '',
    '---',
    '运行 `collab inbox check ' + (message.to || 'your-id') + '` 查看完整消息。',
    '',
  ].filter(Boolean).join('\n');

  yaml.write(filePath, data, content);
}

function detectAgentType(agentId) {
  const id = agentId.toLowerCase();
  if (id.includes('claude')) return 'claude';
  if (id.includes('reasonix')) return 'reasonix';
  if (id.includes('workbuddy') || id.includes('wb')) return 'workbuddy';
  if (id.includes('codex')) return 'codex';
  if (id.includes('cursor')) return 'cursor';
  return null;
}
