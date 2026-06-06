/**
 * conflict.js — collab conflict 命令
 *
 * 冲突记录管理：列出、创建、解决
 */

import fs from 'node:fs';
import path from 'node:path';
import * as yaml from '../core/yaml.js';
import { createConflictRecord } from '../core/fs-lock.js';
import { now } from '../utils/timestamp.js';

/**
 * 列出冲突
 *
 * @param {string} sharedDir
 * @param {Object} [filters]
 * @param {string} [filters.status] - open | resolved
 * @returns {Object[]}
 */
export function list(sharedDir, { status: filterStatus } = {}) {
  const conflictsDir = path.join(sharedDir, 'conflicts');
  if (!fs.existsSync(conflictsDir)) return [];

  const files = fs.readdirSync(conflictsDir).filter(f => f.endsWith('.md'));
  const conflicts = [];

  for (const file of files) {
    const { data } = yaml.safeRead(path.join(conflictsDir, file));

    if (filterStatus && data.status !== filterStatus) continue;

    conflicts.push({
      id: data.id || file.replace('.md', ''),
      status: data.status || 'open',
      file: data.file || 'unknown',
      agent1: data.agent1 || 'unknown',
      agent2: data.agent2 || 'unknown',
      createdAt: data.created_at || 'unknown',
      resolvedAt: data.resolved_at || null,
      resolvedBy: data.resolved_by || null,
    });
  }

  return conflicts;
}

/**
 * 创建冲突记录
 *
 * @param {string} sharedDir
 * @param {Object} opts
 * @param {string} opts.file - 冲突文件路径
 * @param {string} opts.agent1 - 先写入者
 * @param {string} opts.agent2 - 后写入者
 * @param {string} opts.reason - 冲突原因
 * @returns {{ success: boolean, id?: string, path?: string }}
 */
export function create(sharedDir, { file, agent1, agent2, reason }) {
  const conflictsDir = path.join(sharedDir, 'conflicts');
  const filePath = createConflictRecord(conflictsDir, { file, agent1, agent2, reason });

  const id = path.basename(filePath, '.md');
  return { success: true, id, path: filePath };
}

/**
 * 解决冲突
 *
 * @param {string} sharedDir
 * @param {string} conflictId - e.g. "C-2026-06-06T14-30-00-08-00"
 * @param {Object} opts
 * @param {string} opts.resolvedBy - 仲裁者
 * @param {string} opts.resolution - 裁定内容
 * @returns {{ success: boolean, error?: string }}
 */
export function resolve(sharedDir, conflictId, { resolvedBy, resolution }) {
  const filePath = findConflictFile(sharedDir, conflictId);
  if (!filePath) return { success: false, error: `冲突 ${conflictId} 不存在` };

  const { data, content } = yaml.read(filePath);

  data.status = 'resolved';
  data.resolved_by = resolvedBy || 'user';
  data.resolved_at = now();

  // 追加裁定内容
  const newContent = content.replace(
    '_（由总工填写）_',
    resolution || '已解决'
  );

  yaml.write(filePath, data, newContent);

  return { success: true };
}

/**
 * 格式化冲突列表
 * @param {Object[]} conflicts
 * @returns {string}
 */
export function formatConflictList(conflicts) {
  if (conflicts.length === 0) return '⚡ 无未解决冲突';

  const lines = ['⚡ 冲突列表:', ''];
  lines.push('| ID | 状态 | 文件 | Agent 1 | Agent 2 | 创建时间 |');
  lines.push('|----|------|------|---------|---------|----------|');

  for (const c of conflicts) {
    lines.push(`| ${c.id} | ${c.status} | ${c.file} | ${c.agent1} | ${c.agent2} | ${c.createdAt} |`);
  }

  return lines.join('\n');
}

// ── 内部工具 ──

function findConflictFile(sharedDir, conflictId) {
  const conflictsDir = path.join(sharedDir, 'conflicts');
  if (!fs.existsSync(conflictsDir)) return null;

  const files = fs.readdirSync(conflictsDir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    if (file.includes(conflictId)) return path.join(conflictsDir, file);

    const { data } = yaml.safeRead(path.join(conflictsDir, file));
    if (data.id === conflictId) return path.join(conflictsDir, file);
  }

  return null;
}
