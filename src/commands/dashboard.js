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
import * as commandCmd from './command.js';
import * as yaml from '../core/yaml.js';
import * as pipelineCmd from '../orchestrator/pipeline.js';

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
    } else if (req.url === '/api/commands') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(commandCmd.listCommands(sharedDir)));
    } else if (req.url === '/api/pipelines') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(pipelineCmd.listPipelines(sharedDir)));
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
  const taskStats = status.tasks || {};
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const shardPercent = Math.min(100, ((shard.lineCount || 0) / (shard.maxLines || 80)) * 100);
  const shardColor = shardPercent > 90 ? 'var(--pico-color-red-500)' : shardPercent > 70 ? 'var(--pico-color-yellow-500)' : 'var(--pico-color-green-500)';

  // 任务状态分布（用于图表）
  const taskDistribution = JSON.stringify([
    taskStats.draft || 0,
    taskStats.assigned || 0,
    taskStats.inProgress || 0,
    taskStats.review || 0,
    taskStats.done || 0,
    taskStats.blocked || 0,
  ]);

  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>collab dashboard</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  :root {
    --pico-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    --pico-font-size: 14px;
  }
  body { padding: 1rem 2rem; max-width: 1400px; margin: 0 auto; }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--pico-muted-border-color); padding-bottom: 1rem; }
  header h1 { margin: 0; font-size: 1.5rem; }
  .live-dot { display: inline-block; width: 8px; height: 8px; background: var(--pico-color-green-500); border-radius: 50%; margin-right: 8px; animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
  .card { background: var(--pico-card-background); border: 1px solid var(--pico-muted-border-color); border-radius: var(--pico-border-radius); padding: 1.2rem; transition: border-color 0.2s; }
  .card:hover { border-color: var(--pico-primary); }
  .card h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--pico-muted-color); margin-bottom: 0.8rem; border: none; padding: 0; }
  .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--pico-muted-border-color); }
  .stat-row:last-child { border-bottom: none; }
  .stat-label { color: var(--pico-muted-color); font-size: 0.85rem; }
  .stat-value { font-weight: 600; }
  .role-badge { display: inline-block; padding: 0.15rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
  .role-L4 { background: var(--pico-color-red-500); color: white; }
  .role-L3 { background: var(--pico-color-yellow-500); color: #1a1a1a; }
  .role-L2 { background: var(--pico-color-green-500); color: white; }
  .role-L1 { background: var(--pico-color-blue-500); color: white; }
  .role-L0 { background: var(--pico-muted-border-color); color: var(--pico-muted-color); }
  .status-tag { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
  .s-DRAFT { background: var(--pico-muted-border-color); color: var(--pico-muted-color); }
  .s-ASSIGNED { background: var(--pico-color-blue-500); color: white; }
  .s-IN_PROGRESS { background: var(--pico-color-yellow-500); color: #1a1a1a; }
  .s-REVIEW { background: #8957e5; color: white; }
  .s-DONE { background: var(--pico-color-green-500); color: white; }
  .s-BLOCKED { background: var(--pico-color-red-500); color: white; }
  .p-P0 { color: var(--pico-color-red-500); font-weight: 700; }
  .p-P1 { color: var(--pico-color-yellow-500); font-weight: 600; }
  .p-P2 { color: var(--pico-color-blue-500); }
  .p-P3 { color: var(--pico-muted-color); }
  .task-table, .cmd-table { width: 100%; font-size: 0.85rem; }
  .task-table th, .cmd-table th { text-align: left; color: var(--pico-muted-color); font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .task-table td, .cmd-table td { padding: 0.6rem 0; vertical-align: middle; }
  .progress { height: 6px; background: var(--pico-muted-border-color); border-radius: 3px; overflow: hidden; }
  .progress-bar { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
  .chart-container { position: relative; height: 200px; }
  .empty-state { color: var(--pico-muted-color); font-size: 0.85rem; padding: 1.5rem 0; text-align: center; }
  .refresh-btn { background: none; border: 1px solid var(--pico-muted-border-color); color: var(--pico-muted-color); padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; transition: all 0.2s; }
  .refresh-btn:hover { border-color: var(--pico-primary); color: var(--pico-primary); }
  footer { text-align: center; color: var(--pico-muted-color); font-size: 0.75rem; padding: 2rem 0 1rem; }
</style>
</head>
<body>

<header>
  <h1>🤝 collab <small style="color:var(--pico-muted-color);font-weight:400">dashboard</small></h1>
  <div style="display:flex;align-items:center;gap:12px">
    <span style="font-size:0.8rem;color:var(--pico-muted-color)"><span class="live-dot"></span>live</span>
    <button class="refresh-btn" onclick="refreshAll()">刷新</button>
  </div>
</header>

<main>
  <!-- 顶部卡片网格 -->
  <div class="grid">
    <!-- SHARD -->
    <article class="card">
      <h2>📝 SHARD 活记忆</h2>
      <div class="stat-row">
        <span class="stat-label">使用量</span>
        <span class="stat-value">${shard.lineCount || 0} / ${shard.maxLines || 80} 行</span>
      </div>
      <div class="progress" style="margin:0.5rem 0">
        <div class="progress-bar" style="width:${shardPercent}%;background:${shardColor}"></div>
      </div>
      <div class="stat-row">
        <span class="stat-label">最后更新</span>
        <span style="font-size:0.8rem">${esc(shard.lastUpdatedBy || '-')} · ${esc(shard.lastUpdatedAt || '-')}</span>
      </div>
    </article>

    <!-- 工牌 -->
    <article class="card">
      <h2>🪪 工牌</h2>
      ${badges.length === 0 ? '<div class="empty-state">无活跃工牌</div>' :
        badges.map(b => `
      <div class="stat-row">
        <span class="stat-label">${esc(b.agentId)}</span>
        <span class="role-badge role-${esc(b.role)}">${esc(b.role)}</span>
      </div>`).join('')}
    </article>

    <!-- 任务统计 -->
    <article class="card">
      <h2>📋 任务概览</h2>
      <div class="chart-container">
        <canvas id="taskChart"></canvas>
      </div>
    </article>

    <!-- 系统健康 -->
    <article class="card">
      <h2>🧠 系统健康</h2>
      <div class="stat-row">
        <span class="stat-label">L1 记忆片段</span>
        <span class="stat-value">${memory.l1Files?.length || 0} 个</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">L2 归档</span>
        <span class="stat-value">${memory.archiveFiles?.length || 0} 个</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">未解决冲突</span>
        <span class="stat-value" ${conflicts.length > 0 ? 'style="color:var(--pico-color-red-500)"' : ''}>${conflicts.length}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">总任务</span>
        <span class="stat-value">${taskStats.total || 0}</span>
      </div>
    </article>
  </div>

  <!-- 任务列表 -->
  <article class="card" style="margin-bottom:1rem">
    <h2>📋 任务列表</h2>
    <div id="tasks-section">
      ${tasks.length === 0 ? '<div class="empty-state">暂无任务</div>' : `
      <table class="task-table">
        <thead>
          <tr><th>ID</th><th>优先级</th><th>标题</th><th>负责人</th><th>状态</th></tr>
        </thead>
        <tbody>
          ${tasks.map(t => `
          <tr>
            <td><code>${esc(t.id)}</code></td>
            <td><span class="p-${esc(t.priority)}">${esc(t.priority)}</span></td>
            <td>${esc(t.title)}</td>
            <td style="color:var(--pico-muted-color)">${esc(t.assignee || '-')}</td>
            <td><span class="status-tag s-${esc(t.status)}">${esc(t.status)}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>`}
    </div>
  </article>

  <!-- Agent 指令队列 -->
  <article class="card" style="margin-bottom:1rem">
    <h2>⚡ Agent 指令队列</h2>
    <div id="commands-section">
      ${(() => {
        try {
          const commands = commandCmd.listCommands(sharedDir);
          if (commands.length === 0) return '<div class="empty-state">暂无待处理指令</div>';
          return `<table class="cmd-table">
            <thead><tr><th>ID</th><th>优先级</th><th>类型</th><th>指令</th><th>发送方 → 接收方</th><th>状态</th></tr></thead>
            <tbody>${commands.map(c => `<tr>
              <td><code>${esc(c.id)}</code></td>
              <td><span class="p-${esc(c.priority)}">${esc(c.priority)}</span></td>
              <td>${esc(c.type)}</td>
              <td>${esc((c.instruction || '').slice(0, 50))}</td>
              <td style="color:var(--pico-muted-color)">${esc(c.from)} → ${esc(c.to)}</td>
              <td><span class="status-tag s-${esc(c.status)}">${esc(c.status)}</span></td>
            </tr>`).join('')}</tbody>
          </table>`;
        } catch (e) { return '<div class="empty-state">暂无指令</div>'; }
      })()}
    </div>
  </article>

  <!-- 流水线 -->
  <article class="card" style="margin-bottom:1rem">
    <h2>🔄 流水线</h2>
    <div id="pipelines-section">
      ${(() => {
        try {
          const pipelines = pipelineCmd.listPipelines(sharedDir);
          if (pipelines.length === 0) return '<div class="empty-state">暂无流水线</div>';
          return `<table class="task-table">
            <thead><tr><th>ID</th><th>名称</th><th>步骤</th><th>触发</th><th>状态</th></tr></thead>
            <tbody>${pipelines.map(p => `<tr>
              <td><code>${esc(p.id)}</code></td>
              <td>${esc(p.name)}</td>
              <td>${p.steps}</td>
              <td>${esc(p.trigger)}</td>
              <td><span class="status-tag s-${esc(p.status)}">${esc(p.status)}</span></td>
            </tr>`).join('')}</tbody>
          </table>`;
        } catch (e) { return '<div class="empty-state">暂无流水线</div>'; }
      })()}
    </div>
  </article>
</main>

<footer>
  collab-cli dashboard · <span id="last-update"></span> · auto-refresh 30s
</footer>

<script>
  // 任务状态饼图
  new Chart(document.getElementById('taskChart'), {
    type: 'doughnut',
    data: {
      labels: ['Draft', 'Assigned', 'In Progress', 'Review', 'Done', 'Blocked'],
      datasets: [{
        data: ${taskDistribution},
        backgroundColor: [
          '#30363d', '#1f6feb', '#d29922', '#8957e5', '#238636', '#da3633'
        ],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#c9d1d9', font: { size: 11 }, padding: 8 } }
      },
      cutout: '65%'
    }
  });

  // 时间戳
  document.getElementById('last-update').textContent = new Date().toLocaleTimeString();

  // 局部刷新（30 秒）
  function refreshAll() {
    fetch('/api/status').then(r => r.json()).then(data => {
      document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
      // 可以在这里更新更多 DOM 元素
    }).catch(() => {});
  }
  setInterval(refreshAll, 30000);
</script>
</body>
</html>`;
}
