/**
 * node.js — collab node 命令
 *
 * 启动/停止局域网 collab 节点，实现跨设备协作。
 *
 * 用法:
 *   collab node start [--agents <id1,id2>] [--port <port>] [--token <token>]
 *   collab node status
 *   collab node send --from <id> --to <id> --title <text> [--remote]
 */

import crypto from 'node:crypto';
import { Discovery, generateNodeId, getLocalIP } from '../node/discovery.js';
import { CollabServer } from '../node/server.js';
import { Router } from '../node/router.js';
import { SyncManager, pullFromPeer } from '../node/sync.js';

let currentNode = null; // 全局节点实例

/**
 * 启动 collab 节点
 */
export async function startNode(sharedDir, { agents, port, token }) {
  const nodeId = generateNodeId();
  const agentList = agents ? agents.split(',').map(a => a.trim()) : ['claude-01'];
  const apiPort = parseInt(port || '9527');
  const authToken = token || crypto.randomBytes(16).toString('hex');
  const localIP = getLocalIP();

  console.log('');
  console.log(`🔗 collab node 启动中...`);
  console.log('─'.repeat(50));

  // 启动 HTTP 服务器
  const server = new CollabServer({
    sharedDir,
    nodeId,
    agents: agentList,
    port: apiPort,
    token: authToken,
  });

  await server.start();
  console.log(`   HTTP 服务器: http://${localIP}:${apiPort}`);

  // 启动 UDP 发现
  const discovery = new Discovery({
    nodeId,
    agents: agentList,
    apiPort,
    onPeerFound: (peer) => {
      console.log(`   🆕 发现新节点: ${peer.nodeId} (${peer.host}:${peer.port})`);
      console.log(`      Agents: ${peer.agents.join(', ')}`);
    },
    onPeerLost: (peer) => {
      console.log(`   ❌ 节点离线: ${peer.nodeId} (${peer.host})`);
    },
  });

  discovery.start();
  console.log(`   UDP 发现: 端口 9528`);

  // 创建路由器
  const router = new Router({ sharedDir, discovery, token: authToken });

  // 启动同步管理器
  const sync = new SyncManager({
    sharedDir,
    discovery,
    token: authToken,
    onSync: (results) => {
      for (const r of results) {
        if (r.type === 'shard') {
          console.log(`   🔄 SHARD v${r.version} 已推送到 ${r.pushed} 个节点`);
        } else if (r.type === 'tasks') {
          console.log(`   🔄 ${r.count} 个任务已推送到 ${r.pushed} 个节点`);
        }
      }
    },
  });
  sync.start();

  currentNode = { nodeId, server, discovery, router, sync, agentList, authToken, localIP, apiPort };

  console.log('');
  console.log(`   节点 ID: ${nodeId}`);
  console.log(`   管理 Agents: ${agentList.join(', ')}`);
  console.log(`   认证 Token: ${authToken}`);
  console.log('');
  console.log(`   💡 其他设备连接此节点:`);
  console.log(`      collab node start --port ${apiPort} --token ${authToken}`);
  console.log('');
  console.log(`   按 Ctrl+C 停止节点`);

  // 优雅退出
  process.on('SIGINT', async () => {
    console.log('\n   正在停止节点...');
    sync.stop();
    discovery.stop();
    await server.stop();
    console.log('   节点已停止');
    process.exit(0);
  });

  // 保持进程运行
  await new Promise(() => {});

  return currentNode;
}

/**
 * 显示当前节点状态
 */
export function nodeStatus() {
  if (!currentNode) {
    return { running: false };
  }

  const peers = currentNode.discovery.getPeers();
  return {
    running: true,
    nodeId: currentNode.nodeId,
    agents: currentNode.agentList,
    localIP: currentNode.localIP,
    port: currentNode.apiPort,
    peers: peers.map(p => ({
      nodeId: p.nodeId,
      host: p.host,
      port: p.port,
      agents: p.agents,
    })),
  };
}

/**
 * 格式化节点状态
 */
export function formatNodeStatus(status) {
  if (!status.running) {
    return '🔴 节点未运行。使用 `collab node start` 启动。';
  }

  const lines = [
    `🟢 节点运行中`,
    `─`.repeat(40),
    `   节点 ID: ${status.nodeId}`,
    `   本机 IP: ${status.localIP}`,
    `   API 端口: ${status.port}`,
    `   管理 Agents: ${status.agents.join(', ')}`,
    '',
  ];

  if (status.peers.length === 0) {
    lines.push('   局域网内暂无其他节点');
  } else {
    lines.push(`   已发现 ${status.peers.length} 个节点:`);
    for (const peer of status.peers) {
      lines.push(`   ├── ${peer.nodeId} (${peer.host}:${peer.port})`);
      lines.push(`   │   Agents: ${peer.agents.join(', ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * 获取路由器实例（供外部使用）
 */
export function getRouter() {
  return currentNode?.router || null;
}

/**
 * 获取发现实例（供外部使用）
 */
export function getDiscovery() {
  return currentNode?.discovery || null;
}
