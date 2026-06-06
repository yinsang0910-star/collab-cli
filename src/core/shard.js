/**
 * shard.js — SHARD.md (L0 活记忆) 管理
 *
 * SHARD.md 是所有 agent 的必读文件，包含项目当前状态。
 * 行数限制：80 行。超过时触发自动归档。
 */

import fs from 'node:fs';
import path from 'node:path';
import * as yaml from './yaml.js';
import { OptimisticLock } from './fs-lock.js';
import { now, today, isWithinDays, getTimezoneOffset } from '../utils/timestamp.js';
import { countBodyLines, stripFrontmatter } from '../utils/markdown.js';

const SHARD_MAX_LINES = 80;
const RECENT_DAYS = 3;

export class ShardManager {
  constructor(sharedDir) {
    this.sharedDir = sharedDir;
    this.shardPath = path.join(sharedDir, 'SHARD.md');
    this.lock = new OptimisticLock(this.shardPath);
  }

  /**
   * 读取 SHARD.md
   * @returns {{ data: Object, content: string, lineCount: number }}
   */
  read() {
    const { data, content } = this.lock.read();
    return {
      data,
      content,
      lineCount: countBodyLines(content),
    };
  }

  /**
   * 检查 SHARD 是否需要压缩
   * @returns {{ needsCompact: boolean, lineCount: number, overage: number }}
   */
  checkSize() {
    const { lineCount } = this.read();
    const overage = lineCount - SHARD_MAX_LINES;
    return {
      needsCompact: overage > 0,
      lineCount,
      overage: Math.max(0, overage),
    };
  }

  /**
   * 更新 SHARD.md（带乐观锁）
   *
   * @param {string} agentId - 更新者
   * @param {Function} updater - (data, content) => { data, content } 更新函数
   * @returns {{ success: boolean, error?: string }}
   */
  update(agentId, updater) {
    const lockResult = this.lock.acquire(agentId);
    if (!lockResult.acquired) {
      return {
        success: false,
        error: `冲突：文件已被 ${lockResult.currentOwner} 于 ${lockResult.lastUpdated} 修改。请重新读取后重试。`,
      };
    }

    const { data, content } = this.lock.read();
    const updated = updater(data, content);
    this.lock.release(updated.data, updated.content, agentId);
    return { success: true };
  }

  /**
   * 自动归档：将超过 3 天的"最近完成"条目移入 archive/
   *
   * @param {string} agentId - 执行者
   * @returns {{ archived: number, message: string }}
   */
  autoArchive(agentId) {
    const { data, content } = this.lock.read();

    // 解析 content 中的"最近完成"表格
    const lines = content.split('\n');
    const completedSectionStart = lines.findIndex(l =>
      l.includes('最近完成') || l.includes('## Recently Completed')
    );

    if (completedSectionStart === -1) {
      return { archived: 0, message: '没有找到"最近完成"区块' };
    }

    // 收集表格行（跳过表头和分隔线）
    const tableStart = completedSectionStart + 1;
    const toArchive = [];
    const toKeep = [];

    for (let i = tableStart; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim().startsWith('|')) break;

      // 解析日期（第一列）
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length < 2 || cells[0] === '日期' || cells[0].includes('---')) {
        toKeep.push(line);
        continue;
      }

      const dateCell = cells[0];
      // 尝试匹配日期格式: 06-05 或 2026-06-05
      const fullDate = dateCell.length === 5
        ? `${today().slice(0, 4)}-${dateCell}`
        : dateCell;

      const tz = getTimezoneOffset();
      if (isWithinDays(fullDate + `T00:00:00${tz}`, RECENT_DAYS)) {
        toKeep.push(line);
      } else {
        toArchive.push({ date: fullDate, line });
      }
    }

    if (toArchive.length === 0) {
      return { archived: 0, message: '没有需要归档的旧记录' };
    }

    // 写入归档
    this._writeArchive(toArchive);

    // 重建 SHARD（移除已归档行）
    const tz = getTimezoneOffset();
    const newLines = [];
    let inTable = false;
    let keptCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === completedSectionStart) {
        newLines.push(line);
        inTable = true;
        continue;
      }
      if (inTable) {
        if (!line.trim().startsWith('|')) {
          inTable = false;
          newLines.push(line);
          continue;
        }
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cells[0] === '日期' || cells[0].includes('---')) {
          newLines.push(line);
          continue;
        }
        const dateCell = cells[0];
        const fullDate = dateCell.length === 5
          ? `${today().slice(0, 4)}-${dateCell}`
          : dateCell;
        if (isWithinDays(fullDate + `T00:00:00${tz}`, RECENT_DAYS)) {
          newLines.push(line);
          keptCount++;
        }
        // 超过 3 天的不写入
      } else {
        newLines.push(line);
      }
    }

    const lockResult = this.lock.acquire(agentId);
    if (!lockResult.acquired) {
      return { archived: 0, error: '锁定失败' };
    }
    this.lock.release(data, newLines.join('\n'), agentId);

    return {
      archived: toArchive.length,
      message: `已归档 ${toArchive.length} 条记录到 archive/`,
    };
  }

  /**
   * 获取 SHARD 的摘要信息
   * @returns {Object}
   */
  summary() {
    const { data, content, lineCount } = this.read();
    const { needsCompact } = this.checkSize();

    // 提取活跃任务数
    const taskMatches = content.match(/\|\s*T-\d+/g);
    const activeTasks = taskMatches ? taskMatches.length : 0;

    return {
      version: data.version || 0,
      lastUpdatedBy: data.last_updated_by || 'unknown',
      lastUpdatedAt: data.last_updated_at || 'unknown',
      lineCount,
      maxLines: SHARD_MAX_LINES,
      needsCompact,
      activeTasks,
    };
  }

  // ── 内部工具 ──

  _writeArchive(entries) {
    const archiveDir = path.join(this.sharedDir, 'archive');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    // 按日期分组
    const byDate = {};
    for (const { date, line } of entries) {
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(line);
    }

    for (const [date, lines] of Object.entries(byDate)) {
      const archivePath = path.join(archiveDir, `${date}.md`);
      const existing = fs.existsSync(archivePath)
        ? fs.readFileSync(archivePath, 'utf-8')
        : `# 归档 ${date}\n\n`;

      const append = [
        '',
        `## SHARD 归档 (by auto-archive)`,
        '',
        ...lines,
        '',
      ].join('\n');

      fs.writeFileSync(archivePath, existing + append, 'utf-8');
    }
  }
}
