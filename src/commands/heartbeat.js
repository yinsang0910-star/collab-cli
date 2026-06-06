/**
 * heartbeat.js — collab heartbeat 命令
 *
 * 长驻进程，定期检查 inbox 并输出通知。
 * 用于长时间运行的 agent（如 WorkBuddy 定时任务）。
 *
 * 用法:
 *   collab heartbeat <agent-id> [--interval <seconds>] [--shared <dir>]
 *
 * 输出格式（供 agent 解析）:
 *   [COLLAB_HEARTBEAT] {JSON notification}
 *
 * 退出: Ctrl+C 或 SIGTERM
 */

import fs from 'node:fs';
import path from 'node:path';
import * as yaml from '../core/yaml.js';

const DEFAULT_INTERVAL = 300; // 5 分钟

/**
 * 启动心跳监控
 *
 * @param {string} sharedDir
 * @param {string} agentId
 * @param {Object} opts
 * @param {number} opts.interval - 检查间隔（秒）
 * @param {Function} opts.onNotification - 通知回调（默认: 输出到 stdout）
 * @returns {{ stop: Function }} — 调用 stop() 停止监控
 */
export function startHeartbeat(sharedDir, agentId, { interval, onNotification } = {}) {
  const intervalMs = (interval || DEFAULT_INTERVAL) * 1000;
  const seenMsgIds = new Set();
  let running = true;
  let timer = null;

  // 初始化：标记当前已存在的未读消息为"已知"（不通知旧消息）
  const initialUnread = getUnreadMessages(sharedDir, agentId);
  for (const msg of initialUnread) {
    seenMsgIds.add(msg.id);
  }

  const notify = onNotification || defaultNotify;

  function tick() {
    if (!running) return;

    const unread = getUnreadMessages(sharedDir, agentId);
    const newMessages = unread.filter(m => !seenMsgIds.has(m.id));

    if (newMessages.length > 0) {
      for (const msg of newMessages) {
        seenMsgIds.add(msg.id);
        notify({
          type: 'new_message',
          agentId,
          message: {
            id: msg.id,
            from: msg.from,
            priority: msg.priority,
            type: msg.type,
            title: msg.title,
            requiresResponse: msg.requiresResponse,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // 首次检查
  tick();

  // 定时检查
  timer = setInterval(tick, intervalMs);

  // 优雅退出
  function stop() {
    running = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  return { stop };
}

/**
 * 单次检查（不启动长驻进程）
 *
 * @param {string} sharedDir
 * @param {string} agentId
 * @returns {{ unread: Object[], count: number, hasHighPriority: boolean }}
 */
export function checkOnce(sharedDir, agentId) {
  const unread = getUnreadMessages(sharedDir, agentId);
  const hasHighPriority = unread.some(m => m.priority === 'P0' || m.priority === 'P1');

  return {
    unread,
    count: unread.length,
    hasHighPriority,
  };
}

/**
 * 格式化心跳状态
 * @param {Object} result - checkOnce 的返回值
 * @returns {string}
 */
export function formatHeartbeatStatus(result) {
  if (result.count === 0) {
    return '💚 无未读消息';
  }

  const lines = [`📬 ${result.count} 条未读消息${result.hasHighPriority ? ' ⚠️ 含高优先级' : ''}:`];
  for (const m of result.unread) {
    lines.push(`   ${m.priority} | ${m.from} | ${m.title}`);
  }
  return lines.join('\n');
}

// ── 内部工具 ──

function getUnreadMessages(sharedDir, agentId) {
  const inboxDir = path.join(sharedDir, 'inbox', agentId);
  if (!fs.existsSync(inboxDir)) return [];

  const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.md'));
  const messages = [];

  for (const file of files) {
    const { data, content } = yaml.safeRead(path.join(inboxDir, file));
    if (data.status === 'unread') {
      messages.push({
        id: data.id || file.replace('.md', ''),
        file,
        from: data.from || 'unknown',
        priority: data.priority || 'P3',
        type: data.type || 'notification',
        title: extractTitle(content),
        requiresResponse: data.requires_response || false,
        createdAt: data.created_at || 'unknown',
      });
    }
  }

  return messages;
}

function defaultNotify(notification) {
  const msg = notification.message;
  const line = JSON.stringify(notification);
  console.log(`[COLLAB_HEARTBEAT] ${line}`);

  // 人可读的摘要
  const emoji = msg.priority === 'P0' ? '🚨' : msg.priority === 'P1' ? '⚠️' : '📬';
  console.log(`${emoji} 新消息: [${msg.priority}] ${msg.from} → ${msg.title}${msg.requiresResponse ? ' (需回复)' : ''}`);
}

function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '(无标题)';
}
