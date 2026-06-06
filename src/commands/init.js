/**
 * init.js — collab init 命令
 *
 * 在当前项目的 .shared/ 目录初始化协作体系
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { now, today } from '../utils/timestamp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const REQUIRED_DIRS = ['inbox', 'tasks', 'memory', 'archive', 'conflicts'];

/**
 * 初始化协作体系
 *
 * @param {Object} opts
 * @param {string} opts.projectName - 项目名称
 * @param {string} opts.sharedDir - .shared/ 目录路径（默认: ./.shared）
 * @param {boolean} opts.migrate - 是否迁移现有 .shared/ 文件
 * @returns {{ success: boolean, created: string[], warnings: string[] }}
 */
export function init({ projectName, sharedDir, migrate = false }) {
  const dir = sharedDir || path.join(process.cwd(), '.shared');
  const created = [];
  const warnings = [];

  // 创建 .shared/ 目录
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    created.push(dir);
  }

  // 创建子目录
  for (const sub of REQUIRED_DIRS) {
    const subDir = path.join(dir, sub);
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
      created.push(subDir);
    }
  }

  // 创建 MANIFEST.md
  const manifestPath = path.join(dir, 'MANIFEST.md');
  if (!fs.existsSync(manifestPath)) {
    const template = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'MANIFEST.md'), 'utf-8'
    );
    const content = template
      .replace('{{PROJECT_NAME}}', projectName || 'Untitled Project')
      .replace('{{CREATED_DATE}}', today());
    fs.writeFileSync(manifestPath, content, 'utf-8');
    created.push(manifestPath);
  } else {
    warnings.push('MANIFEST.md 已存在，跳过创建');
  }

  // 创建 SHARD.md
  const shardPath = path.join(dir, 'SHARD.md');
  if (!fs.existsSync(shardPath)) {
    const template = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'SHARD.md'), 'utf-8'
    );
    const content = template.replace('{{CREATED_DATE}}', now());
    fs.writeFileSync(shardPath, content, 'utf-8');
    created.push(shardPath);
  } else {
    warnings.push('SHARD.md 已存在，跳过创建');
  }

  // 迁移现有文件（如果启用）
  if (migrate) {
    const migrated = migrateExisting(dir);
    created.push(...migrated);
  }

  return { success: true, created, warnings };
}

/**
 * 迁移现有 .shared/ 文件到新结构
 *
 * @param {string} dir - .shared/ 目录路径
 * @returns {string[]} 迁移的文件列表
 */
function migrateExisting(dir) {
  const migrated = [];

  // 迁移 CONTEXT.md → SHARD.md（如果 SHARD 不存在）
  const contextPath = path.join(dir, 'CONTEXT.md');
  const shardPath = path.join(dir, 'SHARD.md');
  if (fs.existsSync(contextPath) && !fs.existsSync(shardPath)) {
    const content = fs.readFileSync(contextPath, 'utf-8');
    fs.writeFileSync(shardPath, content, 'utf-8');
    migrated.push(`${contextPath} → ${shardPath}`);
  }

  // 迁移 DECISIONS.md → memory/decisions.md
  const decisionsPath = path.join(dir, 'DECISIONS.md');
  const memDecisionsPath = path.join(dir, 'memory', 'decisions.md');
  if (fs.existsSync(decisionsPath) && !fs.existsSync(memDecisionsPath)) {
    fs.copyFileSync(decisionsPath, memDecisionsPath);
    migrated.push(`${decisionsPath} → ${memDecisionsPath}`);
  }

  // 迁移 STRATEGY_INVENTORY.md → memory/architecture.md
  const strategyPath = path.join(dir, 'STRATEGY_INVENTORY.md');
  const memArchPath = path.join(dir, 'memory', 'architecture.md');
  if (fs.existsSync(strategyPath) && !fs.existsSync(memArchPath)) {
    fs.copyFileSync(strategyPath, memArchPath);
    migrated.push(`${strategyPath} → ${memArchPath}`);
  }

  // 迁移 TASKBOARD.md → tasks/ (拆分为单独任务)
  const taskboardPath = path.join(dir, 'TASKBOARD.md');
  if (fs.existsSync(taskboardPath)) {
    migrated.push(`${taskboardPath} → tasks/ (需手动拆分)`);
  }

  // 保留 inbox/ 结构不变
  const inboxDir = path.join(dir, 'inbox');
  if (fs.existsSync(inboxDir)) {
    migrated.push('inbox/ 结构保留不变');
  }

  return migrated;
}
