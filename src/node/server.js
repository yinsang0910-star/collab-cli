/**
 * server.js — 轻量 HTTP 服务器，处理跨节点消息和状态同步
 *
 * 零依赖——使用 Node.js 内置 http 模块。
 * 端口默认 9527，可通过 --port 自定义。
 */

import http from 'node:http';
import * as inboxCmd from '../commands/inbox.js';
import * as taskCmd from '../commands/task.js';
import * as statusCmd from '../commands/status.js';
import * as yaml from '../core/yaml.js';
import { now } from '../utils/timestamp.js';

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
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Token 认证
    if (this.token) {
      const authHeader = req.headers['authorization'];
      const reqToken = authHeader?.replace('Bearer ', '');
      if (reqToken !== this.token) {
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

      // 404
      this._json(res, 404, { error: `Not found: ${path}` });

    } catch (err) {
      this._json(res, 500, { error: err.message });
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

    if (body.version && current.data.version && body.version <= current.data.version) {
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

  _readBody(req) {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
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
