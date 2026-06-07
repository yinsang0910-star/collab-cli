/**
 * sync.js — 跨设备同步管理器
 *
 * 监听本地 .shared/ 文件变化，自动推送到所有已连接的 peer。
 * 同时接收远程推送，合并到本地。
 *
 * 同步策略：
 * - SHARD.md: 整体替换（带版本号）
 * - tasks/: 逐文件同步（带状态机判断）
 * - inbox/: 不同步（每台设备独立）
 * - memory/: 整体同步
 */

import fs from 'node:fs';
import path from 'node:path';
import * as yaml from '../core/yaml.js';
import * as taskCmd from '../commands/task.js';
import { now } from '../utils/timestamp.js';

const SYNC_INTERVAL = 10000; // 10 秒同步一次

export class SyncManager {
  /**
   * @param {Object} opts
   * @param {string} opts.sharedDir
   * @param {import('./discovery.js').Discovery} opts.discovery
   * @param {string} opts.token
   * @param {Function} opts.onSync - 同步事件回调
   */
  constructor({ sharedDir, discovery, token, onSync }) {
    this.sharedDir = sharedDir;
    this.discovery = discovery;
    this.token = token;
    this.onSync = onSync || (() => {});
    this.timer = null;
    this.running = false;

    // 记录上次同步的版本，避免无变化时重复推送
    this.lastShardVersion = 0;
    this.lastTaskHash = '';
  }

  /**
   * 启动定时同步
   */
  start() {
    if (this.running) return;
    this.running = true;

    // 初始化版本号
    const shardPath = path.join(this.sharedDir, 'SHARD.md');
    if (fs.existsSync(shardPath)) {
      const { data } = yaml.safeRead(shardPath);
      this.lastShardVersion = data?.version || 0;
    }

    // 定时同步
    this.timer = setInterval(() => this._syncAll(), SYNC_INTERVAL);

    // 首次立即同步
    this._syncAll();
  }

  /**
   * 停止同步
   */
  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * 手动触发一次同步
   */
  async syncNow() {
    return this._syncAll();
  }

  // ── 内部方法 ──

  async _syncAll() {
    const peers = this.discovery.getPeers();
    if (peers.length === 0) return;

    const results = [];

    // 同步 SHARD
    const shardResult = await this._syncShard(peers);
    if (shardResult) results.push(shardResult);

    // 同步 tasks
    const tasksResult = await this._syncTasks(peers);
    if (tasksResult) results.push(tasksResult);

    if (results.length > 0) {
      this.onSync(results);
    }
  }

  async _syncShard(peers) {
    const shardPath = path.join(this.sharedDir, 'SHARD.md');
    if (!fs.existsSync(shardPath)) return null;

    const { data, content } = yaml.safeRead(shardPath);
    const currentVersion = data?.version || 0;

    // 没有变化就不推送
    if (currentVersion === this.lastShardVersion) return null;
    this.lastShardVersion = currentVersion;

    let pushed = 0;
    for (const peer of peers) {
      try {
        const resp = await fetch(`http://${peer.host}:${peer.port}/api/sync/shard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
          },
          body: JSON.stringify({ data, content, version: currentVersion }),
        });
        const result = await resp.json();
        if (result.accepted) pushed++;
      } catch (e) {
        // peer 不可达，跳过
      }
    }

    return { type: 'shard', version: currentVersion, pushed };
  }

  async _syncTasks(peers) {
    const tasks = taskCmd.list(this.sharedDir);
    if (tasks.length === 0) return null;

    // 完整 hash 检测变化（status + assignee + priority）
    const taskHash = tasks.map(t => `${t.id}:${t.status}:${t.assignee}:${t.priority}`).join('|');
    if (taskHash === this.lastTaskHash) return null;
    this.lastTaskHash = taskHash;

    // 读取完整的任务数据
    const tasksDir = path.join(this.sharedDir, 'tasks');
    const fullTasks = [];
    if (fs.existsSync(tasksDir)) {
      const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const { data } = yaml.safeRead(path.join(tasksDir, file));
        fullTasks.push(data);
      }
    }

    let pushed = 0;
    for (const peer of peers) {
      try {
        const resp = await fetch(`http://${peer.host}:${peer.port}/api/sync/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
          },
          body: JSON.stringify({ tasks: fullTasks }),
        });
        const result = await resp.json();
        if (result.updated > 0) pushed++;
      } catch (e) {
        // peer 不可达，跳过
      }
    }

    return { type: 'tasks', count: tasks.length, pushed };
  }
}

/**
 * 从远程拉取最新 SHARD 和 tasks（用于首次加入或断线重连）
 *
 * @param {string} peerHost
 * @param {number} peerPort
 * @param {string} sharedDir
 * @param {string} token
 * @returns {Promise<{ shard: Object, tasks: Object }>}
 */
export async function pullFromPeer(peerHost, peerPort, sharedDir, token) {
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

  const result = { shard: null, tasks: null };

  // 拉取 SHARD（带版本检查）
  try {
    const resp = await fetch(`http://${peerHost}:${peerPort}/api/sync/shard`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    const data = await resp.json();
    if (data.data && data.content) {
      const shardPath = path.join(sharedDir, 'SHARD.md');
      const local = yaml.safeRead(shardPath);
      const remoteVersion = Number(data.data.version) || 0;
      const localVersion = Number(local.data?.version) || 0;

      // 只接受更新的版本
      if (remoteVersion > localVersion) {
        yaml.write(shardPath, data.data, data.content);
        result.shard = { version: remoteVersion };
      } else {
        result.shard = { version: localVersion, skipped: true };
      }
    }
  } catch (e) {
    // 不可达
  }

  // 拉取 tasks
  try {
    const resp = await fetch(`http://${peerHost}:${peerPort}/api/sync/tasks`, { headers });
    const data = await resp.json();
    if (data.tasks && data.tasks.length > 0) {
      const tasksDir = path.join(sharedDir, 'tasks');
      if (!fs.existsSync(tasksDir)) fs.mkdirSync(tasksDir, { recursive: true });

      const statusOrder = { DRAFT: 0, ASSIGNED: 1, IN_PROGRESS: 2, REVIEW: 3, DONE: 4, BLOCKED: -1 };

      for (const task of data.tasks) {
        if (!task.id) continue;
        const safeName = (task.title || 'task').replace(/[^a-zA-Z0-9一-鿿]/g, '-').slice(0, 40);
        const filePath = path.join(tasksDir, `${task.id}-${safeName}.md`);

        if (!fs.existsSync(filePath)) {
          // 新任务 → 创建
          yaml.write(filePath, task, `# ${task.id}: ${task.title}\n\nPulled from peer.`);
        } else {
          // 已有任务 → 状态合并（更"前进"的状态赢）
          const local = yaml.safeRead(filePath);
          const localStatus = local.data?.status || 'DRAFT';
          const remoteStatus = task.status || 'DRAFT';
          if ((statusOrder[remoteStatus] || 0) > (statusOrder[localStatus] || 0)) {
            yaml.updateData(filePath, { status: remoteStatus, assignee: task.assignee });
          }
        }
      }
      result.tasks = { count: data.tasks.length };
    }
  } catch (e) {
    // 不可达
  }

  return result;
}
