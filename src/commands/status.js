/**
 * status.js — collab status 命令
 *
 * 显示协作体系全局状态总览
 */

import fs from 'node:fs';
import path from 'node:path';
import { ShardManager } from '../core/shard.js';
import * as yaml from '../core/yaml.js';

/**
 * 获取全局状态
 *
 * @param {string} sharedDir - .shared/ 目录路径
 * @returns {StatusReport}
 *
 * @typedef {Object} StatusReport
 * @property {Object} system - 系统信息
 * @property {Object} shard - SHARD 摘要
 * @property {Object[]} badges - 所有工牌
 * @property {Object} tasks - 任务统计
 * @property {Object} inbox - 消息统计
 * @property {Object} memory - 记忆统计
 * @property {Object[]} conflicts - 未解决冲突
 */
export function status(sharedDir) {
  const report = {
    system: getSystemInfo(sharedDir),
    shard: getShardSummary(sharedDir),
    badges: getBadges(sharedDir),
    tasks: getTaskStats(sharedDir),
    inbox: getInboxStats(sharedDir),
    memory: getMemoryStats(sharedDir),
    conflicts: getConflicts(sharedDir),
  };

  return report;
}

/**
 * 格式化状态报告为可读文本
 * @param {StatusReport} report
 * @returns {string}
 */
export function formatStatus(report) {
  const lines = [];
  const sep = '─'.repeat(50);

  lines.push('');
  lines.push(`📋 协作体系状态 — ${report.system.project}`);
  lines.push(sep);

  // SHARD
  const s = report.shard;
  lines.push(`\n📝 SHARD (L0 活记忆): ${s.lineCount}/${s.maxLines} 行`);
  lines.push(`   最后更新: ${s.lastUpdatedBy} @ ${s.lastUpdatedAt}`);
  if (s.needsCompact) lines.push(`   ⚠️ 超出限制 ${s.overage} 行，运行 collab memory compact`);

  // 工牌
  lines.push(`\n🪪 工牌 (${report.badges.length} 个):`);
  if (report.badges.length === 0) {
    lines.push('   (无活跃工牌)');
  } else {
    for (const b of report.badges) {
      lines.push(`   ${b.agentId}: ${b.role} (${b.assignedBy}) — session: ${b.sessionId}`);
    }
  }

  // 任务
  const t = report.tasks;
  lines.push(`\n📋 任务: ${t.total} 总计`);
  lines.push(`   IN_PROGRESS: ${t.inProgress} | ASSIGNED: ${t.assigned} | REVIEW: ${t.review} | DONE: ${t.done}`);

  // Inbox
  const i = report.inbox;
  const unreadTotal = Object.values(i).reduce((sum, agent) => sum + agent.unread, 0);
  lines.push(`\n📬 Inbox: ${unreadTotal} 条未读`);
  for (const [agentId, stats] of Object.entries(i)) {
    if (stats.unread > 0) {
      lines.push(`   ${agentId}: ${stats.unread} 未读 (P0:${stats.p0} P1:${stats.p1} P2:${stats.p2} P3:${stats.p3})`);
    }
  }

  // 记忆
  const m = report.memory;
  lines.push(`\n🧠 记忆: L1 ${m.l1Files} 个文件, L2 归档 ${m.archiveFiles} 个`);

  // 冲突
  if (report.conflicts.length > 0) {
    lines.push(`\n⚡ 冲突: ${report.conflicts.length} 个未解决`);
    for (const c of report.conflicts) {
      lines.push(`   ${c.id}: ${c.file} (${c.agent1} vs ${c.agent2})`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

// ── 内部工具 ──

function getSystemInfo(sharedDir) {
  const manifestPath = path.join(sharedDir, 'MANIFEST.md');
  if (!fs.existsSync(manifestPath)) return { project: '(未初始化)', version: '0.0.0' };

  const { data } = yaml.read(manifestPath);
  return {
    project: data.project || 'Untitled',
    version: data.version || '0.0.0',
    chiefEngineer: data.chief_engineer || 'unassigned',
  };
}

function getShardSummary(sharedDir) {
  const shardPath = path.join(sharedDir, 'SHARD.md');
  if (!fs.existsSync(shardPath)) {
    return { lineCount: 0, maxLines: 80, needsCompact: false, overage: 0,
             lastUpdatedBy: 'N/A', lastUpdatedAt: 'N/A' };
  }

  const sm = new ShardManager(sharedDir);
  return sm.summary();
}

function getBadges(sharedDir) {
  const badges = [];
  if (!fs.existsSync(sharedDir)) return badges;

  const files = fs.readdirSync(sharedDir)
    .filter(f => f.startsWith('BADGE-') && f.endsWith('.md'));

  for (const file of files) {
    const { data } = yaml.read(path.join(sharedDir, file));
    badges.push({
      agentId: data.agent_id || file.replace('BADGE-', '').replace('.md', ''),
      sessionId: data.session_id || 'unknown',
      role: data.role || 'L0',
      assignedBy: data.assigned_by || 'unknown',
      issuedAt: data.issued_at || 'unknown',
    });
  }

  return badges;
}

function getTaskStats(sharedDir) {
  const tasksDir = path.join(sharedDir, 'tasks');
  const stats = { total: 0, draft: 0, assigned: 0, inProgress: 0, review: 0, done: 0, blocked: 0 };

  if (!fs.existsSync(tasksDir)) return stats;

  const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md'));
  stats.total = files.length;

  for (const file of files) {
    const { data } = yaml.safeRead(path.join(tasksDir, file));
    const status = (data.status || 'DRAFT').toLowerCase().replace('_', '');
    if (status.includes('draft')) stats.draft++;
    else if (status.includes('assigned')) stats.assigned++;
    else if (status.includes('inprogress')) stats.inProgress++;
    else if (status.includes('review')) stats.review++;
    else if (status.includes('done')) stats.done++;
    else if (status.includes('blocked')) stats.blocked++;
  }

  return stats;
}

function getInboxStats(sharedDir) {
  const inboxDir = path.join(sharedDir, 'inbox');
  const stats = {};

  if (!fs.existsSync(inboxDir)) return stats;

  const agentDirs = fs.readdirSync(inboxDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'));

  for (const agentDir of agentDirs) {
    const agentId = agentDir.name;
    const agentPath = path.join(inboxDir, agentId);
    const files = fs.readdirSync(agentPath).filter(f => f.endsWith('.md'));

    const agentStats = { total: files.length, unread: 0, p0: 0, p1: 0, p2: 0, p3: 0 };

    for (const file of files) {
      const { data } = yaml.safeRead(path.join(agentPath, file));
      if (data.status === 'unread') {
        agentStats.unread++;
        const p = (data.priority || 'P3').toUpperCase();
        if (p === 'P0') agentStats.p0++;
        else if (p === 'P1') agentStats.p1++;
        else if (p === 'P2') agentStats.p2++;
        else agentStats.p3++;
      }
    }

    stats[agentId] = agentStats;
  }

  return stats;
}

function getMemoryStats(sharedDir) {
  const memoryDir = path.join(sharedDir, 'memory');
  const archiveDir = path.join(sharedDir, 'archive');

  const l1Files = fs.existsSync(memoryDir)
    ? fs.readdirSync(memoryDir).filter(f => f.endsWith('.md')).length
    : 0;

  const archiveFiles = fs.existsSync(archiveDir)
    ? fs.readdirSync(archiveDir).filter(f => f.endsWith('.md')).length
    : 0;

  return { l1Files, archiveFiles };
}

function getConflicts(sharedDir) {
  const conflictsDir = path.join(sharedDir, 'conflicts');
  if (!fs.existsSync(conflictsDir)) return [];

  const files = fs.readdirSync(conflictsDir).filter(f => f.endsWith('.md'));
  const conflicts = [];

  for (const file of files) {
    const { data } = yaml.safeRead(path.join(conflictsDir, file));
    if (data.status === 'open') {
      conflicts.push({
        id: data.id || file.replace('.md', ''),
        file: data.file || 'unknown',
        agent1: data.agent1 || 'unknown',
        agent2: data.agent2 || 'unknown',
        createdAt: data.created_at || 'unknown',
      });
    }
  }

  return conflicts;
}
