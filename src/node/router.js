/**
 * router.js — 消息路由器
 *
 * 根据目标 agent 所在位置，自动选择：
 * - 本地 → 直接写文件
 * - 远程 → HTTP 推送到目标节点
 */

import * as inboxCmd from '../commands/inbox.js';

export class Router {
  /**
   * @param {Object} opts
   * @param {string} opts.sharedDir - .shared/ 目录路径
   * @param {import('./discovery.js').Discovery} opts.discovery - UDP 发现实例
   * @param {string} opts.token - 认证 token
   */
  constructor({ sharedDir, discovery, token }) {
    this.sharedDir = sharedDir;
    this.discovery = discovery;
    this.token = token;
  }

  /**
   * 发送消息（自动路由到本地或远程）
   *
   * @param {Object} message
   * @param {string} message.from - 发送者 agent ID
   * @param {string} message.to - 接收者 agent ID
   * @param {string} message.title - 消息标题
   * @param {string} [message.body] - 消息正文
   * @param {string} [message.priority] - 优先级
   * @param {string} [message.type] - 消息类型
   * @param {string} [message.related_task] - 关联任务
   * @param {boolean} [message.requires_response] - 需要回复
   * @returns {Promise<{ success: boolean, route: 'local'|'remote', peer?: string, error?: string }>}
   */
  async send(message) {
    const recipient = message.to;

    // 路由 1: 本地 agent
    if (this.discovery.isLocal(recipient)) {
      const result = inboxCmd.send(this.sharedDir, {
        from: message.from,
        to: recipient,
        title: message.title,
        body: message.body || '',
        priority: message.priority || 'P2',
        type: message.type || 'notification',
        relatedTask: message.related_task,
        requiresResponse: message.requires_response || false,
      });

      return { ...result, route: 'local' };
    }

    // 路由 2: 远程 peer
    const peer = this.discovery.findAgent(recipient);
    if (!peer) {
      return {
        success: false,
        route: 'unknown',
        error: `Agent ${recipient} 未在局域网内发现。请确认目标设备已运行 collab node。`,
      };
    }

    try {
      const response = await fetch(`http://${peer.host}:${peer.port}/api/inbox/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify({
          from: message.from,
          to: recipient,
          title: message.title,
          body: message.body || '',
          priority: message.priority || 'P2',
          type: message.type || 'notification',
          related_task: message.related_task,
          requires_response: message.requires_response || false,
        }),
      });

      const result = await response.json();
      return { ...result, route: 'remote', peer: `${peer.host}:${peer.port}` };

    } catch (err) {
      return {
        success: false,
        route: 'remote',
        peer: `${peer.host}:${peer.port}`,
        error: `远程节点通信失败: ${err.message}`,
      };
    }
  }

  /**
   * 检查某个 agent 的未读消息（本地或远程）
   *
   * @param {string} agentId
   * @returns {Promise<{ messages: Object[], source: 'local'|'remote' }>}
   */
  async checkInbox(agentId) {
    // 本地
    if (this.discovery.isLocal(agentId)) {
      const messages = inboxCmd.check(this.sharedDir, agentId);
      return { messages, source: 'local' };
    }

    // 远程
    const peer = this.discovery.findAgent(agentId);
    if (!peer) {
      return { messages: [], source: 'unknown', error: `Agent ${agentId} 未发现` };
    }

    try {
      const response = await fetch(
        `http://${peer.host}:${peer.port}/api/inbox/check/${agentId}`,
        {
          headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
        }
      );
      const result = await response.json();
      return { messages: result.messages || [], source: 'remote' };

    } catch (err) {
      return { messages: [], source: 'remote', error: err.message };
    }
  }

  /**
   * 同步 SHARD.md 到远程节点
   *
   * @param {string} targetNodeId - 目标节点 ID
   * @param {Object} shardData - SHARD 数据 { data, content, version }
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async syncShard(targetNodeId, shardData) {
    const peers = this.discovery.getPeers();
    const target = peers.find(p => p.nodeId === targetNodeId);

    if (!target) {
      return { success: false, error: `节点 ${targetNodeId} 未发现` };
    }

    try {
      const response = await fetch(`http://${target.host}:${target.port}/api/shard/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify(shardData),
      });

      return await response.json();

    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * 获取所有已知节点的状态
   *
   * @returns {Promise<Object[]>}
   */
  async getNetworkStatus() {
    const peers = this.discovery.getPeers();
    const results = [];

    for (const peer of peers) {
      try {
        const response = await fetch(`http://${peer.host}:${peer.port}/api/status`, {
          headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
        });
        const status = await response.json();
        results.push({ ...status, host: peer.host, reachable: true });
      } catch (err) {
        results.push({
          nodeId: peer.nodeId,
          host: peer.host,
          reachable: false,
          error: err.message,
        });
      }
    }

    return results;
  }
}
