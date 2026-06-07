/**
 * executor.js — 指令自动执行器
 *
 * 在 agent 握手时或心跳检查时，自动发现并执行待处理指令。
 * 执行结果写回指令文件 + 通知发送方。
 *
 * 用法:
 *   const report = await executePendingCommands(sharedDir, 'claude-01', executor);
 *   // report: { executed: 2, failed: 0, skipped: 1 }
 */

import * as cmdManager from './command.js';
import * as inboxCmd from './inbox.js';

/**
 * 执行所有待处理指令
 *
 * @param {string} sharedDir
 * @param {string} agentId - 当前 agent
 * @param {Function} executor - 实际执行函数 (cmd) => { success: boolean, result: string }
 * @returns {{ executed: number, failed: number, skipped: number, commands: Object[] }}
 */
export async function executePendingCommands(sharedDir, agentId, executor) {
  const pending = cmdManager.getPendingCommands(sharedDir, agentId);

  if (pending.length === 0) {
    return { executed: 0, failed: 0, skipped: 0, commands: [] };
  }

  let executed = 0;
  let failed = 0;
  let skipped = 0;
  const results = [];

  for (const cmd of pending) {
    // 跳过需要人工确认的高风险指令
    if (shouldRequireConfirmation(cmd)) {
      skipped++;
      results.push({ id: cmd.id, status: 'skipped', reason: '需要用户确认' });
      continue;
    }

    // 标记为执行中
    cmdManager.startCommand(sharedDir, cmd.id, agentId);

    try {
      // 执行指令
      const result = await executor(cmd);

      if (result.success) {
        cmdManager.completeCommand(sharedDir, cmd.id, agentId, result.result);
        executed++;

        // 通知发送方
        notifySender(sharedDir, agentId, cmd, 'completed', result.result);

        results.push({ id: cmd.id, status: 'completed', result: result.result });
      } else {
        cmdManager.failCommand(sharedDir, cmd.id, agentId, result.result);
        failed++;

        // 通知发送方
        notifySender(sharedDir, agentId, cmd, 'failed', result.result);

        results.push({ id: cmd.id, status: 'failed', reason: result.result });
      }
    } catch (err) {
      cmdManager.failCommand(sharedDir, cmd.id, agentId, err.message);
      failed++;
      notifySender(sharedDir, agentId, cmd, 'failed', err.message);
      results.push({ id: cmd.id, status: 'failed', reason: err.message });
    }
  }

  return { executed, failed, skipped, commands: results };
}

/**
 * 格式化执行报告
 *
 * @param {Object} report
 * @returns {string}
 */
export function formatExecutionReport(report) {
  if (report.executed === 0 && report.failed === 0 && report.skipped === 0) {
    return ''; // 无待处理指令，不输出
  }

  const lines = ['⚡ 指令执行报告:'];

  for (const cmd of report.commands) {
    if (cmd.status === 'completed') {
      lines.push(`   ✅ ${cmd.id}: 已完成`);
    } else if (cmd.status === 'failed') {
      lines.push(`   ❌ ${cmd.id}: 失败 — ${cmd.reason}`);
    } else if (cmd.status === 'skipped') {
      lines.push(`   ⏸️ ${cmd.id}: 跳过 — ${cmd.reason}`);
    }
  }

  return lines.join('\n');
}

/**
 * 检查指令是否需要用户确认才能执行
 */
function shouldRequireConfirmation(cmd) {
  // P0 指令需要确认
  if (cmd.priority === 'P0') return true;

  // delegate 类型需要确认
  if (cmd.type === 'delegate') return true;

  // 有关联任务且状态是 REVIEW 的需要确认
  if (cmd.type === 'approve' || cmd.type === 'reject') return true;

  return false;
}

/**
 * 通知指令发送方
 */
function notifySender(sharedDir, fromAgent, cmd, status, result) {
  const statusEmoji = status === 'completed' ? '✅' : '❌';
  const statusText = status === 'completed' ? '已完成' : '失败';

  inboxCmd.send(sharedDir, {
    from: fromAgent,
    to: cmd.from,
    title: `指令 ${cmd.id} ${statusText}`,
    priority: status === 'failed' ? 'P1' : 'P2',
    type: 'response',
    body: `${statusEmoji} 指令 "${cmd.instruction?.split('\n')[0]?.slice(0, 50)}" ${statusText}\n\n结果: ${result}`,
    relatedTask: cmd.task_id,
  });
}
