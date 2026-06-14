/**
 * discover.js — Agent 自动发现
 *
 * 扫描系统 PATH 和项目目录，自动检测已安装的 agent。
 *
 * 用法: collab discover
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * 已知 agent 的检测规则
 */
const AGENT_SIGNATURES = [
  {
    type: 'claude',
    name: 'Claude Code',
    detect: [
      { check: 'command', value: 'claude' },
      { check: 'file', value: '.claude/CLAUDE.md' },
      { check: 'file', value: '.claude/settings.json' },
    ],
    defaultRole: 'L4',
  },
  {
    type: 'reasonix',
    name: 'Reasonix',
    detect: [
      { check: 'command', value: 'reasonix' },
      { check: 'file', value: '.reasonix/system.md' },
      { check: 'file', value: 'reasonix.toml' },
    ],
    defaultRole: 'L2',
  },
  {
    type: 'codex',
    name: 'Codex',
    detect: [
      { check: 'command', value: 'codex' },
      { check: 'file', value: 'AGENTS.md' },
    ],
    defaultRole: 'L2',
  },
  {
    type: 'aider',
    name: 'Aider',
    detect: [
      { check: 'command', value: 'aider' },
      { check: 'file', value: '.aider.conf.yml' },
    ],
    defaultRole: 'L2',
  },
  {
    type: 'workbuddy',
    name: 'WorkBuddy',
    detect: [
      { check: 'file', value: '.workbuddy/MEMORY.md' },
      { check: 'dir', value: '.workbuddy' },
    ],
    defaultRole: 'L2',
  },
  {
    type: 'cursor',
    name: 'Cursor',
    detect: [
      { check: 'file', value: '.cursor/rules' },
      { check: 'dir', value: '.cursor' },
    ],
    defaultRole: 'L2',
  },
  {
    type: 'windsurf',
    name: 'Windsurf',
    detect: [
      { check: 'command', value: 'windsurf' },
      { check: 'file', value: '.windsurfrules' },
      { check: 'file', value: '.codeium/windsurf/memories' },
    ],
    defaultRole: 'L2',
  },
  {
    type: 'devin',
    name: 'Devin',
    detect: [
      { check: 'command', value: 'devin' },
      { check: 'file', value: '.devin/config.json' },
    ],
    defaultRole: 'L2',
  },
  {
    type: 'copilot',
    name: 'GitHub Copilot CLI',
    detect: [
      { check: 'command', value: 'gh copilot' },
    ],
    defaultRole: 'L1',
  },
  {
    type: 'continue',
    name: 'Continue',
    detect: [
      { check: 'file', value: '.continue/config.json' },
      { check: 'file', value: '.continue/config.yaml' },
    ],
    defaultRole: 'L1',
  },
];

/**
 * 扫描项目目录，检测已安装的 agent
 *
 * @param {string} projectRoot - 项目根目录
 * @returns {Object[]} 检测到的 agent 列表
 */
export function discoverAgents(projectRoot) {
  const discovered = [];

  for (const agent of AGENT_SIGNATURES) {
    const matches = [];
    let hasCommand = false;
    let hasFile = false;

    for (const sig of agent.detect) {
      switch (sig.check) {
        case 'command':
          if (isCommandAvailable(sig.value)) {
            matches.push(`命令 \`${sig.value}\` 可用`);
            hasCommand = true;
          }
          break;
        case 'file':
          if (fs.existsSync(path.join(projectRoot, sig.value))) {
            matches.push(`文件 ${sig.value} 存在`);
            hasFile = true;
          }
          break;
        case 'dir':
          if (fs.existsSync(path.join(projectRoot, sig.value))) {
            matches.push(`目录 ${sig.value} 存在`);
            hasFile = true;
          }
          break;
      }
    }

    if (matches.length > 0) {
      const confidence = hasCommand && hasFile ? 'high' : hasCommand || hasFile ? 'medium' : 'low';
      discovered.push({
        type: agent.type,
        name: agent.name,
        confidence,
        matches,
        suggestedId: `${agent.type}-01`,
        suggestedRole: agent.defaultRole,
      });
    }
  }

  return discovered;
}

/**
 * 格式化发现结果
 *
 * @param {Object[]} agents
 * @returns {string}
 */
export function formatDiscovery(agents) {
  if (agents.length === 0) {
    return '🔍 未检测到已安装的 agent。';
  }

  const lines = ['🔍 检测到以下 agent:', ''];

  for (const agent of agents) {
    const confEmoji = { high: '🟢', medium: '🟡', low: '🔴' }[agent.confidence];
    lines.push(`  ${confEmoji} ${agent.name} (${agent.type})`);
    lines.push(`     建议 ID: ${agent.suggestedId} | 建议角色: ${agent.suggestedRole}`);
    for (const match of agent.matches) {
      lines.push(`     ✓ ${match}`);
    }
    lines.push('');
  }

  lines.push('💡 使用以下命令签发工牌:');
  for (const agent of agents) {
    lines.push(`   collab badge issue ${agent.suggestedId} --role ${agent.suggestedRole} --assigned-by user`);
  }

  return lines.join('\n');
}

/**
 * 生成 orchestrator.yaml 配置建议
 *
 * @param {Object[]} agents
 * @returns {string}
 */
export function generateConfig(agents) {
  const lines = [
    '# 自动生成的编排器配置',
    `# 生成时间: ${new Date().toISOString()}`,
    '',
    'agents:',
  ];

  for (const agent of agents) {
    lines.push(`  ${agent.suggestedId}:`);
    lines.push(`    type: ${agent.type}`);
    lines.push(`    timeout: 300000`);
    if (agent.type === 'continue') {
      lines.push(`    api_url: "http://localhost:6543"`);
    }
    lines.push('');
  }

  lines.push('defaults:');
  lines.push('  working_directory: "."');
  lines.push('  timeout: 300000');
  lines.push('  approval_required: true');

  return lines.join('\n');
}

// ── 内部工具 ──

function isCommandAvailable(cmd) {
  try {
    const isWin = process.platform === 'win32';
    const checkCmd = isWin ? `where ${cmd}` : `which ${cmd}`;
    execSync(checkCmd, { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}
