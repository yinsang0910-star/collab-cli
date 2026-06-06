/**
 * node.test.js — LAN 节点测试
 *
 * 测试 UDP 发现、HTTP 服务器、消息路由
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as initCmd from '../commands/init.js';
import { Discovery, generateNodeId, getLocalIP } from '../node/discovery.js';
import { CollabServer } from '../node/server.js';
import { Router } from '../node/router.js';
import * as inboxCmd from '../commands/inbox.js';

let tmpDir;
let sharedDir;
const TEST_PORT = 19527; // 用高端口避免冲突

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-node-test-'));
  sharedDir = path.join(tmpDir, '.shared');
  initCmd.init({ projectName: 'Node Test', sharedDir });
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── 工具函数 ──

describe('Utility: generateNodeId', () => {
  it('should generate a node ID', () => {
    const id = generateNodeId();
    assert.ok(typeof id === 'string');
    assert.ok(id.length > 0);
  });

  it('should generate unique IDs', () => {
    const id1 = generateNodeId();
    const id2 = generateNodeId();
    // 大概率不同（极小概率碰撞）
    assert.notEqual(id1, id2);
  });
});

describe('Utility: getLocalIP', () => {
  it('should return an IP address', () => {
    const ip = getLocalIP();
    assert.ok(typeof ip === 'string');
    assert.ok(ip.match(/^\d+\.\d+\.\d+\.\d+$/) || ip === '127.0.0.1');
  });
});

// ── HTTP 服务器 ──

describe('CollabServer', () => {
  let server;
  let serverNode;

  after(async () => {
    if (server) await server.stop();
  });

  it('should start and respond to /api/status', async () => {
    server = new CollabServer({
      sharedDir,
      nodeId: 'test-node',
      agents: ['agent-01'],
      port: TEST_PORT,
    });

    await server.start();

    const response = await fetch(`http://127.0.0.1:${TEST_PORT}/api/status`);
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.nodeId, 'test-node');
    assert.deepEqual(data.agents, ['agent-01']);
    assert.ok(data.status);
  });

  it('should respond to /api/discovery', async () => {
    const response = await fetch(`http://127.0.0.1:${TEST_PORT}/api/discovery`);
    const data = await response.json();

    assert.equal(data.nodeId, 'test-node');
    assert.equal(data.apiPort, TEST_PORT);
  });

  it('should send and check inbox via API', async () => {
    // 发送消息
    const sendResponse = await fetch(`http://127.0.0.1:${TEST_PORT}/api/inbox/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'remote-agent',
        to: 'agent-01',
        title: 'API Test Message',
        priority: 'P1',
        body: 'Sent via HTTP API',
      }),
    });

    const sendResult = await sendResponse.json();
    assert.equal(sendResponse.status, 200);
    assert.ok(sendResult.success);

    // 检查消息
    const checkResponse = await fetch(`http://127.0.0.1:${TEST_PORT}/api/inbox/check/agent-01`);
    const checkResult = await checkResponse.json();

    assert.equal(checkResult.count, 1);
    assert.equal(checkResult.messages[0].title, 'API Test Message');
  });

  it('should return 404 for unknown agent', async () => {
    const response = await fetch(`http://127.0.0.1:${TEST_PORT}/api/inbox/check/unknown`);
    assert.equal(response.status, 404);
  });

  it('should return tasks via API', async () => {
    const response = await fetch(`http://127.0.0.1:${TEST_PORT}/api/tasks`);
    const data = await response.json();
    assert.ok(Array.isArray(data.tasks));
  });

  it('should get SHARD via API', async () => {
    const response = await fetch(`http://127.0.0.1:${TEST_PORT}/api/shard`);
    const data = await response.json();
    assert.ok(data.data);
    assert.ok(typeof data.content === 'string');
  });
});

// ── Token 认证 ──

describe('CollabServer: Token Auth', () => {
  let server;
  const TOKEN = 'test-secret-token-123';

  after(async () => {
    if (server) await server.stop();
  });

  it('should reject requests without token', async () => {
    server = new CollabServer({
      sharedDir,
      nodeId: 'auth-test',
      agents: ['agent-01'],
      port: TEST_PORT + 1,
      token: TOKEN,
    });

    await server.start();

    const response = await fetch(`http://127.0.0.1:${TEST_PORT + 1}/api/status`);
    assert.equal(response.status, 401);
  });

  it('should accept requests with valid token', async () => {
    const response = await fetch(`http://127.0.0.1:${TEST_PORT + 1}/api/status`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` },
    });
    assert.equal(response.status, 200);
  });
});

// ── 消息路由 ──

describe('Router', () => {
  it('should route messages to local agents', async () => {
    const discovery = new Discovery({
      nodeId: 'router-test',
      agents: ['local-agent'],
      apiPort: TEST_PORT + 2,
    });

    const router = new Router({ sharedDir, discovery, token: null });

    const result = await router.send({
      from: 'local-agent',
      to: 'local-agent',
      title: 'Local message',
      body: 'Should be written to file',
    });

    assert.equal(result.success, true);
    assert.equal(result.route, 'local');

    discovery.stop();
  });

  it('should fail gracefully for unknown remote agents', async () => {
    const discovery = new Discovery({
      nodeId: 'router-test-2',
      agents: ['local-agent'],
      apiPort: TEST_PORT + 3,
    });

    const router = new Router({ sharedDir, discovery, token: null });

    const result = await router.send({
      from: 'local-agent',
      to: 'remote-agent-doesnt-exist',
      title: 'Should fail',
    });

    assert.equal(result.success, false);
    assert.equal(result.route, 'unknown');
    assert.ok(result.error.includes('未在局域网内发现'));

    discovery.stop();
  });

  it('should check inbox for local agents', async () => {
    const discovery = new Discovery({
      nodeId: 'router-test-3',
      agents: ['agent-01'],
      apiPort: TEST_PORT + 4,
    });

    const router = new Router({ sharedDir, discovery, token: null });

    const result = await router.checkInbox('agent-01');
    assert.equal(result.source, 'local');
    assert.ok(Array.isArray(result.messages));

    discovery.stop();
  });
});

// ── 端到端: 双节点通信 ──

describe('E2E: Two-node communication', () => {
  let serverA;
  let serverB;
  let discoveryA;
  let discoveryB;
  const PORT_A = TEST_PORT + 10;
  const PORT_B = TEST_PORT + 11;
  let sharedDirB;

  before(async () => {
    // 节点 B 的 shared 目录
    sharedDirB = path.join(tmpDir, '.shared-b');
    initCmd.init({ projectName: 'Node B', sharedDir: sharedDirB });

    // 启动两个服务器
    serverA = new CollabServer({
      sharedDir,
      nodeId: 'node-a',
      agents: ['claude-01'],
      port: PORT_A,
    });

    serverB = new CollabServer({
      sharedDir: sharedDirB,
      nodeId: 'node-b',
      agents: ['workbuddy-01'],
      port: PORT_B,
    });

    await serverA.start();
    await serverB.start();
  });

  after(async () => {
    if (discoveryA) discoveryA.stop();
    if (discoveryB) discoveryB.stop();
    if (serverA) await serverA.stop();
    if (serverB) await serverB.stop();
  });

  it('node A should send message to node B via HTTP', async () => {
    // 节点 A 直接调用节点 B 的 API
    const response = await fetch(`http://127.0.0.1:${PORT_B}/api/inbox/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'claude-01',
        to: 'workbuddy-01',
        title: 'Cross-node message',
        priority: 'P0',
        body: 'Hello from node A!',
      }),
    });

    const result = await response.json();
    assert.equal(result.success, true);

    // 验证消息在节点 B 上
    const checkResponse = await fetch(`http://127.0.0.1:${PORT_B}/api/inbox/check/workbuddy-01`);
    const checkResult = await checkResponse.json();

    assert.equal(checkResult.count, 1);
    assert.equal(checkResult.messages[0].from, 'claude-01');
    assert.equal(checkResult.messages[0].title, 'Cross-node message');
  });

  it('node B should send message to node A via HTTP', async () => {
    const response = await fetch(`http://127.0.0.1:${PORT_A}/api/inbox/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'workbuddy-01',
        to: 'claude-01',
        title: 'Reply from node B',
        priority: 'P1',
        type: 'response',
      }),
    });

    const result = await response.json();
    assert.equal(result.success, true);
  });

  it('both nodes should report correct status', async () => {
    const statusA = await (await fetch(`http://127.0.0.1:${PORT_A}/api/status`)).json();
    const statusB = await (await fetch(`http://127.0.0.1:${PORT_B}/api/status`)).json();

    assert.equal(statusA.nodeId, 'node-a');
    assert.equal(statusB.nodeId, 'node-b');
    assert.deepEqual(statusA.agents, ['claude-01']);
    assert.deepEqual(statusB.agents, ['workbuddy-01']);
  });
});
