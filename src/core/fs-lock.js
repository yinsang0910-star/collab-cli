/**
 * fs-lock.js — 文件级乐观锁
 *
 * 基于 frontmatter 的 last_updated_by + last_updated_at 实现冲突检测。
 * 不使用 OS 级文件锁——轻量、跨平台、不阻塞读取。
 *
 * 使用方式：
 *   const lock = new OptimisticLock(filePath);
 *   if (lock.acquire('claude-01')) {
 *     // 安全写入
 *     lock.release();
 *   } else {
 *     // 冲突——需要合并或仲裁
 *   }
 */

import fs from 'node:fs';
import * as yaml from './yaml.js';
import { now } from '../utils/timestamp.js';

export class OptimisticLock {
  constructor(filePath) {
    this.filePath = filePath;
    this._lastSeen = null;  // 上次读取时的 updated_at
  }

  /**
   * 读取文件并记录版本快照
   * @returns {{ data: Object, content: string }}
   */
  read() {
    const { data, content } = yaml.read(this.filePath);
    this._lastSeen = data.last_updated_at || null;
    return { data, content };
  }

  /**
   * 尝试获取写入权限（乐观锁）
   *
   * @param {string} agentId - 请求写入的 agent
   * @returns {{ acquired: boolean, reason?: string, currentOwner?: string }}
   */
  acquire(agentId) {
    if (!fs.existsSync(this.filePath)) {
      // 文件不存在，标记为"即将创建"，后续 acquire 需要检测
      this._lastSeen = '__creating__';
      return { acquired: true };
    }

    const { data } = yaml.safeRead(this.filePath);
    const currentUpdated = data.last_updated_at || null;
    const currentBy = data.last_updated_by || null;

    // 首次 acquire（_lastSeen 未设置）：读取当前版本作为基线
    if (!this._lastSeen && currentUpdated) {
      this._lastSeen = currentUpdated;
      return { acquired: true };
    }

    // 检查是否自上次读取以来被修改
    if (this._lastSeen && this._lastSeen !== '__creating__' && currentUpdated && currentUpdated !== this._lastSeen) {
      return {
        acquired: false,
        reason: 'file_modified_since_last_read',
        currentOwner: currentBy,
        lastUpdated: currentUpdated,
      };
    }

    return { acquired: true };
  }

  /**
   * 释放锁并更新 frontmatter 标记
   *
   * @param {Object} data - 完整的 frontmatter 对象
   * @param {string} content - Markdown body
   * @param {string} agentId - 写入者
   */
  release(data, content, agentId) {
    const updated = {
      ...data,
      last_updated_by: agentId,
      last_updated_at: now(),
    };
    yaml.write(this.filePath, updated, content);
    this._lastSeen = updated.last_updated_at;
  }

  /**
   * 获取文件的最后更新信息
   * @returns {{ by: string|null, at: string|null }}
   */
  lastUpdate() {
    const { data } = yaml.safeRead(this.filePath);
    return {
      by: data.last_updated_by || null,
      at: data.last_updated_at || null,
    };
  }
}

/**
 * 创建冲突记录文件
 *
 * @param {string} conflictsDir - conflicts/ 目录路径
 * @param {Object} conflict - 冲突信息
 * @param {string} conflict.file - 冲突文件路径
 * @param {string} conflict.agent1 - 先写入者
 * @param {string} conflict.agent2 - 后写入者（被阻塞）
 * @param {string} conflict.reason - 冲突原因
 * @returns {string} 冲突文件路径
 */
export function createConflictRecord(conflictsDir, conflict) {
  if (!fs.existsSync(conflictsDir)) {
    fs.mkdirSync(conflictsDir, { recursive: true });
  }

  const timestamp = now().replace(/[:.]/g, '-');
  const random = Math.random().toString(36).slice(2, 6);
  const id = `C-${timestamp}-${random}`;
  const filePath = `${conflictsDir}/${id}.md`;

  const data = {
    id,
    status: 'open',
    file: conflict.file,
    agent1: conflict.agent1,
    agent2: conflict.agent2,
    created_at: now(),
  };

  const content = [
    `# 冲突记录: ${id}`,
    '',
    `**文件**: \`${conflict.file}\``,
    `**冲突方**: ${conflict.agent1} vs ${conflict.agent2}`,
    `**原因**: ${conflict.reason}`,
    '',
    '## 状态',
    '',
    '等待总工仲裁。',
    '',
    '## 裁定',
    '',
    '_（由总工填写）_',
    '',
  ].join('\n');

  yaml.write(filePath, data, content);
  return filePath;
}
