/**
 * pipeline.js — 流水线引擎
 *
 * 定义和执行多步工作流：
 * - YAML 定义流水线
 * - 步骤间变量传递
 * - 依赖关系管理
 * - 用户审批门控
 * - 错误处理策略
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as yaml from '../core/yaml.js';
import { now } from '../utils/timestamp.js';

/**
 * 加载流水线定义
 *
 * @param {string} sharedDir
 * @param {string} pipelineId
 * @returns {Object|null}
 */
export function loadPipeline(sharedDir, pipelineId) {
  const filePath = findPipelineFile(sharedDir, pipelineId);
  if (!filePath) return null;

  const { data, content } = yaml.read(filePath);
  const steps = parseSteps(content);

  return {
    ...data,
    steps,
    filePath,
  };
}

/**
 * 列出所有流水线
 */
export function listPipelines(sharedDir) {
  const pipeDir = path.join(sharedDir, 'pipelines');
  if (!fs.existsSync(pipeDir)) return [];

  const files = fs.readdirSync(pipeDir).filter(f => f.endsWith('.yaml'));
  return files.map(f => {
    const { data } = yaml.safeRead(path.join(pipeDir, f));
    return {
      id: data.id || f.replace('.yaml', ''),
      name: data.name || 'Untitled',
      trigger: data.trigger || 'manual',
      steps: data.steps_count || 0,
      status: data.last_status || 'idle',
    };
  });
}

/**
 * 创建流水线
 *
 * @param {string} sharedDir
 * @param {Object} definition
 * @returns {{ success: boolean, id?: string, path?: string }}
 */
export function createPipeline(sharedDir, definition) {
  const pipeDir = path.join(sharedDir, 'pipelines');
  if (!fs.existsSync(pipeDir)) {
    fs.mkdirSync(pipeDir, { recursive: true });
  }

  const shortId = crypto.randomUUID().slice(0, 8);
  const pipeId = definition.id || `P-${shortId}`;
  const filePath = path.join(pipeDir, `${pipeId}.yaml`);

  const data = {
    id: pipeId,
    name: definition.name || 'Untitled Pipeline',
    trigger: definition.trigger || 'manual',
    approval: definition.approval || 'user',
    steps_count: definition.steps.length,
    created_at: now(),
    last_status: 'idle',
  };

  const stepsMarkdown = definition.steps.map((step, i) => {
    const lines = [`### Step ${i + 1}: ${step.id}`];
    lines.push(`- **Agent**: ${step.agent}`);
    if (step.depends_on) lines.push(`- **依赖**: ${step.depends_on.join(', ')}`);
    if (step.on_failure) lines.push(`- **失败策略**: ${step.on_failure}`);
    lines.push('');
    lines.push('```');
    lines.push(step.prompt);
    lines.push('```');
    lines.push('');
    return lines.join('\n');
  }).join('\n');

  const content = [
    '# 流水线定义',
    '',
    stepsMarkdown,
    '---',
    '',
    '## 审批',
    '',
    `需要用户确认: ${definition.approval === 'user' ? '是' : '否'}`,
    '',
  ].join('\n');

  yaml.write(filePath, data, content);

  return { success: true, id: pipeId, path: filePath };
}

/**
 * 更新流水线执行状态
 */
export function updatePipelineStatus(sharedDir, pipelineId, status, executionId) {
  const filePath = findPipelineFile(sharedDir, pipelineId);
  if (!filePath) return;

  yaml.updateData(filePath, {
    last_status: status,
    last_execution: executionId,
    last_run_at: now(),
  });
}

/**
 * 格式化流水线列表
 */
export function formatPipelineList(pipelines) {
  if (pipelines.length === 0) return '📋 无流水线';

  const lines = ['📋 流水线列表:', ''];
  lines.push('| ID | 名称 | 触发方式 | 步骤数 | 状态 |');
  lines.push('|----|------|----------|--------|------|');

  for (const p of pipelines) {
    lines.push(`| ${p.id} | ${p.name} | ${p.trigger} | ${p.steps} | ${p.status} |`);
  }

  return lines.join('\n');
}

/**
 * 从 YAML 文件解析步骤
 */
function parseSteps(content) {
  const steps = [];
  const stepRegex = /### Step \d+: (.+)\n([\s\S]*?)(?=### Step|$)/g;
  let match;

  while ((match = stepRegex.exec(content)) !== null) {
    const stepId = match[1].trim();
    const stepContent = match[2];

    const agentMatch = stepContent.match(/\*\*Agent\*\*:\s*(.+)/);
    const dependsMatch = stepContent.match(/\*\*依赖\*\*:\s*(.+)/);
    const failureMatch = stepContent.match(/\*\*失败策略\*\*:\s*(.+)/);
    const promptMatch = stepContent.match(/```\n([\s\S]*?)\n```/);

    steps.push({
      id: stepId,
      agent: agentMatch ? agentMatch[1].trim() : null,
      depends_on: dependsMatch ? dependsMatch[1].split(',').map(d => d.trim()) : [],
      on_failure: failureMatch ? failureMatch[1].trim() : 'continue',
      prompt: promptMatch ? promptMatch[1].trim() : '',
    });
  }

  return steps;
}

function findPipelineFile(sharedDir, pipelineId) {
  const pipeDir = path.join(sharedDir, 'pipelines');
  if (!fs.existsSync(pipeDir)) return null;

  const files = fs.readdirSync(pipeDir).filter(f => f.endsWith('.yaml'));

  for (const file of files) {
    if (file.includes(pipelineId)) return path.join(pipeDir, file);

    const { data } = yaml.safeRead(path.join(pipeDir, file));
    if (data.id === pipelineId) return path.join(pipeDir, file);
  }

  return null;
}
