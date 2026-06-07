/**
 * review.js — 自审查框架
 *
 * Agent 完成任务后，自动触发多维度审查。
 * 审查通过后才提交给用户最终确认。
 *
 * 审查流水线:
 * 1. Agent 完成任务
 * 2. 创建审查请求
 * 3. 审查 agent 自动检查（代码质量、测试、文档）
 * 4. 全部通过 → 提交用户
 *    有失败 → 打回重做 + 附带具体问题
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as yaml from '../core/yaml.js';
import * as taskCmd from './task.js';
import * as inboxCmd from './inbox.js';
import { now } from '../utils/timestamp.js';

/**
 * 创建审查请求
 *
 * @param {string} sharedDir
 * @param {Object} opts
 * @param {string} opts.taskId - 关联任务 ID
 * @param {string} opts.requestedBy - 请求审查的 agent
 * @param {string[]} opts.checks - 审查维度 ["code_quality", "test_coverage", "documentation"]
 * @param {string[]} opts.reviewers - 审查 agent 列表（可选，自动分配）
 * @returns {{ success: boolean, id?: string, path?: string, error?: string }}
 */
export function createReview(sharedDir, { taskId, requestedBy, checks, reviewers }) {
  if (!taskId) return { success: false, error: '缺少任务 ID' };
  if (!requestedBy) return { success: false, error: '缺少请求者' };

  const reviewDir = path.join(sharedDir, 'reviews');
  if (!fs.existsSync(reviewDir)) {
    fs.mkdirSync(reviewDir, { recursive: true });
  }

  const shortId = crypto.randomUUID().slice(0, 8);
  const reviewId = `RVW-${shortId}`;
  const filePath = path.join(reviewDir, `${reviewId}.yaml`);

  // 默认审查维度
  const defaultChecks = checks || ['code_quality', 'completeness'];
  const checkEntries = defaultChecks.map(c => ({
    name: c,
    reviewer: reviewers?.[defaultChecks.indexOf(c)] || null,
    status: 'pending',
    score: null,
    notes: null,
  }));

  const data = {
    id: reviewId,
    task_id: taskId,
    requested_by: requestedBy,
    status: 'in_progress',
    created_at: now(),
    checks_total: checkEntries.length,
    checks_passed: 0,
    checks_failed: 0,
  };

  const checkTable = [
    '| 维度 | 审查者 | 状态 | 分数 | 备注 |',
    '|------|--------|------|------|------|',
    ...checkEntries.map(c =>
      `| ${c.name} | ${c.reviewer || '待分配'} | ${c.status} | - | - |`
    ),
  ].join('\n');

  const content = [
    `# 审查: ${reviewId}`,
    `# 任务: ${taskId} | 请求者: ${requestedBy}`,
    '',
    '## 审查维度',
    '',
    checkTable,
    '',
    '## 审查意见',
    '',
    '_（由审查者填写）_',
    '',
    '## 综合结论',
    '',
    '_（待审查完成后自动填写）_',
    '',
  ].join('\n');

  yaml.write(filePath, data, content);

  // 自动分配审查者（如果有审查 agent）
  if (!reviewers) {
    autoAssignReviewers(sharedDir, reviewId, defaultChecks);
  }

  return { success: true, id: reviewId, path: filePath };
}

/**
 * 提交审查结果
 *
 * @param {string} sharedDir
 * @param {string} reviewId
 * @param {string} checkName - 审查维度
 * @param {Object} result
 * @param {string} result.reviewer - 审查者
 * @param {boolean} result.passed - 是否通过
 * @param {number} result.score - 评分 (0-100)
 * @param {string} result.notes - 审查意见
 * @returns {{ success: boolean, allDone?: boolean, error?: string }}
 */
export function submitCheck(sharedDir, reviewId, checkName, { reviewer, passed, score, notes }) {
  const filePath = findReviewFile(sharedDir, reviewId);
  if (!filePath) return { success: false, error: `审查 ${reviewId} 不存在` };

  const { data, content } = yaml.read(filePath);

  // 更新审查维度表
  const statusText = passed ? 'passed' : 'failed';
  const scoreText = score != null ? String(score) : '-';
  const notesText = notes || '-';

  // 替换表格中的对应行
  const rowRegex = new RegExp(`\\| ${checkName} \\|.*\\|.*\\|.*\\|.*\\|`);
  const newRow = `| ${checkName} | ${reviewer} | ${statusText} | ${scoreText} | ${notesText} |`;

  let newContent = content;
  if (content.match(rowRegex)) {
    newContent = content.replace(rowRegex, newRow);
  }

  // 更新统计
  if (passed) {
    data.checks_passed = (data.checks_passed || 0) + 1;
  } else {
    data.checks_failed = (data.checks_failed || 0) + 1;
  }

  // 检查是否全部完成
  const allDone = (data.checks_passed + data.checks_failed) >= data.checks_total;

  if (allDone) {
    data.status = data.checks_failed === 0 ? 'passed' : 'failed';
    data.completed_at = now();

    // 更新综合结论
    const conclusion = data.checks_failed === 0
      ? `✅ 全部通过 (${data.checks_passed}/${data.checks_total})`
      : `❌ ${data.checks_failed} 项未通过 (${data.checks_passed}/${data.checks_total})`;

    newContent = newContent.replace('_（待审查完成后自动填写）_', conclusion);
  }

  yaml.write(filePath, data, newContent);

  return { success: true, allDone, status: data.status };
}

/**
 * 获取审查状态
 *
 * @param {string} sharedDir
 * @param {string} reviewId
 * @returns {Object|null}
 */
export function getReview(sharedDir, reviewId) {
  const filePath = findReviewFile(sharedDir, reviewId);
  if (!filePath) return null;

  const { data, content } = yaml.read(filePath);
  return {
    ...data,
    checks: parseCheckTable(content),
    conclusion: extractSection(content, '综合结论'),
  };
}

/**
 * 获取任务关联的审查
 *
 * @param {string} sharedDir
 * @param {string} taskId
 * @returns {Object[]}
 */
export function getReviewsForTask(sharedDir, taskId) {
  const reviewDir = path.join(sharedDir, 'reviews');
  if (!fs.existsSync(reviewDir)) return [];

  const files = fs.readdirSync(reviewDir).filter(f => f.endsWith('.yaml'));
  const reviews = [];

  for (const file of files) {
    const { data } = yaml.safeRead(path.join(reviewDir, file));
    if (data.task_id === taskId) {
      reviews.push(data);
    }
  }

  return reviews;
}

/**
 * 格式化审查报告
 */
export function formatReview(review) {
  if (!review) return '审查不存在';

  const statusEmoji = {
    in_progress: '🔄',
    passed: '✅',
    failed: '❌',
  };

  const lines = [
    `${statusEmoji[review.status] || '?'} 审查 ${review.id}`,
    `   任务: ${review.task_id} | 请求者: ${review.requested_by}`,
    `   状态: ${review.status} | 通过: ${review.checks_passed}/${review.checks_total}`,
    '',
  ];

  if (review.checks && review.checks.length > 0) {
    lines.push('   审查维度:');
    for (const check of review.checks) {
      const emoji = check.status === 'passed' ? '✅' : check.status === 'failed' ? '❌' : '⏳';
      lines.push(`   ${emoji} ${check.name}: ${check.status} (${check.score || '-'}) ${check.notes || ''}`);
    }
  }

  if (review.conclusion) {
    lines.push('', `   结论: ${review.conclusion}`);
  }

  return lines.join('\n');
}

/**
 * 自动审查（无需其他 agent，自检清单模式）
 *
 * @param {string} sharedDir
 * @param {string} taskId
 * @param {string} agentId
 * @returns {{ passed: boolean, review: Object }}
 */
export function selfReview(sharedDir, taskId, agentId) {
  const review = createReview(sharedDir, {
    taskId,
    requestedBy: agentId,
    checks: ['completeness', 'self_check'],
  });

  if (!review.success) return { passed: false, error: review.error };

  // 读取任务详情
  const taskPath = findTaskFile(sharedDir, taskId);
  if (!taskPath) {
    submitCheck(sharedDir, review.id, 'completeness', {
      reviewer: agentId, passed: false, score: 0, notes: '任务文件不存在',
    });
    return { passed: false, review: getReview(sharedDir, review.id) };
  }

  const { data: taskData } = yaml.read(taskPath);

  // 检查 1: 任务状态是否合理
  const completenessPassed = taskData.status === 'IN_PROGRESS' || taskData.status === 'REVIEW';
  submitCheck(sharedDir, review.id, 'completeness', {
    reviewer: agentId,
    passed: completenessPassed,
    score: completenessPassed ? 80 : 40,
    notes: completenessPassed ? '任务状态合理' : `任务状态异常: ${taskData.status}`,
  });

  // 检查 2: 进度日志是否已更新
  const hasProgressLog = taskData.status === 'REVIEW' || taskData.status === 'DONE';
  const progressScore = hasProgressLog ? 80 : 50;
  submitCheck(sharedDir, review.id, 'self_check', {
    reviewer: agentId,
    passed: hasProgressLog,
    score: progressScore,
    notes: hasProgressLog ? '任务已提交审查' : '任务尚未提交审查（状态应为 REVIEW）',
  });

  const finalReview = getReview(sharedDir, review.id);
  return { passed: finalReview.status === 'passed', review: finalReview };
}

// ── 内部工具 ──

function autoAssignReviewers(sharedDir, reviewId, checks) {
  // 查找可用的审查 agent（L3+）
  const badgeDir = sharedDir;
  if (!fs.existsSync(badgeDir)) return;

  const badgeFiles = fs.readdirSync(badgeDir).filter(f => f.startsWith('BADGE-') && f.endsWith('.md'));
  const reviewers = [];

  for (const file of badgeFiles) {
    const { data } = yaml.safeRead(path.join(badgeDir, file));
    if (data.role && ['L3', 'L4'].includes(data.role)) {
      reviewers.push(data.agent_id);
    }
  }

  // 如果没有 L3+ 的 agent，不分配（自审模式）
  if (reviewers.length === 0) return;

  // 分配审查者到各维度
  // 这里简化处理：随机分配
  // 实际应该根据 agent 的能力来分配
}

function findReviewFile(sharedDir, reviewId) {
  const reviewDir = path.join(sharedDir, 'reviews');
  if (!fs.existsSync(reviewDir)) return null;

  const files = fs.readdirSync(reviewDir).filter(f => f.endsWith('.yaml'));

  for (const file of files) {
    if (file.includes(reviewId)) return path.join(reviewDir, file);

    const { data } = yaml.safeRead(path.join(reviewDir, file));
    if (data.id === reviewId) return path.join(reviewDir, file);
  }

  return null;
}

function findTaskFile(sharedDir, taskId) {
  const tasksDir = path.join(sharedDir, 'tasks');
  if (!fs.existsSync(tasksDir)) return null;

  const files = fs.readdirSync(tasksDir).filter(f => f.startsWith(taskId + '-'));
  return files.length > 0 ? path.join(tasksDir, files[0]) : null;
}

function parseCheckTable(content) {
  const lines = content.split('\n');
  const checks = [];
  let inTable = false;

  for (const line of lines) {
    if (line.includes('审查维度') && line.includes('|')) {
      inTable = true;
      continue;
    }
    if (inTable && line.includes('---')) continue;
    if (inTable && line.trim().startsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 3 && cells[0] !== '维度') {
        checks.push({
          name: cells[0],
          reviewer: cells[1],
          status: cells[2],
          score: cells[3] !== '-' ? parseInt(cells[3]) : null,
          notes: cells[4] !== '-' ? cells[4] : null,
        });
      }
    } else if (inTable && !line.trim().startsWith('|')) {
      inTable = false;
    }
  }

  return checks;
}

function extractSection(content, sectionName) {
  const regex = new RegExp(`## ${sectionName}\\n\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}
