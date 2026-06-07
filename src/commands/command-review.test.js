/**
 * command-review.test.js — 指令系统 + 自审查框架测试
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as initCmd from '../commands/init.js';
import * as taskCmd from '../commands/task.js';
import * as commandCmd from '../commands/command.js';
import * as reviewCmd from '../commands/review.js';
import { executePendingCommands } from '../commands/executor.js';

let tmpDir;
let sharedDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-cmd-review-test-'));
  sharedDir = path.join(tmpDir, '.shared');
  initCmd.init({ projectName: 'Cmd Review Test', sharedDir });
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── 指令系统 ──

describe('Command: create', () => {
  it('should create a command', () => {
    const result = commandCmd.createCommand(sharedDir, {
      from: 'claude-01',
      to: 'workbuddy-01',
      type: 'command',
      instruction: '运行 factor_pipeline.py',
      priority: 'P1',
    });
    assert.equal(result.success, true);
    assert.ok(result.id.startsWith('CMD-'));
  });

  it('should reject invalid type', () => {
    const result = commandCmd.createCommand(sharedDir, {
      from: 'claude-01',
      to: 'workbuddy-01',
      type: 'invalid',
      instruction: 'test',
    });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('无效类型'));
  });

  it('should reject missing fields', () => {
    const result = commandCmd.createCommand(sharedDir, { from: 'a' });
    assert.equal(result.success, false);
  });
});

describe('Command: list and filter', () => {
  it('should list all commands', () => {
    const commands = commandCmd.listCommands(sharedDir);
    assert.ok(commands.length >= 1);
  });

  it('should filter by recipient', () => {
    const commands = commandCmd.listCommands(sharedDir, { to: 'workbuddy-01' });
    assert.ok(commands.every(c => c.to === 'workbuddy-01'));
  });

  it('should filter by status', () => {
    const commands = commandCmd.listCommands(sharedDir, { status: 'pending' });
    assert.ok(commands.every(c => c.status === 'pending'));
  });
});

describe('Command: status transitions', () => {
  it('should allow pending → executing', () => {
    const commands = commandCmd.listCommands(sharedDir, { status: 'pending' });
    const cmd = commands[0];
    const result = commandCmd.startCommand(sharedDir, cmd.id, 'workbuddy-01');
    assert.equal(result.success, true);
  });

  it('should allow executing → completed', () => {
    const commands = commandCmd.listCommands(sharedDir, { status: 'executing' });
    const cmd = commands[0];
    const result = commandCmd.completeCommand(sharedDir, cmd.id, 'workbuddy-01', '因子重跑完成，3个通过');
    assert.equal(result.success, true);
  });

  it('should reject invalid transition', () => {
    const commands = commandCmd.listCommands(sharedDir, { status: 'completed' });
    const cmd = commands[0];
    const result = commandCmd.startCommand(sharedDir, cmd.id, 'workbuddy-01');
    assert.equal(result.success, false);
  });
});

// ── 自动执行器 ──

describe('Executor: auto-execute', () => {
  it('should execute pending notify commands', async () => {
    // 创建一个 notify 类型的指令
    commandCmd.createCommand(sharedDir, {
      from: 'claude-01',
      to: 'executor-test',
      type: 'notify',
      instruction: 'SHARD 已更新',
      priority: 'P2',
    });

    const report = await executePendingCommands(sharedDir, 'executor-test', async (cmd) => {
      if (cmd.type === 'notify') {
        return { success: true, result: '已通知' };
      }
      return { success: false, result: '不支持的类型' };
    });

    assert.ok(report.executed >= 1);
  });

  it('should skip P0 commands (require confirmation)', async () => {
    commandCmd.createCommand(sharedDir, {
      from: 'claude-01',
      to: 'executor-test-2',
      type: 'command',
      instruction: '删除所有数据',
      priority: 'P0',
    });

    const report = await executePendingCommands(sharedDir, 'executor-test-2', async () => {
      return { success: true, result: 'done' };
    });

    assert.ok(report.skipped >= 1);
  });
});

// ── 自审查 ──

describe('Review: create and submit', () => {
  let taskId;

  before(() => {
    const taskResult = taskCmd.create(sharedDir, {
      title: 'Review Test Task',
      assignee: 'claude-01',
      priority: 'P1',
    });
    taskId = taskResult.id;
    taskCmd.updateStatus(sharedDir, taskId, 'IN_PROGRESS', { operator: 'claude-01' });
  });

  it('should create a review', () => {
    const result = reviewCmd.createReview(sharedDir, {
      taskId,
      requestedBy: 'claude-01',
      checks: ['code_quality', 'test_coverage'],
    });
    assert.equal(result.success, true);
    assert.ok(result.id.startsWith('RVW-'));
  });

  it('should submit check results', () => {
    const reviews = reviewCmd.getReviewsForTask(sharedDir, taskId);
    const review = reviews[0];

    const r1 = reviewCmd.submitCheck(sharedDir, review.id, 'code_quality', {
      reviewer: 'reasonix-01',
      passed: true,
      score: 85,
      notes: '代码结构良好',
    });
    assert.equal(r1.success, true);
    assert.equal(r1.allDone, false); // 还有一项没审

    const r2 = reviewCmd.submitCheck(sharedDir, review.id, 'test_coverage', {
      reviewer: 'codex-01',
      passed: true,
      score: 90,
      notes: '覆盖率达 80%',
    });
    assert.equal(r2.success, true);
    assert.equal(r2.allDone, true);
    assert.equal(r2.status, 'passed');
  });
});

describe('Review: self-review', () => {
  it('should run self-review on a task', () => {
    const taskResult = taskCmd.create(sharedDir, {
      title: 'Self Review Task',
      assignee: 'claude-01',
      priority: 'P2',
    });
    taskCmd.updateStatus(sharedDir, taskResult.id, 'IN_PROGRESS', { operator: 'claude-01' });
    taskCmd.updateStatus(sharedDir, taskResult.id, 'REVIEW', { operator: 'claude-01' });

    const result = reviewCmd.selfReview(sharedDir, taskResult.id, 'claude-01');
    assert.ok(result.review);
    assert.equal(result.review.status, 'passed');
  });
});
