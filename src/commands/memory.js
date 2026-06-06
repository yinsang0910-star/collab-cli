/**
 * memory.js — collab memory 命令
 *
 * 记忆衰减管理：归档、压缩、摘要
 */

import fs from 'node:fs';
import path from 'node:path';
import * as yaml from '../core/yaml.js';
import { ShardManager } from '../core/shard.js';
import { now, today, isWithinDays } from '../utils/timestamp.js';
import { countBodyLines } from '../utils/markdown.js';

const L1_MAX_LINES = 50;

/**
 * 执行记忆压缩（全局检查 + 自动归档）
 *
 * @param {string} sharedDir
 * @param {string} agentId - 执行者
 * @returns {CompactReport}
 *
 * @typedef {Object} CompactReport
 * @property {Object} shard - SHARD 压缩结果
 * @property {Object[]} l1 - L1 文件压缩结果
 * @property {string[]} messages - 操作消息
 */
export function compact(sharedDir, agentId) {
  const messages = [];

  // 1. SHARD 自动归档
  const sm = new ShardManager(sharedDir);
  const shardResult = sm.autoArchive(agentId);
  if (shardResult.archived > 0) {
    messages.push(`SHARD: ${shardResult.message}`);
  } else if (shardResult.error) {
    messages.push(`SHARD: 归档失败 — ${shardResult.error}`);
  }

  // 检查 SHARD 大小
  const shardSize = sm.checkSize();
  if (shardSize.needsCompact) {
    messages.push(`SHARD: 仍有 ${shardSize.lineCount} 行 (超过 ${shardSize.overage} 行)，可能需要手动精简`);
  }

  // 2. L1 文件检查
  const memoryDir = path.join(sharedDir, 'memory');
  const l1Results = [];

  if (fs.existsSync(memoryDir)) {
    const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(memoryDir, file);
      const { data, content } = yaml.read(filePath);
      const lineCount = countBodyLines(content);

      if (lineCount > L1_MAX_LINES) {
        l1Results.push({
          file,
          lineCount,
          maxLines: L1_MAX_LINES,
          overage: lineCount - L1_MAX_LINES,
          needsCompact: true,
        });
        messages.push(`L1/${file}: ${lineCount} 行 (超过 ${lineCount - L1_MAX_LINES} 行)，建议手动摘要`);
      } else {
        l1Results.push({
          file,
          lineCount,
          maxLines: L1_MAX_LINES,
          overage: 0,
          needsCompact: false,
        });
      }
    }
  }

  if (messages.length === 0) {
    messages.push('所有记忆文件均在限制内，无需压缩');
  }

  return {
    shard: shardSize,
    l1: l1Results,
    messages,
  };
}

/**
 * 手动归档指定日期
 *
 * @param {string} sharedDir
 * @param {string} date - 日期字符串 e.g. "2026-06-05"
 * @param {string} content - 归档内容
 * @returns {{ success: boolean, path?: string, error?: string }}
 */
export function archive(sharedDir, date, content) {
  const archiveDir = path.join(sharedDir, 'archive');
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  const archivePath = path.join(archiveDir, `${date}.md`);

  if (fs.existsSync(archivePath)) {
    // 追加到现有归档
    const existing = fs.readFileSync(archivePath, 'utf-8');
    fs.writeFileSync(archivePath, existing + '\n' + content, 'utf-8');
  } else {
    // 创建新归档
    const header = `---\ndate: ${date}\narchived_at: ${now()}\n---\n\n`;
    fs.writeFileSync(archivePath, header + `# 归档 ${date}\n\n${content}`, 'utf-8');
  }

  return { success: true, path: archivePath };
}

/**
 * 获取记忆统计
 *
 * @param {string} sharedDir
 * @returns {MemoryStats}
 *
 * @typedef {Object} MemoryStats
 * @property {number} shardLines
 * @property {number} shardMax
 * @property {Object[]} l1Files
 * @property {Object[]} archiveFiles
 */
export function stats(sharedDir) {
  const result = {
    shardLines: 0,
    shardMax: 80,
    l1Files: [],
    archiveFiles: [],
  };

  // SHARD
  const shardPath = path.join(sharedDir, 'SHARD.md');
  if (fs.existsSync(shardPath)) {
    const { content } = yaml.read(shardPath);
    result.shardLines = countBodyLines(content);
  }

  // L1
  const memoryDir = path.join(sharedDir, 'memory');
  if (fs.existsSync(memoryDir)) {
    const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const { content } = yaml.read(path.join(memoryDir, file));
      result.l1Files.push({
        file,
        lines: countBodyLines(content),
        overLimit: countBodyLines(content) > L1_MAX_LINES,
      });
    }
  }

  // L2
  const archiveDir = path.join(sharedDir, 'archive');
  if (fs.existsSync(archiveDir)) {
    const files = fs.readdirSync(archiveDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const filePath = path.join(archiveDir, file);
      const stat = fs.statSync(filePath);
      result.archiveFiles.push({
        file,
        sizeKB: Math.round(stat.size / 1024 * 10) / 10,
        modified: stat.mtime.toISOString(),
      });
    }
  }

  return result;
}

/**
 * 格式化记忆统计
 * @param {MemoryStats} data
 * @returns {string}
 */
export function formatStats(data) {
  const lines = [
    '🧠 记忆层级统计:',
    '',
    `L0 (SHARD.md): ${data.shardLines}/${data.shardMax} 行${data.shardLines > data.shardMax ? ' ⚠️ 超限' : ''}`,
    '',
    'L1 (记忆片段):',
  ];

  if (data.l1Files.length === 0) {
    lines.push('   (无文件)');
  } else {
    for (const f of data.l1Files) {
      lines.push(`   ${f.file}: ${f.lines} 行${f.overLimit ? ' ⚠️ 超限' : ''}`);
    }
  }

  lines.push('');
  lines.push('L2 (归档):');

  if (data.archiveFiles.length === 0) {
    lines.push('   (无归档)');
  } else {
    for (const f of data.archiveFiles) {
      lines.push(`   ${f.file}: ${f.sizeKB}KB`);
    }
  }

  return lines.join('\n');
}
