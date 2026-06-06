/**
 * heartbeat.test.js — heartbeat.js 单元测试
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as initCmd from '../commands/init.js';
import * as inboxCmd from '../commands/inbox.js';
import { checkOnce, startHeartbeat, formatHeartbeatStatus } from '../commands/heartbeat.js';

let tmpDir;
let sharedDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-hb-test-'));
  sharedDir = path.join(tmpDir, '.shared');
  initCmd.init({ projectName: 'HB Test', sharedDir });
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('checkOnce', () => {
  it('should return 0 when no messages', () => {
    const result = checkOnce(sharedDir, 'agent-01');
    assert.equal(result.count, 0);
    assert.equal(result.hasHighPriority, false);
  });

  it('should detect unread messages', () => {
    inboxCmd.send(sharedDir, {
      from: 'wb', to: 'agent-01', title: 'Test', priority: 'P2',
    });

    const result = checkOnce(sharedDir, 'agent-01');
    assert.equal(result.count, 1);
    assert.equal(result.hasHighPriority, false);
  });

  it('should detect high priority', () => {
    // Mark all existing as read
    const existing = inboxCmd.check(sharedDir, 'agent-01');
    for (const msg of existing) {
      inboxCmd.markRead(sharedDir, 'agent-01', msg.id);
    }

    inboxCmd.send(sharedDir, {
      from: 'wb', to: 'agent-01', title: 'Urgent', priority: 'P0',
    });

    const result = checkOnce(sharedDir, 'agent-01');
    assert.equal(result.count, 1);
    assert.equal(result.hasHighPriority, true);
  });
});

describe('formatHeartbeatStatus', () => {
  it('should format empty state', () => {
    const text = formatHeartbeatStatus({ unread: [], count: 0, hasHighPriority: false });
    assert.ok(text.includes('无未读消息'));
  });

  it('should format with messages', () => {
    const text = formatHeartbeatStatus({
      unread: [{ priority: 'P1', from: 'wb', title: 'Review' }],
      count: 1,
      hasHighPriority: true,
    });
    assert.ok(text.includes('1 条未读'));
    assert.ok(text.includes('高优先级'));
  });
});

describe('startHeartbeat', () => {
  it('should detect new messages after start', (_, done) => {
    // 先标记所有现有消息为已读
    const existing = inboxCmd.check(sharedDir, 'agent-01');
    for (const msg of existing) {
      inboxCmd.markRead(sharedDir, 'agent-01', msg.id);
    }

    // 发一条已有消息（不会触发通知，因为 heartbeat 启动时已读）
    inboxCmd.send(sharedDir, {
      from: 'wb', to: 'agent-01', title: 'Existing', priority: 'P3',
    });

    const notifications = [];
    const hb = startHeartbeat(sharedDir, 'agent-01', {
      interval: 1, // 1 秒
      onNotification: (n) => notifications.push(n),
    });

    // 等 500ms 后发一条新消息
    setTimeout(() => {
      inboxCmd.send(sharedDir, {
        from: 'wb', to: 'agent-01', title: 'New!', priority: 'P1',
      });
    }, 500);

    // 等 2 秒后检查
    setTimeout(() => {
      hb.stop();
      assert.ok(notifications.length >= 1, 'Should have at least 1 notification');
      assert.equal(notifications[0].type, 'new_message');
      assert.equal(notifications[0].message.title, 'New!');
      done();
    }, 2000);
  });
});
