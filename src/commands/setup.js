/**
 * setup.js — collab setup 交互式引导
 *
 * 引导用户完成协作体系的初始化，根据设备数量选择不同方案。
 *
 * 用法:
 *   collab setup
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as initCmd from './init.js';
import * as badgeCmd from './badge.js';
import { now } from '../utils/timestamp.js';

/**
 * 运行交互式引导
 *
 * @param {string} sharedDir - .shared/ 目录路径
 * @param {Object} answers - 预填答案（用于非交互模式）
 * @returns {SetupResult}
 *
 * @typedef {Object} SetupResult
 * @property {string} mode - 'single' | 'multi'
 * @property {Object[]} agents - agent 列表
 * @property {string} masterDevice - 主设备 ID
 * @property {string[]} instructions - 每台设备的启动指令
 */
export function setup(sharedDir, answers = {}) {
  const result = {
    mode: 'single',
    agents: [],
    masterDevice: null,
    instructions: [],
    files: [],
  };

  // ── Q1: 设备数量 ──
  const deviceCount = answers.devices || 1;

  if (deviceCount === 1) {
    // ── 单机模式 ──
    result.mode = 'single';

    // 初始化 .shared/
    const initResult = initCmd.init({
      projectName: answers.project || 'My Project',
      sharedDir,
    });
    result.files.push(...initResult.created);

    // 签发工牌
    const agents = answers.agents || [
      { id: 'claude-01', type: 'Claude Code', role: 'L4' },
    ];

    for (const agent of agents) {
      badgeCmd.issue(sharedDir, {
        agentId: agent.id,
        role: agent.role,
        assignedBy: 'user',
      });
      result.agents.push(agent);
    }

    // 写入 MANIFEST
    updateManifest(sharedDir, agents);

    // 生成指令
    result.instructions = generateSingleDeviceInstructions(sharedDir, agents);

  } else {
    // ── 多机模式 ──
    result.mode = 'multi';

    // 初始化 .shared/
    const initResult = initCmd.init({
      projectName: answers.project || 'My Project',
      sharedDir,
    });
    result.files.push(...initResult.created);

    // 收集设备信息
    const devices = answers.devices_list || [
      { name: '设备 A', agents: [{ id: 'codex-1', type: 'Codex', role: 'L4' }] },
      { name: '设备 B', agents: [{ id: 'codex-2', type: 'Codex', role: 'L2' }] },
    ];

    // 主设备 = 第一个有 L4 agent 的设备
    const masterDevice = devices.find(d => d.agents.some(a => a.role === 'L4'));
    result.masterDevice = masterDevice?.name || devices[0].name;

    // 签发所有工牌
    for (const device of devices) {
      for (const agent of device.agents) {
        badgeCmd.issue(sharedDir, {
          agentId: agent.id,
          role: agent.role,
          assignedBy: 'user',
        });
        result.agents.push({ ...agent, device: device.name });
      }
    }

    // 写入 MANIFEST
    const allAgents = devices.flatMap(d => d.agents);
    updateManifest(sharedDir, allAgents);

    // 写入 peers.yaml（多机配置）
    const token = crypto.randomBytes(16).toString('hex');
    writePeersConfig(sharedDir, devices, token);
    result.files.push(path.join(sharedDir, 'peers.yaml'));

    // 生成每台设备的指令
    result.instructions = generateMultiDeviceInstructions(sharedDir, devices, token);
  }

  return result;
}

/**
 * 格式化 setup 结果为可读文本
 *
 * @param {SetupResult} result
 * @returns {string}
 */
export function formatSetupResult(result) {
  const lines = [];

  lines.push('');
  lines.push('🚀 协作体系设置完成');
  lines.push('═'.repeat(50));

  // 项目信息
  lines.push(`\n📋 模式: ${result.mode === 'single' ? '单机' : '多机'}`);

  // Agent 列表
  lines.push(`\n🪪 Agent 注册表:`);
  for (const agent of result.agents) {
    const device = agent.device ? ` (${agent.device})` : '';
    lines.push(`   ${agent.id}: ${agent.role} ${agent.type}${device}`);
  }

  if (result.masterDevice) {
    lines.push(`\n👑 主设备: ${result.masterDevice}（总工所在设备，SHARD 源头）`);
  }

  // 文件列表
  if (result.files.length > 0) {
    lines.push(`\n📁 创建的文件:`);
    for (const f of result.files) {
      lines.push(`   ✅ ${f}`);
    }
  }

  // 启动指令
  lines.push(`\n${'─'.repeat(50)}`);
  lines.push('📌 接下来请按以下步骤操作:');
  lines.push('');

  for (const instruction of result.instructions) {
    lines.push(instruction);
  }

  lines.push('');
  lines.push('═'.repeat(50));

  return lines.join('\n');
}

// ── 内部工具 ──

function updateManifest(sharedDir, agents) {
  const manifestPath = path.join(sharedDir, 'MANIFEST.md');
  if (!fs.existsSync(manifestPath)) return;

  const { data, content } = readYaml(manifestPath);

  // 构建 agent 注册表
  const tableRows = agents.map(a =>
    `| ${a.id} | ${a.type} | ${a.role === 'L4' ? '总工' : a.role === 'L3' ? '审查者' : a.role === 'L2' ? '贡献者' : '执行者'} | ${a.role} | |`
  ).join('\n');

  const newContent = content.replace(
    /\| Agent ID.*\|.*\|.*\|.*\|.*\|\n(\|[-| ]+\|\n)?/,
    `| Agent ID | 类型 | 默认角色 | 最高级别 | 备注 |\n|----------|------|----------|----------|------|\n${tableRows}\n`
  );

  writeYaml(manifestPath, data, newContent);
}

function writePeersConfig(sharedDir, devices, token) {
  const peersPath = path.join(sharedDir, 'peers.yaml');

  const lines = [
    `# collab 节点配置 — 自动生成于 ${now()}`,
    `# 每台设备运行 collab node start 时使用此配置`,
    '',
    `token: "${token}"`,
    `port: 9527`,
    '',
    'nodes:',
  ];

  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];
    const agentIds = device.agents.map(a => a.id).join(', ');
    lines.push(`  - name: "${device.name}"`);
    lines.push(`    # host: 192.168.1.${100 + i}  # ← 填入实际 IP`);
    lines.push(`    agents: [${agentIds}]`);
    lines.push('');
  }

  fs.writeFileSync(peersPath, lines.join('\n'), 'utf-8');
}

function generateSingleDeviceInstructions(sharedDir, agents) {
  const lines = [];
  let step = 1;

  lines.push(`   ${step++}. 在项目根目录创建指令文件，让 agent 自动握手:`);

  for (const agent of agents) {
    if (agent.type === 'Claude Code') {
      lines.push(`\n      # Claude Code`);
      lines.push(`      mkdir -p .claude`);
      lines.push(`      cat node_modules/collab-cli/src/templates/CLAUDE_PROTOCOL.md >> .claude/CLAUDE.md`);
    } else if (agent.type === 'Reasonix') {
      lines.push(`\n      # Reasonix`);
      lines.push(`      mkdir -p .reasonix`);
      lines.push(`      cp node_modules/collab-cli/src/templates/REASONIX_PROTOCOL.md .reasonix/system.md`);
    } else if (agent.type === 'Codex') {
      lines.push(`\n      # Codex`);
      lines.push(`      cp node_modules/collab-cli/src/templates/CODEX_PROTOCOL.md ./AGENTS.md`);
    } else if (agent.type === 'WorkBuddy') {
      lines.push(`\n      # WorkBuddy`);
      lines.push(`      # 在 .workbuddy/memory/MEMORY.md 末尾追加协作协议`);
    }
  }

  lines.push(`\n   ${step++}. 打开 agent，它会自动执行握手:`);
  lines.push(`      collab handshake ${agents[0].id}`);
  lines.push(`\n   ${step++}. 开始协作:`);
  lines.push(`      collab task create "你的第一个任务" --assignee ${agents[0].id} --priority P0`);
  lines.push(`      collab status`);

  return lines;
}

function generateMultiDeviceInstructions(sharedDir, devices, token) {
  const lines = [];
  let step = 1;

  lines.push(`   ${step++}. 📁 项目文件同步方式（选一个）:`);
  lines.push('');
  lines.push(`      方案 A: Git 同步（推荐）`);
  lines.push(`         - 把项目放在 git 仓库里`);
  lines.push(`         - 每台设备 git clone 同一个仓库`);
  lines.push(`         - .shared/ 目录会在仓库里同步`);
  lines.push(`         - collab 会自动处理冲突（乐观锁）`);
  lines.push('');
  lines.push(`      方案 B: 网络共享文件夹`);
  lines.push(`         - 把 .shared/ 放在 SMB/NFS/OneDrive 共享目录`);
  lines.push(`         - 所有设备指向同一个 .shared/ 路径`);
  lines.push('');
  lines.push(`      方案 C: LAN 节点直连（实时通信）`);
  lines.push(`         - 每台设备本地维护 .shared/`);
  lines.push(`         - inbox 消息通过 HTTP 实时推送`);
  lines.push(`         - SHARD/tasks 需要手动或定时同步`);

  lines.push(`\n   ${step++}. 🔗 每台设备的启动指令:`);

  for (const device of devices) {
    const agentIds = device.agents.map(a => a.id).join(',');
    const isMaster = device.agents.some(a => a.role === 'L4');

    lines.push(`\n   ┌─ ${device.name}${isMaster ? ' 👑 主设备' : ''} ──────────────────────`);
    lines.push(`   │`);
    lines.push(`   │  # 1. 启动 LAN 节点`);
    lines.push(`   │  collab node start --agents ${agentIds} --token ${token}`);
    lines.push(`   │`);
    lines.push(`   │  # 2. 配置 agent 指令文件`);

    for (const agent of device.agents) {
      if (agent.type === 'Claude Code') {
        lines.push(`   │  #    Claude: cat templates/CLAUDE_PROTOCOL.md >> .claude/CLAUDE.md`);
      } else if (agent.type === 'Codex') {
        lines.push(`   │  #    Codex: cp templates/CODEX_PROTOCOL.md ./AGENTS.md`);
      } else if (agent.type === 'Reasonix') {
        lines.push(`   │  #    Reasonix: cp templates/REASONIX_PROTOCOL.md .reasonix/system.md`);
      } else if (agent.type === 'WorkBuddy') {
        lines.push(`   │  #    WorkBuddy: 追加到 .workbuddy/memory/MEMORY.md`);
      }
    }

    lines.push(`   │`);
    lines.push(`   │  # 3. 验证连接`);
    lines.push(`   │  collab node status`);
    lines.push(`   │`);
    lines.push(`   └──────────────────────────────────────`);
  }

  lines.push(`\n   ${step++}. 🎯 使用方式:`);
  lines.push('');
  lines.push(`      # 跨设备发消息（自动路由到远程设备）`);
  lines.push(`      collab inbox send --from ${devices[0].agents[0].id} --to ${devices[devices.length - 1].agents[0].id} --title "你好" --priority P1`);
  lines.push('');
  lines.push(`      # 创建任务`);
  lines.push(`      collab task create "跨设备任务" --assignee ${devices[devices.length - 1].agents[0].id} --priority P0`);
  lines.push('');
  lines.push(`      # 查看全局状态`);
  lines.push(`      collab status`);

  return lines;
}

// ── YAML 工具（简化版，避免循环依赖） ──

function readYaml(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const data = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) data[m[1]] = m[2].replace(/"/g, '');
  }

  return { data, content: match[2] };
}

function writeYaml(filePath, data, content) {
  const front = Object.entries(data).map(([k, v]) => `${k}: "${v}"`).join('\n');
  fs.writeFileSync(filePath, `---\n${front}\n---\n${content}`, 'utf-8');
}
