/**
 * dashboard.js — collab dashboard 命令
 *
 * 启动 Web 控制面板，浏览器可视化查看协作状态。
 * 零依赖——用 Node.js 内置 http 模块 + 内嵌 HTML/CSS/JS。
 *
 * 用法: collab dashboard [--port 8080]
 */

import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import * as statusCmd from './status.js';
import * as taskCmd from './task.js';
import * as inboxCmd from './inbox.js';
import * as conflictCmd from './conflict.js';
import * as memoryCmd from './memory.js';
import * as yaml from '../core/yaml.js';

const DEFAULT_PORT = 8080;

/**
 * 启动 dashboard 服务器
 */
export function startDashboard(sharedDir, port) {
  const listenPort = parseInt(port || DEFAULT_PORT);

  const server = http.createServer((req, res) => {
    // 只允许 localhost 访问
    const remoteAddr = req.socket.remoteAddress || '';
    const isLocal = remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';
    if (!isLocal) {
      res.writeHead(403);
      res.end('Forbidden: dashboard only accessible from localhost');
      return;
    }

    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getHTML(sharedDir));
    } else if (req.url === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(statusCmd.status(sharedDir)));
    } else if (req.url === '/api/tasks') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(taskCmd.list(sharedDir)));
    } else if (req.url.startsWith('/api/inbox/')) {
      const agentId = req.url.split('/api/inbox/')[1]?.split('?')[0];
      // 校验 agentId：只允许字母数字和连字符
      if (!agentId || !/^[a-zA-Z0-9_-]+$/.test(agentId)) {
        res.writeHead(400);
        res.end('Invalid agent ID');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(inboxCmd.check(sharedDir, agentId)));
    } else if (req.url === '/api/conflicts') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(conflictCmd.list(sharedDir)));
    } else if (req.url === '/api/memory') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(memoryCmd.stats(sharedDir)));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(listenPort, '127.0.0.1', () => {
    console.log(`\n🌐 Dashboard 已启动: http://localhost:${listenPort}`);
    console.log(`   仅限本机访问`);
    console.log(`   按 Ctrl+C 停止\n`);
  });

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n   正在停止 dashboard...');
    server.close(() => process.exit(0));
  });

  return server;
}

function getHTML(sharedDir) {
  const status = statusCmd.status(sharedDir);
  const tasks = taskCmd.list(sharedDir);
  const memory = memoryCmd.stats(sharedDir);
  const conflicts = conflictCmd.list(sharedDir);

  const badges = status.badges || [];
  const shard = status.shard || {};

  // HTML 转义函数（防 XSS）
  const esc = (s) => String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const taskStats = status.tasks || {};

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>collab dashboard</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; }
h1 { color: #58a6ff; margin-bottom: 20px; font-size: 24px; }
h2 { color: #8b949e; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 20px; }
.card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; }
.stat { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #21262d; }
.stat:last-child { border-bottom: none; }
.stat-label { color: #8b949e; font-size: 13px; }
.stat-value { color: #f0f6fc; font-weight: 600; font-size: 15px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; margin: 2px; }
.badge-L4 { background: #da3633; color: white; }
.badge-L3 { background: #d29922; color: white; }
.badge-L2 { background: #238636; color: white; }
.badge-L1 { background: #1f6feb; color: white; }
.badge-L0 { background: #30363d; color: #8b949e; }
.task-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #21262d; gap: 10px; }
.task-row:last-child { border-bottom: none; }
.task-id { color: #58a6ff; font-family: monospace; font-size: 13px; min-width: 80px; }
.task-title { flex: 1; color: #f0f6fc; font-size: 14px; }
.task-status { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.status-DRAFT { background: #30363d; color: #8b949e; }
.status-ASSIGNED { background: #1f6feb; color: white; }
.status-IN_PROGRESS { background: #d29922; color: white; }
.status-REVIEW { background: #8957e5; color: white; }
.status-DONE { background: #238636; color: white; }
.status-BLOCKED { background: #da3633; color: white; }
.priority-P0 { color: #f85149; font-weight: 700; }
.priority-P1 { color: #d29922; font-weight: 600; }
.priority-P2 { color: #58a6ff; }
.priority-P3 { color: #8b949e; }
.shard-content { background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 12px; font-family: monospace; font-size: 13px; line-height: 1.5; max-height: 300px; overflow-y: auto; white-space: pre-wrap; }
.conflict-row { padding: 8px 0; border-bottom: 1px solid #21262d; font-size: 13px; }
.progress-bar { background: #21262d; border-radius: 4px; height: 8px; overflow: hidden; margin-top: 4px; }
.progress-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
.refresh-btn { background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.refresh-btn:hover { background: #30363d; }
</style>
</head>
<body>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
  <h1>🤝 collab dashboard</h1>
  <button class="refresh-btn" onclick="location.reload()">🔄 刷新</button>
</div>

<div class="grid">
  <!-- SHARD -->
  <div class="card">
    <h2>📝 SHARD (L0 活记忆)</h2>
    <div class="stat">
      <span class="stat-label">行数</span>
      <span class="stat-value">${shard.lineCount || 0}/${shard.maxLines || 80}</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width:${Math.min(100, ((shard.lineCount || 0) / (shard.maxLines || 80)) * 100)}%;background:${(shard.lineCount || 0) > 80 ? '#da3633' : '#238636'}"></div>
    </div>
    <div class="stat">
      <span class="stat-label">最后更新</span>
      <span class="stat-value" style="font-size:12px">${shard.lastUpdatedBy || '-'} @ ${shard.lastUpdatedAt || '-'}</span>
    </div>
  </div>

  <!-- Badges -->
  <div class="card">
    <h2>🪪 工牌 (${badges.length})</h2>
    ${badges.map(b => `
    <div class="stat">
      <span class="stat-label">${esc(b.agentId)}</span>
      <span class="badge badge-${esc(b.role)}">${esc(b.role)}</span>
    </div>`).join('')}
  </div>

  <!-- Task Stats -->
  <div class="card">
    <h2>📋 任务概览</h2>
    <div class="stat">
      <span class="stat-label">总计</span>
      <span class="stat-value">${taskStats.total || 0}</span>
    </div>
    <div class="stat">
      <span class="stat-label">进行中</span>
      <span class="stat-value" style="color:#d29922">${taskStats.inProgress || 0}</span>
    </div>
    <div class="stat">
      <span class="stat-label">待审查</span>
      <span class="stat-value" style="color:#8957e5">${taskStats.review || 0}</span>
    </div>
    <div class="stat">
      <span class="stat-label">已完成</span>
      <span class="stat-value" style="color:#238636">${taskStats.done || 0}</span>
    </div>
  </div>

  <!-- Memory -->
  <div class="card">
    <h2>🧠 记忆层级</h2>
    <div class="stat">
      <span class="stat-label">L1 片段</span>
      <span class="stat-value">${memory.l1Files?.length || 0} 个文件</span>
    </div>
    <div class="stat">
      <span class="stat-label">L2 归档</span>
      <span class="stat-value">${memory.archiveFiles?.length || 0} 个文件</span>
    </div>
    ${conflicts.length > 0 ? `
    <div class="stat">
      <span class="stat-label">⚡ 冲突</span>
      <span class="stat-value" style="color:#f85149">${conflicts.length} 个未解决</span>
    </div>` : ''}
  </div>
</div>

<!-- Tasks -->
<div class="card" style="margin-bottom:20px">
  <h2>📋 任务列表</h2>
  ${tasks.length === 0 ? '<div style="color:#8b949e;font-size:13px;padding:12px 0">暂无任务</div>' : ''}
  ${tasks.map(t => `
  <div class="task-row">
    <span class="task-id">${esc(t.id)}</span>
    <span class="priority-${esc(t.priority)}">${esc(t.priority)}</span>
    <span class="task-title">${esc(t.title)}</span>
    <span style="color:#8b949e;font-size:12px">${esc(t.assignee || '-')}</span>
    <span class="task-status status-${esc(t.status)}">${esc(t.status)}</span>
  </div>`).join('')}
</div>

<div style="text-align:center;color:#484f58;font-size:12px;padding:20px">
  collab-cli dashboard · auto-refresh in 30s
</div>

<script>setTimeout(() => location.reload(), 30000);</script>
</body>
</html>`;
}
