/**
 * git-sync.js — collab git 命令
 *
 * 把 .shared/ 目录纳入 Git 管理，自动 commit/push/pull 变更。
 *
 * 用法:
 *   collab git init              — 初始化 .shared/ 为 git 仓库
 *   collab git sync              — 自动 commit + push + pull
 *   collab git status            — 显示未同步的变更
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { now } from '../utils/timestamp.js';

/**
 * 初始化 .shared/ 的 git 管理
 *
 * @param {string} sharedDir
 * @returns {{ success: boolean, message: string }}
 */
export function gitInit(sharedDir) {
  const gitDir = path.join(sharedDir, '.git');

  if (fs.existsSync(gitDir)) {
    return { success: true, message: 'Git 已初始化' };
  }

  try {
    execSync('git init', { cwd: sharedDir, stdio: 'pipe' });

    // 创建 .gitignore（排除临时文件）
    const gitignore = [
      '*.tmp',
      '*.corrupt',
      'BADGE-*.md',     // 工牌是会话级的，不提交
      'peers.yaml',     // LAN 配置是设备特定的
    ].join('\n');
    fs.writeFileSync(path.join(sharedDir, '.gitignore'), gitignore, 'utf-8');

    // 初始提交
    execSync('git add -A', { cwd: sharedDir, stdio: 'pipe' });
    execSync('git commit -m "chore: collab init — shared directory under git"', { cwd: sharedDir, stdio: 'pipe' });

    return { success: true, message: 'Git 初始化完成，首次提交已创建' };
  } catch (err) {
    return { success: false, message: `Git 初始化失败: ${err.message}` };
  }
}

/**
 * 同步 .shared/ 变更（自动 commit + push + pull）
 *
 * @param {string} sharedDir
 * @param {Object} opts
 * @param {string} opts.agentId - 执行同步的 agent
 * @param {boolean} opts.push - 是否推送到远程
 * @param {boolean} opts.pull - 是否从远程拉取
 * @returns {{ success: boolean, committed: boolean, pushed: boolean, pulled: boolean, message: string }}
 */
export function gitSync(sharedDir, { agentId, push = false, pull = false } = {}) {
  const gitDir = path.join(sharedDir, '.git');
  if (!fs.existsSync(gitDir)) {
    return { success: false, message: 'Git 未初始化。运行 collab git init' };
  }

  const result = { success: true, committed: false, pushed: false, pulled: false, message: '' };

  try {
    // Pull（如果启用）
    if (pull) {
      try {
        execSync('git pull --rebase --autostash', { cwd: sharedDir, stdio: 'pipe' });
        result.pulled = true;
      } catch (e) {
        // 无远程或冲突，继续
      }
    }

    // 检查是否有变更
    const status = execSync('git status --porcelain', { cwd: sharedDir, stdio: 'pipe' }).toString().trim();
    if (!status) {
      result.message = '无变更';
      return result;
    }

    // 分析变更
    const changes = status.split('\n').filter(l => l.trim());
    const changedFiles = changes.map(l => l.slice(3).trim());
    const summary = summarizeChanges(changedFiles);

    // Commit
    execSync('git add -A', { cwd: sharedDir, stdio: 'pipe' });
    execSync(`git commit -m "collab sync: ${summary} [${agentId || 'system'}]"`, { cwd: sharedDir, stdio: 'pipe' });
    result.committed = true;
    result.message = `已提交: ${summary}`;

    // Push（如果启用）
    if (push) {
      try {
        execSync('git push', { cwd: sharedDir, stdio: 'pipe' });
        result.pushed = true;
        result.message += ' + 已推送';
      } catch (e) {
        result.message += ' + 推送失败（无远程？）';
      }
    }

    return result;
  } catch (err) {
    return { success: false, message: `同步失败: ${err.message}` };
  }
}

/**
 * 显示 .shared/ 的 git 状态
 *
 * @param {string} sharedDir
 * @returns {{ clean: boolean, changes: string[], lastCommit: string }}
 */
export function gitStatus(sharedDir) {
  const gitDir = path.join(sharedDir, '.git');
  if (!fs.existsSync(gitDir)) {
    return { clean: false, changes: ['Git 未初始化'], lastCommit: '' };
  }

  try {
    const status = execSync('git status --porcelain', { cwd: sharedDir, stdio: 'pipe' }).toString().trim();
    const changes = status ? status.split('\n').filter(l => l.trim()) : [];

    let lastCommit = '';
    try {
      lastCommit = execSync('git log -1 --format="%h %s (%cr)"', { cwd: sharedDir, stdio: 'pipe' }).toString().trim();
    } catch (e) {
      // 无 commit
    }

    return {
      clean: changes.length === 0,
      changes: changes.map(l => l.trim()),
      lastCommit,
    };
  } catch (err) {
    return { clean: false, changes: [`Error: ${err.message}`], lastCommit: '' };
  }
}

/**
 * 格式化 git 状态
 */
export function formatGitStatus(status) {
  if (status.changes.includes('Git 未初始化')) {
    return '⚠️ Git 未初始化。运行 `collab git init`';
  }

  const lines = ['📦 Git 同步状态:', ''];

  if (status.lastCommit) {
    lines.push(`   最后提交: ${status.lastCommit}`);
  }

  if (status.clean) {
    lines.push('   ✅ 无未提交变更');
  } else {
    lines.push(`   ⚠️ ${status.changes.length} 个未提交变更:`);
    for (const change of status.changes.slice(0, 10)) {
      lines.push(`   ${change}`);
    }
    if (status.changes.length > 10) {
      lines.push(`   ... 还有 ${status.changes.length - 10} 个`);
    }
  }

  return lines.join('\n');
}

// ── 内部工具 ──

function summarizeChanges(files) {
  const categories = {
    shard: [],
    tasks: [],
    inbox: [],
    memory: [],
    other: [],
  };

  for (const f of files) {
    if (f.includes('SHARD')) categories.shard.push(f);
    else if (f.includes('tasks/')) categories.tasks.push(f);
    else if (f.includes('inbox/')) categories.inbox.push(f);
    else if (f.includes('memory/')) categories.memory.push(f);
    else categories.other.push(f);
  }

  const parts = [];
  if (categories.shard.length) parts.push('SHARD');
  if (categories.tasks.length) parts.push(`${categories.tasks.length} tasks`);
  if (categories.inbox.length) parts.push(`${categories.inbox.length} messages`);
  if (categories.memory.length) parts.push('memory');
  if (categories.other.length) parts.push(`${categories.other.length} files`);

  return parts.join(', ') || 'misc';
}
