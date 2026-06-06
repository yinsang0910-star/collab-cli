/**
 * server.js — 轻量 HTTP 服务器，处理跨节点消息和状态同步
 *
 * 零依赖——使用 Node.js 内置 http 模块。
 * 端口默认 9527，可通过 --port 自定义。
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as inboxCmd from '../commands/inbox.js';
import * as taskCmd from '../commands/task.js';
import * as statusCmd from '../commands/status.js';
import * as yaml from '../core/yaml.js';
import { now } from '../utils/timestamp.js';

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

const DEFAULT_PORT = 9527;

export class CollabServer {
  /**
   * @param {Object} opts
   * @param {string} opts.sharedDir - .shared/ 目录路径
   * @param {string} opts.nodeId - 本节点 ID
   * @param {string[]} opts.agents - 本节点管理的 agent 列表
   * @param {number} opts.port - HTTP 端口
   * @param {string} opts.token - 认证 token
   */
  constructor({ sharedDir, nodeId, agents, port, token }) {
    this.sharedDir = sharedDir;
    this.nodeId = nodeId;
    this.agents = agents;
    this.port = port || DEFAULT_PORT;
    this.token = token;
    this.server = null;
  }

  /**
   * 启动服务器
   * @returns {Promise<{ port: number }>}
   */
  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this._handleRequest(req, res));

      this.server.listen(this.port, '0.0.0.0', () => {
        resolve({ port: this.port });
      });

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`端口 ${this.port} 已被占用，试试 --port ${this.port + 1}`));
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * 停止服务器
   * @returns {Promise<void>}
   */
  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  // ── 内部方法 ──

  async _handleRequest(req, res) {
    // CORS: 仅允许 localhost 和同局域网
    const origin = req.headers['origin'] || '';
    const isLocal = !origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168.');
    if (isLocal) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Token 认证（timing-safe 比较）
    if (this.token) {
      const authHeader = req.headers['authorization'];
      const reqToken = authHeader?.replace('Bearer ', '');
      if (!reqToken || reqToken.length !== this.token.length ||
          !crypto.timingSafeEqual(Buffer.from(reqToken), Buffer.from(this.token))) {
        this._json(res, 401, { error: 'Unauthorized' });
        return;
      }
    }

    const url = new URL(req.url, `http://localhost:${this.port}`);
    const path = url.pathname;

    try {
      // GET /api/status
      if (req.method === 'GET' && path === '/api/status') {
        this._handleStatus(req, res);
        return;
      }

      // GET /api/discovery
      if (req.method === 'GET' && path === '/api/discovery') {
        this._handleDiscovery(req, res);
        return;
      }

      // GET /api/inbox/check/:agentId
      if (req.method === 'GET' && path.startsWith('/api/inbox/check/')) {
        const agentId = path.split('/').pop();
        this._handleInboxCheck(req, res, agentId);
        return;
      }

      // POST /api/inbox/send
      if (req.method === 'POST' && path === '/api/inbox/send') {
        const body = await this._readBody(req);
        this._handleInboxSend(req, res, body);
        return;
      }

      // POST /api/inbox/read
      if (req.method === 'POST' && path === '/api/inbox/read') {
        const body = await this._readBody(req);
        this._handleInboxRead(req, res, body);
        return;
      }

      // GET /api/shard
      if (req.method === 'GET' && path === '/api/shard') {
        this._handleShardGet(req, res);
        return;
      }

      // POST /api/shard/sync
      if (req.method === 'POST' && path === '/api/shard/sync') {
        const body = await this._readBody(req);
        this._handleShardSync(req, res, body);
        return;
      }

      // GET /api/tasks
      if (req.method === 'GET' && path === '/api/tasks') {
        this._handleTasks(req, res);
        return;
      }

      // POST /api/sync/shard — 接收远程 SHARD 推送
      if (req.method === 'POST' && path === '/api/sync/shard') {
        const body = await this._readBody(req);
        this._handleSyncShard(req, res, body);
        return;
      }

      // POST /api/sync/tasks — 接收远程 tasks 推送
      if (req.method === 'POST' && path === '/api/sync/tasks') {
        const body = await this._readBody(req);
        this._handleSyncTasks(req, res, body);
        return;
      }

      // GET /api/sync/shard — 获取当前 SHARD 版本信息
      if (req.method === 'GET' && path === '/api/sync/shard') {
        this._handleSyncShardGet(req, res);
        return;
      }

      // GET /api/sync/tasks — 获取当前 tasks 列表
      if (req.method === 'GET' && path === '/api/sync/tasks') {
        this._handleSyncTasksGet(req, res);
        return;
      }

      // 404
      this._json(res, 404, { error: `Not found: ${path}` });

    } catch (err) {
      this._json(res, 500, { error: 'Internal server error' });
    }
  }

  _handleStatus(req, res) {
    const report = statusCmd.status(this.sharedDir);
    this._json(res, 200, {
      nodeId: this.nodeId,
      agents: this.agents,
      uptime: process.uptime(),
      status: report,
    });
  }

  _handleDiscovery(req, res) {
    this._json(res, 200, {
      nodeId: this.nodeId,
      agents: this.agents,
      apiPort: this.port,
      version: '1.0.0',
    });
  }

  _handleInboxCheck(req, res, agentId) {
    if (!this.agents.includes(agentId)) {
      this._json(res, 404, { error: `Agent ${agentId} not found on this node` });
      return;
    }
    const messages = inboxCmd.check(this.sharedDir, agentId);
    this._json(res, 200, { agentId, messages, count: messages.length });
  }

  _handleInboxSend(req, res, body) {
    const result = inboxCmd.send(this.sharedDir, {
      from: body.from,
      to: body.to,
      title: body.title,
      body: body.body || '',
      priority: body.priority || 'P2',
      type: body.type || 'notification',
      relatedTask: body.related_task,
      requiresResponse: body.requires_response || false,
    });
    this._json(res, result.success ? 200 : 400, result);
  }

  _handleInboxRead(req, res, body) {
    const result = inboxCmd.markRead(this.sharedDir, body.agent_id, body.message_id);
    this._json(res, result.success ? 200 : 400, result);
  }

  _handleShardGet(req, res) {
    const shardPath = `${this.sharedDir}/SHARD.md`;
    const { data, content } = yaml.safeRead(shardPath);
    this._json(res, 200, { data, content });
  }

  _handleShardSync(req, res, body) {
    // 接收远程 SHARD 更新（带乐观锁检查）
    const shardPath = `${this.sharedDir}/SHARD.md`;
    const current = yaml.safeRead(shardPath);

    const remoteVersion = Number(body.version) || 0;
    const localVersion = Number(current.data.version) || 0;

    if (remoteVersion > 0 && localVersion > 0 && remoteVersion <= localVersion) {
      this._json(res, 409, {
        error: 'Version conflict',
        currentVersion: current.data.version,
        receivedVersion: body.version,
      });
      return;
    }

    yaml.write(shardPath, {
      ...body.data,
      last_updated_by: body.updated_by || 'remote',
      last_updated_at: now(),
    }, body.content || current.content);

    this._json(res, 200, { success: true, version: body.data?.version || current.data.version });
  }

  _handleTasks(req, res) {
    const tasks = taskCmd.list(this.sharedDir);
    this._json(res, 200, { tasks, count: tasks.length });
  }

  _handleSyncShard(req, res, body) {
    // 接收远程 SHARD 推送，带版本检查
    const shardPath = path.join(this.sharedDir, 'SHARD.md');
    const current = yaml.safeRead(shardPath);

    const remoteVersion = body.data?.version || 0;
    const localVersion = current.data?.version || 0;

    // 远程版本更新 → 接受
    if (remoteVersion > localVersion) {
      yaml.write(shardPath, body.data, body.content);
      this._json(res, 200, {
        accepted: true,
        message: `SHARD updated: v${localVersion} → v${remoteVersion}`,
        version: remoteVersion,
      });
      return;
    }

    // 版本相同 → 冲突（最近修改者优先）
    if (remoteVersion === localVersion) {
      const remoteTime = body.data?.last_updated_at || '';
      const localTime = current.data?.last_updated_at || '';
      if (remoteTime > localTime) {
        yaml.write(shardPath, body.data, body.content);
        this._json(res, 200, { accepted: true, message: 'SHARD updated (same version, newer timestamp)' });
        return;
      }
    }

    // 本地版本更新 → 拒绝
    this._json(res, 200, {
      accepted: false,
      message: `Local version is newer (v${localVersion} vs v${remoteVersion})`,
    });
  }

  _handleSyncShardGet(req, res) {
    const shardPath = path.join(this.sharedDir, 'SHARD.md');
    const { data, content } = yaml.safeRead(shardPath);
    this._json(res, 200, { data, content, version: data?.version || 0 });
  }

  _handleSyncTasks(req, res, body) {
    // 接收远程 tasks 推送（整个任务列表）
    if (!body.tasks || !Array.isArray(body.tasks)) {
      this._json(res, 400, { error: 'Missing tasks array' });
      return;
    }

    const tasksDir = path.join(this.sharedDir, 'tasks');
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
    }

    let updated = 0;
    let skipped = 0;

    for (const task of body.tasks) {
      if (!task.id) continue;

      // 查找本地是否已有此任务
      const localFiles = fs.readdirSync(tasksDir).filter(f => f.startsWith(task.id));
      const localPath = localFiles.length > 0
        ? path.join(tasksDir, localFiles[0])
        : path.join(tasksDir, `${task.id}-${(task.title || 'task').replace(/[^a-zA-Z0-9一-鿿]/g, '-').slice(0, 40)}.md`);

      if (localFiles.length > 0) {
        // 已有 → 检查版本
        const local = yaml.safeRead(localPath);
        const localStatus = local.data?.status || 'DRAFT';
        const remoteStatus = task.status || 'DRAFT';

        // 状态机：远程状态更"前进" → 接受
        const statusOrder = { DRAFT: 0, ASSIGNED: 1, IN_PROGRESS: 2, REVIEW: 3, DONE: 4, BLOCKED: -1 };
        if ((statusOrder[remoteStatus] || 0) > (statusOrder[localStatus] || 0)) {
          yaml.updateData(localPath, { status: remoteStatus, assignee: task.assignee });
          updated++;
        } else {
          skipped++;
        }
      } else {
        // 新任务 → 创建
        const data = {
          id: task.id,
          title: task.title || 'Untitled',
          status: task.status || 'DRAFT',
          priority: task.priority || 'P2',
          assignee: task.assignee,
          reviewer: task.reviewer || 'user',
          created_by: task.created_by || 'remote',
          created_at: task.created_at || now(),
        };
        yaml.write(localPath, data, `# ${task.id}: ${task.title}\n\nSynced from remote node.`);
        updated++;
      }
    }

    this._json(res, 200, { updated, skipped, total: body.tasks.length });
  }

  _handleSyncTasksGet(req, res) {
    const tasks = taskCmd.list(this.sharedDir);
    this._json(res, 200, { tasks });
  }

  _readBody(req) {
    return new Promise((resolve, reject) => {
      let data = '';
      let size = 0;
      req.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BODY_SIZE) {
          req.destroy();
          reject(new Error('Request body too large (max 1MB)'));
          return;
        }
        data += chunk;
      });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  _json(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data, null, 2));
  }
}
