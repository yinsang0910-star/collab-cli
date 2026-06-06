/**
 * discovery.js — UDP 广播自动发现局域网内的 collab 节点
 *
 * 使用 UDP 广播（端口 9528）让同局域网内的节点互相发现。
 * 零配置——启动即发现，无需手动填写 IP。
 */

import dgram from 'node:dgram';
import os from 'node:os';

const BROADCAST_PORT = 9528;
const BROADCAST_ADDR = '255.255.255.255';
const HEARTBEAT_INTERVAL = 5000;   // 5 秒广播一次
const PEER_TIMEOUT = 15000;        // 15 秒无心跳视为离线

export class Discovery {
  /**
   * @param {Object} opts
   * @param {string} opts.nodeId - 本节点 ID
   * @param {string[]} opts.agents - 本节点管理的 agent ID 列表
   * @param {number} opts.apiPort - HTTP API 端口
   * @param {Function} opts.onPeerFound - 发现新 peer 时回调
   * @param {Function} opts.onPeerLost - peer 离线时回调
   */
  constructor({ nodeId, agents, apiPort, onPeerFound, onPeerLost }) {
    this.nodeId = nodeId;
    this.agents = agents;
    this.apiPort = apiPort;
    this.onPeerFound = onPeerFound || (() => {});
    this.onPeerLost = onPeerLost || (() => {});

    this.peers = new Map(); // nodeId → { host, port, agents, lastSeen }
    this.socket = null;
    this.broadcastTimer = null;
    this.cleanupTimer = null;
    this.running = false;
  }

  /**
   * 启动 UDP 发现
   */
  start() {
    if (this.running) return;
    this.running = true;

    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        // 忽略自己的广播
        if (data.nodeId === this.nodeId) return;
        this._handleAnnouncement(data, rinfo.address);
      } catch (e) {
        // 忽略无效消息
      }
    });

    this.socket.bind(BROADCAST_PORT, () => {
      this.socket.setBroadcast(true);
      // 立即广播一次
      this._announce();
      // 定期广播
      this.broadcastTimer = setInterval(() => this._announce(), HEARTBEAT_INTERVAL);
      // 定期清理过期 peer
      this.cleanupTimer = setInterval(() => this._cleanupPeers(), PEER_TIMEOUT);
    });
  }

  /**
   * 停止发现
   */
  stop() {
    this.running = false;
    if (this.broadcastTimer) clearInterval(this.broadcastTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.socket) {
      try { this.socket.close(); } catch (e) { /* ignore */ }
    }
  }

  /**
   * 获取当前已知 peer 列表
   * @returns {Object[]}
   */
  getPeers() {
    return Array.from(this.peers.values());
  }

  /**
   * 查找某个 agent 所在的节点
   * @param {string} agentId
   * @returns {{ host: string, port: number } | null}
   */
  findAgent(agentId) {
    for (const peer of this.peers.values()) {
      if (peer.agents.includes(agentId)) {
        return { host: peer.host, port: peer.port };
      }
    }
    return null;
  }

  /**
   * 检查某个 agent 是否在本节点
   * @param {string} agentId
   * @returns {boolean}
   */
  isLocal(agentId) {
    return this.agents.includes(agentId);
  }

  // ── 内部方法 ──

  _announce() {
    const msg = JSON.stringify({
      type: 'collab-discovery',
      nodeId: this.nodeId,
      agents: this.agents,
      apiPort: this.apiPort,
      timestamp: Date.now(),
    });
    const buf = Buffer.from(msg);
    this.socket.send(buf, 0, buf.length, BROADCAST_PORT, BROADCAST_ADDR);
  }

  _handleAnnouncement(data, fromHost) {
    if (data.type !== 'collab-discovery') return;

    const existingPeer = this.peers.get(data.nodeId);
    const isNew = !existingPeer;

    this.peers.set(data.nodeId, {
      nodeId: data.nodeId,
      host: fromHost,
      port: data.apiPort,
      agents: data.agents,
      lastSeen: Date.now(),
    });

    if (isNew) {
      this.onPeerFound({
        nodeId: data.nodeId,
        host: fromHost,
        port: data.apiPort,
        agents: data.agents,
      });
    }
  }

  _cleanupPeers() {
    const now = Date.now();
    for (const [nodeId, peer] of this.peers) {
      if (now - peer.lastSeen > PEER_TIMEOUT) {
        this.peers.delete(nodeId);
        this.onPeerLost({ nodeId, host: peer.host });
      }
    }
  }
}

/**
 * 生成节点 ID
 * @returns {string}
 */
export function generateNodeId() {
  const hostname = os.hostname().replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${hostname}-${rand}`;
}

/**
 * 获取本机局域网 IP
 * @returns {string}
 */
export function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}
