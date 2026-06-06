/**
 * commands.test.js — 命令层集成测试
 *
 * 测试 init / badge / task / inbox / memory / conflict 的完整流程
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as initCmd from '../commands/init.js';
import * as badgeCmd from '../commands/badge.js';
import * as taskCmd from '../commands/task.js';
import * as inboxCmd from '../commands/inbox.js';
import * as memoryCmd from '../commands/memory.js';
import * as conflictCmd from '../commands/conflict.js';
import * as statusCmd from '../commands/status.js';
import { handshake } from '../core/protocol.js';

let tmpDir;
let sharedDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-cmd-test-'));
  sharedDir = path.join(tmpDir, '.shared');
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── INIT ──

describe('init', () => {
  it('should create .shared structure', () => {
    const result = initCmd.init({ projectName: 'Test', sharedDir });
    assert.equal(result.success, true);
    assert.ok(result.created.length >= 8); // .shared + 5 dirs + MANIFEST + SHARD
    assert.ok(fs.existsSync(path.join(sharedDir, 'MANIFEST.md')));
    assert.ok(fs.existsSync(path.join(sharedDir, 'SHARD.md')));
    assert.ok(fs.existsSync(path.join(sharedDir, 'inbox')));
    assert.ok(fs.existsSync(path.join(sharedDir, 'tasks')));
    assert.ok(fs.existsSync(path.join(sharedDir, 'memory')));
    assert.ok(fs.existsSync(path.join(sharedDir, 'archive')));
    assert.ok(fs.existsSync(path.join(sharedDir, 'conflicts')));
  });

  it('should skip existing files', () => {
    const result = initCmd.init({ projectName: 'Test', sharedDir });
    assert.equal(result.success, true);
    assert.ok(result.warnings.length > 0);
  });
});

// ── BADGE ──

describe('badge', () => {
  it('should issue a badge', () => {
    const result = badgeCmd.issue(sharedDir, {
      agentId: 'claude-01',
      role: 'L4',
      assignedBy: 'user',
    });
    assert.equal(result.success, true);
    assert.ok(fs.existsSync(result.path));
  });

  it('should show a badge', () => {
    const result = badgeCmd.show(sharedDir, 'claude-01');
    assert.equal(result.exists, true);
    assert.equal(result.data.agent_id, 'claude-01');
    assert.equal(result.data.role, 'L4');
  });

  it('should list badges', () => {
    badgeCmd.issue(sharedDir, { agentId: 'wb-01', role: 'L2', assignedBy: 'user' });
    const badges = badgeCmd.list(sharedDir);
    assert.ok(badges.length >= 2);
    assert.ok(badges.some(b => b.agentId === 'claude-01'));
    assert.ok(badges.some(b => b.agentId === 'wb-01'));
  });

  it('should reject invalid role', () => {
    const result = badgeCmd.issue(sharedDir, { agentId: 'bad', role: 'L99' });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('无效角色'));
  });
});

// ── TASK ──

describe('task', () => {
  it('should create a task', () => {
    const result = taskCmd.create(sharedDir, {
      title: 'Test Task',
      assignee: 'claude-01',
      priority: 'P0',
    });
    assert.equal(result.success, true);
    assert.equal(result.id, 'T-001');
  });

  it('should create multiple tasks with incrementing IDs', () => {
    const r2 = taskCmd.create(sharedDir, { title: 'Task 2' });
    assert.equal(r2.id, 'T-002');
  });

  it('should list tasks', () => {
    const tasks = taskCmd.list(sharedDir);
    assert.ok(tasks.length >= 2);
  });

  it('should filter by assignee', () => {
    const tasks = taskCmd.list(sharedDir, { assignee: 'claude-01' });
    assert.ok(tasks.every(t => t.assignee === 'claude-01'));
  });

  it('should update status with valid transition', () => {
    const result = taskCmd.updateStatus(sharedDir, 'T-001', 'IN_PROGRESS', {
      operator: 'claude-01',
      note: 'started',
    });
    assert.equal(result.success, true);
    assert.equal(result.oldStatus, 'ASSIGNED');
    assert.equal(result.newStatus, 'IN_PROGRESS');
  });

  it('should reject invalid transition', () => {
    const result = taskCmd.updateStatus(sharedDir, 'T-001', 'DONE', { operator: 'claude-01' });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('非法状态转换'));
  });

  it('should allow REVIEW → DONE', () => {
    taskCmd.updateStatus(sharedDir, 'T-001', 'REVIEW', { operator: 'claude-01' });
    const result = taskCmd.updateStatus(sharedDir, 'T-001', 'DONE', { operator: 'user' });
    assert.equal(result.success, true);
  });
});

// ── INBOX ──

describe('inbox', () => {
  it('should send a message', () => {
    const result = inboxCmd.send(sharedDir, {
      from: 'wb-01',
      to: 'claude-01',
      title: 'Review Request',
      priority: 'P1',
      type: 'review_request',
      body: 'Please review this.',
      requiresResponse: true,
    });
    assert.equal(result.success, true);
    assert.equal(result.id, 'MSG-001');
  });

  it('should check unread messages', () => {
    const messages = inboxCmd.check(sharedDir, 'claude-01');
    assert.ok(messages.length >= 1);
    assert.equal(messages[0].status, 'unread');
  });

  it('should mark as read', () => {
    inboxCmd.markRead(sharedDir, 'claude-01', 'MSG-001');
    const messages = inboxCmd.check(sharedDir, 'claude-01');
    assert.equal(messages.length, 0);
  });

  it('should mark as done', () => {
    inboxCmd.send(sharedDir, { from: 'wb-01', to: 'claude-01', title: 'Another' });
    inboxCmd.markDone(sharedDir, 'claude-01', 'MSG-002');
    const messages = inboxCmd.check(sharedDir, 'claude-01');
    assert.equal(messages.length, 0);
  });

  it('should reject when missing fields', () => {
    const result = inboxCmd.send(sharedDir, { from: 'wb-01' });
    assert.equal(result.success, false);
  });
});

// ── MEMORY ──

describe('memory', () => {
  it('should return stats', () => {
    const stats = memoryCmd.stats(sharedDir);
    assert.ok(typeof stats.shardLines === 'number');
    assert.ok(Array.isArray(stats.l1Files));
    assert.ok(Array.isArray(stats.archiveFiles));
  });

  it('should compact without errors', () => {
    const result = memoryCmd.compact(sharedDir, 'system');
    assert.ok(result.messages.length > 0);
  });

  it('should archive to date file', () => {
    const result = memoryCmd.archive(sharedDir, '2026-01-01', 'Test archive entry');
    assert.equal(result.success, true);
    assert.ok(fs.existsSync(result.path));
  });
});

// ── CONFLICT ──

describe('conflict', () => {
  it('should create a conflict record', () => {
    const result = conflictCmd.create(sharedDir, {
      file: 'SHARD.md',
      agent1: 'claude-01',
      agent2: 'wb-01',
      reason: 'Both tried to write SHARD at the same time',
    });
    assert.equal(result.success, true);
    assert.ok(result.id.startsWith('C-'));
  });

  it('should list open conflicts', () => {
    const conflicts = conflictCmd.list(sharedDir, { status: 'open' });
    assert.ok(conflicts.length >= 1);
  });

  it('should resolve a conflict', () => {
    const open = conflictCmd.list(sharedDir, { status: 'open' });
    const result = conflictCmd.resolve(sharedDir, open[0].id, {
      resolvedBy: 'user',
      resolution: 'Accepted claude-01 version',
    });
    assert.equal(result.success, true);

    const remaining = conflictCmd.list(sharedDir, { status: 'open' });
    assert.equal(remaining.length, 0);
  });
});

// ── STATUS ──

describe('status', () => {
  it('should return full status report', () => {
    const report = statusCmd.status(sharedDir);
    assert.ok(report.system.project);
    assert.ok(report.shard);
    assert.ok(Array.isArray(report.badges));
    assert.ok(report.tasks);
    assert.ok(report.inbox);
    assert.ok(report.memory);
    assert.ok(Array.isArray(report.conflicts));
  });

  it('should format status as string', () => {
    const report = statusCmd.status(sharedDir);
    const text = statusCmd.formatStatus(report);
    assert.ok(typeof text === 'string');
    assert.ok(text.includes('协作体系状态'));
  });
});

// ── HANDSHAKE ──

describe('handshake', () => {
  it('should complete handshake for registered agent', () => {
    const report = handshake(sharedDir, 'claude-01');
    assert.equal(report.ok, true);
    assert.ok(report.manifest);
    assert.ok(report.badge);
    assert.equal(report.badge.role, 'L4');
  });

  it('should report missing badge for unknown agent', () => {
    const report = handshake(sharedDir, 'unknown-agent');
    assert.equal(report.ok, true);
    assert.equal(report.badge, null);
    assert.ok(report.actions.some(a => a.includes('工牌')));
  });
});
