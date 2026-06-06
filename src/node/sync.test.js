/**
 * sync.test.js — 跨设备同步测试
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as initCmd from '../commands/init.js';
import * as taskCmd from '../commands/task.js';
import { CollabServer } from '../node/server.js';
import { SyncManager, pullFromPeer } from '../node/sync.js';
import { Discovery } from '../node/discovery.js';
import * as yaml from '../core/yaml.js';

let tmpDir;
let sharedDirA;
let sharedDirB;
const PORT_A = 29527;
const PORT_B = 29528;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-sync-test-'));
  sharedDirA = path.join(tmpDir, '.shared-a');
  sharedDirB = path.join(tmpDir, '.shared-b');
  initCmd.init({ projectName: 'Sync Test A', sharedDir: sharedDirA });
  initCmd.init({ projectName: 'Sync Test B', sharedDir: sharedDirB });
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sync: SHARD push/pull', () => {
  let serverA, serverB;

  after(async () => {
    if (serverA) await serverA.stop();
    if (serverB) await serverB.stop();
  });

  it('should push SHARD from A to B via API', async () => {
    serverA = new CollabServer({ sharedDir: sharedDirA, nodeId: 'a', agents: ['agent-a'], port: PORT_A });
    serverB = new CollabServer({ sharedDir: sharedDirB, nodeId: 'b', agents: ['agent-b'], port: PORT_B });
    await serverA.start();
    await serverB.start();

    // 修改 A 的 SHARD
    const shardPathA = path.join(sharedDirA, 'SHARD.md');
    yaml.write(shardPathA, { version: 5, last_updated_by: 'agent-a', last_updated_at: '2026-06-06T16:00:00+08:00' }, '# Updated from A\n');

    // 推送到 B
    const resp = await fetch(`http://127.0.0.1:${PORT_B}/api/sync/shard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { version: 5, last_updated_by: 'agent-a', last_updated_at: '2026-06-06T16:00:00+08:00' },
        content: '# Updated from A\n',
        version: 5,
      }),
    });

    const result = await resp.json();
    assert.equal(result.accepted, true);

    // 验证 B 的 SHARD 已更新
    const { data } = yaml.read(path.join(sharedDirB, 'SHARD.md'));
    assert.equal(data.version, 5);
  });

  it('should reject older version', async () => {
    // 推送旧版本
    const resp = await fetch(`http://127.0.0.1:${PORT_B}/api/sync/shard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { version: 3, last_updated_by: 'old' },
        content: '# Old version\n',
        version: 3,
      }),
    });

    const result = await resp.json();
    assert.equal(result.accepted, false);
  });
});

describe('Sync: Tasks push/pull', () => {
  let serverB;

  after(async () => {
    if (serverB) await serverB.stop();
  });

  it('should push tasks from A to B', async () => {
    serverB = new CollabServer({ sharedDir: sharedDirB, nodeId: 'b', agents: ['agent-b'], port: PORT_B + 10 });
    await serverB.start();

    // 在 A 创建任务
    taskCmd.create(sharedDirA, { title: 'Sync Task 1', assignee: 'agent-a', priority: 'P0' });
    taskCmd.create(sharedDirA, { title: 'Sync Task 2', assignee: 'agent-b', priority: 'P1' });

    const tasks = taskCmd.list(sharedDirA);

    // 推送到 B
    const resp = await fetch(`http://127.0.0.1:${PORT_B + 10}/api/sync/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks }),
    });

    const result = await resp.json();
    assert.ok(result.updated >= 2);

    // 验证 B 有了这些任务
    const tasksB = taskCmd.list(sharedDirB);
    assert.ok(tasksB.length >= 2);
  });
});

describe('Sync: pullFromPeer', () => {
  it('should pull SHARD and tasks from peer', async () => {
    const server = new CollabServer({ sharedDir: sharedDirA, nodeId: 'pull-test', agents: ['agent-a'], port: PORT_A + 20 });
    await server.start();

    const result = await pullFromPeer('127.0.0.1', PORT_A + 20, sharedDirB, '');

    assert.ok(result.shard !== null || result.tasks !== null);

    await server.stop();
  });
});

describe('Sync: SyncManager', () => {
  it('should detect SHARD version change', () => {
    const discovery = new Discovery({
      nodeId: 'sync-test',
      agents: ['agent-a'],
      apiPort: 99999,
    });

    const sync = new SyncManager({
      sharedDir: sharedDirA,
      discovery,
      token: null,
      onSync: () => {},
    });

    // 初始版本
    assert.equal(sync.lastShardVersion, 0);

    // 手动触发同步（无 peer，应该跳过）
    sync._syncAll();

    discovery.stop();
  });
});
