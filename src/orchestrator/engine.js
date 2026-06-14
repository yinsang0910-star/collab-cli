/**
 * orchestrator.js — 编排器核心引擎
 *
 * 管理多个 agent 的生命周期，路由任务，执行 pipeline。
 *
 * 核心能力：
 * - 注册/管理多种 agent（Claude, Reasonix, Codex, Aider, WorkBuddy, 通用）
 * - 单步执行：collab run agent-id "prompt"
 * - 多步流水线：collab pipeline run P-001
 * - 异步执行 + 超时控制 + 错误重试
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import * as yaml from '../core/yaml.js';
import { now } from '../utils/timestamp.js';

/**
 * Agent 注册表
 */
const BUILTIN_ADAPTERS = {
  claude: 'ClaudeAdapter',
  reasonix: 'ReasonixAdapter',
  codex: 'CodexAdapter',
  aider: 'AiderAdapter',
  workbuddy: 'WorkBuddyAdapter',
  cursor: 'CursorAdapter',
  generic: 'GenericAdapter',
};

/**
 * 编排器类
 */
export class Orchestrator {
  constructor(sharedDir, config = {}) {
    this.sharedDir = sharedDir;
    this.projectRoot = path.dirname(sharedDir);
    this.config = config;
    this.agents = new Map();  // agentId → AgentInstance
    this.adapters = new Map(); // agentType → AdapterClass
    this.running = new Map();  // executionId → { process, promise }

    // 加载内置适配器
    this._loadBuiltinAdapters();

    // 加载配置
    this._loadConfig();
  }

  /**
   * 注册 agent
   */
  registerAgent(agentId, config) {
    const adapterType = config.type || 'generic';
    const AdapterClass = this.adapters.get(adapterType);
    if (!AdapterClass) {
      throw new Error(`Unknown adapter type: ${adapterType}`);
    }

    const adapter = new AdapterClass({
      agentId,
      projectRoot: this.projectRoot,
      sharedDir: this.sharedDir,
      ...config,
    });

    this.agents.set(agentId, {
      id: agentId,
      type: adapterType,
      adapter,
      status: 'idle',  // idle | busy | error
      config,
      lastUsed: null,
      sessionIds: {},   // taskId → sessionId（用于会话续接）
    });

    return this;
  }

  /**
   * 执行单步任务
   *
   * @param {string} agentId
   * @param {string} prompt
   * @param {Object} opts
   * @returns {Promise<{ success: boolean, output: string, duration: number }>}
   */
  async run(agentId, prompt, opts = {}) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { success: false, error: `Agent ${agentId} not registered` };
    }

    if (agent.status === 'busy' && !opts.force) {
      return { success: false, error: `Agent ${agentId} is busy` };
    }

    agent.status = 'busy';
    const startTime = Date.now();

    try {
      const result = await agent.adapter.execute(prompt, {
        sessionId: opts.sessionId || agent.sessionIds[opts.taskId],
        cwd: opts.cwd || this.projectRoot,
        timeout: opts.timeout || agent.config.timeout || 300000,
        model: opts.model,
      });

      // 保存 sessionId 用于续接
      if (result.sessionId) {
        agent.sessionIds[opts.taskId || 'default'] = result.sessionId;
      }

      agent.status = 'idle';
      agent.lastUsed = now();

      return {
        success: true,
        output: result.output,
        sessionId: result.sessionId,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      agent.status = 'error';
      setTimeout(() => { agent.status = 'idle'; }, 5000);

      return {
        success: false,
        error: err.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 执行流水线
   *
   * @param {Object} pipeline - 流水线定义
   * @returns {Promise<Object>}
   */
  async executePipeline(pipeline) {
    const executionId = `EX-${crypto.randomUUID().slice(0, 8)}`;
    const results = {};
    const logs = [];

    logs.push({ time: now(), event: 'pipeline_start', pipeline: pipeline.name });

    for (const step of pipeline.steps) {
      // 检查依赖
      if (step.depends_on) {
        const deps = step.depends_on.filter(d => !results[d]);
        if (deps.length > 0) {
          logs.push({ time: now(), event: 'step_skip', step: step.id, reason: `Missing dependencies: ${deps.join(', ')}` });
          continue;
        }
      }

      // 变量替换
      let prompt = step.prompt;
      if (step.depends_on) {
        for (const dep of step.depends_on) {
          prompt = prompt.replace(new RegExp(`\\{\\{${dep}\\}\\}`, 'g'), results[dep] || '');
        }
      }

      logs.push({ time: now(), event: 'step_start', step: step.id, agent: step.agent });

      const result = await this.run(step.agent, prompt, {
        taskId: step.id,
        timeout: step.timeout,
        model: step.model,
      });

      if (result.success) {
        results[step.id] = result.output;
        logs.push({
          time: now(),
          event: 'step_complete',
          step: step.id,
          duration: result.duration,
        });
      } else {
        results[step.id] = `ERROR: ${result.error}`;
        logs.push({
          time: now(),
          event: 'step_fail',
          step: step.id,
          error: result.error,
        });

        // 失败策略
        if (step.on_failure === 'abort') {
          logs.push({ time: now(), event: 'pipeline_abort', reason: `Step ${step.id} failed` });
          break;
        }
        // 默认继续
      }
    }

    // 需要用户确认
    if (pipeline.approval === 'user') {
      logs.push({ time: now(), event: 'awaiting_approval' });
    }

    logs.push({ time: now(), event: 'pipeline_complete', executionId });

    return {
      executionId,
      pipeline: pipeline.name,
      results,
      logs,
      needsApproval: pipeline.approval === 'user',
    };
  }

  /**
   * 获取 agent 状态
   */
  getAgentStatus() {
    const statuses = [];
    for (const [id, agent] of this.agents) {
      statuses.push({
        id,
        type: agent.type,
        status: agent.status,
        lastUsed: agent.lastUsed,
        config: { timeout: agent.config.timeout, model: agent.config.model },
      });
    }
    return statuses;
  }

  /**
   * 测试 agent 是否可用
   */
  async testAgent(agentId) {
    return this.run(agentId, 'Reply with exactly: "OK"', { timeout: 30000 });
  }

  // ── 内部方法 ──

  _loadBuiltinAdapters() {
    this.adapters.set('claude', ClaudeAdapter);
    this.adapters.set('reasonix', ReasonixAdapter);
    this.adapters.set('codex', CodexAdapter);
    this.adapters.set('aider', AiderAdapter);
    this.adapters.set('workbuddy', WorkBuddyAdapter);
    this.adapters.set('cursor', CursorAdapter);
    this.adapters.set('windsurf', WindsurfAdapter);
    this.adapters.set('devin', DevinAdapter);
    this.adapters.set('copilot', CopilotAdapter);
    this.adapters.set('continue', ContinueAdapter);
    this.adapters.set('generic', GenericAdapter);
  }

  _loadConfig() {
    const configPath = path.join(this.sharedDir, 'orchestrator.yaml');
    if (!fs.existsSync(configPath)) return;

    const { data } = yaml.safeRead(configPath);
    if (data.agents) {
      for (const [id, config] of Object.entries(data.agents)) {
        this.registerAgent(id, config);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Agent 适配器
// ═══════════════════════════════════════════════════════════════

/**
 * 适配器基类
 */
class BaseAdapter {
  constructor(config) {
    this.agentId = config.agentId;
    this.projectRoot = config.projectRoot;
    this.sharedDir = config.sharedDir;
    this.binary = config.binary;
    this.defaultArgs = config.defaultArgs || [];
    this.env = config.env || {};
  }

  async execute(prompt, opts = {}) {
    throw new Error('Subclass must implement execute()');
  }

  /**
   * 通用子进程执行器
   */
  _spawn(binary, args, opts = {}) {
    return new Promise((resolve, reject) => {
      const timeout = opts.timeout || 300000;
      let stdout = '';
      let stderr = '';
      let killed = false;

      const proc = spawn(binary, args, {
        cwd: opts.cwd || this.projectRoot,
        env: { ...process.env, ...this.env },
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        killed = true;
        proc.kill('SIGTERM');
      }, timeout);

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (killed) {
          reject(new Error(`Process timed out after ${timeout}ms`));
        } else if (code !== 0 && code !== null) {
          reject(new Error(`Process exited with code ${code}: ${stderr.slice(0, 500)}`));
        } else {
          resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}

/**
 * Claude Code 适配器
 *
 * 调用方式: claude -p "prompt" --output-format json
 * 特性: 支持会话续接 (--session-id)
 */
class ClaudeAdapter extends BaseAdapter {
  constructor(config) {
    super({ ...config, binary: config.binary || 'claude' });
  }

  async execute(prompt, opts = {}) {
    const args = ['-p', prompt, '--output-format', 'json'];

    if (opts.sessionId) {
      args.push('--session-id', opts.sessionId);
    }
    if (opts.model) {
      args.push('--model', opts.model);
    }

    args.push(...this.defaultArgs);

    const result = await this._spawn(this.binary, args, {
      cwd: opts.cwd,
      timeout: opts.timeout,
    });

    let output = result.stdout;
    let sessionId = opts.sessionId;

    // 尝试解析 JSON 响应
    try {
      const parsed = JSON.parse(result.stdout);
      output = parsed.result || parsed.content || parsed.text || result.stdout;
      sessionId = parsed.session_id || sessionId;
    } catch (e) {
      // 不是 JSON，直接用原始输出
    }

    return { output, sessionId };
  }
}

/**
 * Reasonix 适配器
 *
 * 调用方式: 通过 stdin pipe 输入 prompt
 * 特性: Go 二进制，支持 MCP 插件
 */
class ReasonixAdapter extends BaseAdapter {
  constructor(config) {
    super({ ...config, binary: config.binary || 'reasonix' });
  }

  async execute(prompt, opts = {}) {
    // Reasonix 通过 stdin 接收输入
    // 使用 spawn + stdin.write 的方式
    return new Promise((resolve, reject) => {
      const timeout = opts.timeout || 300000;
      let stdout = '';
      let stderr = '';

      const proc = spawn(this.binary, ['--non-interactive'], {
        cwd: opts.cwd || this.projectRoot,
        env: { ...process.env, ...this.env },
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`Reasonix timed out after ${timeout}ms`));
      }, timeout);

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      // 写入 prompt
      proc.stdin.write(prompt + '\n');
      proc.stdin.end();

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({ output: stdout.trim(), sessionId: null });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        // 如果 --non-interactive 不支持，尝试直接 pipe
        this._fallbackExecute(prompt, opts).then(resolve).catch(reject);
      });
    });
  }

  async _fallbackExecute(prompt, opts) {
    // 回退：写入临时文件，让 agent 读取
    const tmpFile = path.join(this.sharedDir, '.tmp-prompt.md');
    fs.writeFileSync(tmpFile, prompt, 'utf-8');

    const result = await this._spawn(this.binary, [tmpFile], {
      cwd: opts.cwd,
      timeout: opts.timeout,
    });

    try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
    return { output: result.stdout.trim(), sessionId: null };
  }
}

/**
 * Codex 适配器
 *
 * 调用方式: codex -p "prompt" 或 codex --prompt "prompt"
 */
class CodexAdapter extends BaseAdapter {
  constructor(config) {
    super({ ...config, binary: config.binary || 'codex' });
  }

  async execute(prompt, opts = {}) {
    const args = ['-p', prompt, '--quiet'];
    if (opts.model) args.push('--model', opts.model);
    args.push(...this.defaultArgs);

    const result = await this._spawn(this.binary, args, {
      cwd: opts.cwd,
      timeout: opts.timeout,
    });

    return { output: result.stdout.trim(), sessionId: null };
  }
}

/**
 * Aider 适配器
 *
 * 调用方式: aider --message "prompt" --yes --no-git
 * 特性: 支持多种 LLM 后端
 */
class AiderAdapter extends BaseAdapter {
  constructor(config) {
    super({ ...config, binary: config.binary || 'aider' });
  }

  async execute(prompt, opts = {}) {
    const args = [
      '--message', prompt,
      '--yes',           // 自动确认文件修改
      '--no-git',        // 不自动 git 操作（由 collab 管理）
      '--no-pretty',     // 纯文本输出
    ];

    if (opts.model) args.push('--model', opts.model);
    args.push(...this.defaultArgs);

    const result = await this._spawn(this.binary, args, {
      cwd: opts.cwd,
      timeout: opts.timeout,
    });

    return { output: result.stdout.trim(), sessionId: null };
  }
}

/**
 * WorkBuddy 适配器
 *
 * 调用方式: 通过文件系统（写入指令 → 轮询结果）
 * WorkBuddy 不支持 CLI 直接调用，使用文件桥接
 */
class WorkBuddyAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.pollInterval = config.pollInterval || 5000;  // 5 秒
    this.maxPolls = config.maxPolls || 60;             // 最多 5 分钟
  }

  async execute(prompt, opts = {}) {
    // 写入指令到 .shared/commands/
    const cmdDir = path.join(this.sharedDir, 'commands');
    if (!fs.existsSync(cmdDir)) fs.mkdirSync(cmdDir, { recursive: true });

    const cmdId = `CMD-${crypto.randomUUID().slice(0, 8)}`;
    const cmdPath = path.join(cmdDir, `${cmdId}.yaml`);

    const data = {
      id: cmdId,
      from: 'orchestrator',
      to: this.agentId,
      type: 'command',
      priority: 'P1',
      status: 'pending',
      created_at: now(),
    };

    yaml.write(cmdPath, data, `## 指令内容\n\n${prompt}\n\n## 执行结果\n\n_（由接收方填写）_`);

    // 轮询等待结果
    for (let i = 0; i < this.maxPolls; i++) {
      await new Promise(r => setTimeout(r, this.pollInterval));

      const { data: currentData, content } = yaml.safeRead(cmdPath);
      if (currentData.status === 'completed' || currentData.status === 'failed') {
        // 提取结果
        const resultMatch = content.match(/## 执行结果\n\n([\s\S]*?)(?=\n## |$)/);
        const output = resultMatch ? resultMatch[1].trim() : 'No result recorded';
        return {
          output: currentData.status === 'completed' ? output : `FAILED: ${output}`,
          sessionId: null,
        };
      }
    }

    return { output: `TIMEOUT: WorkBuddy did not respond within ${this.maxPolls * this.pollInterval / 1000}s`, sessionId: null };
  }
}

/**
 * Cursor 适配器
 *
 * Cursor 目前没有 CLI headless 模式
 * 使用文件桥接（类似 WorkBuddy）
 */
class CursorAdapter extends WorkBuddyAdapter {
  constructor(config) {
    super({ ...config, binary: config.binary || 'cursor' });
  }
}

/**
 * Windsurf 适配器
 *
 * Windsurf (Codeium) 是一个 AI 编程 IDE
 * CLI 模式: windsurf -p "prompt" 或通过扩展 API
 */
class WindsurfAdapter extends BaseAdapter {
  constructor(config) {
    super({ ...config, binary: config.binary || 'windsurf' });
  }

  async execute(prompt, opts = {}) {
    // Windsurf 支持类似 Claude Code 的 CLI 模式
    const args = ['-p', prompt, '--output-format', 'json'];
    if (opts.model) args.push('--model', opts.model);
    args.push(...this.defaultArgs);

    try {
      const result = await this._spawn(this.binary, args, {
        cwd: opts.cwd,
        timeout: opts.timeout,
      });

      let output = result.stdout;
      try {
        const parsed = JSON.parse(result.stdout);
        output = parsed.result || parsed.content || result.stdout;
      } catch (e) { /* not JSON */ }

      return { output: output.trim(), sessionId: null };
    } catch (err) {
      // 回退到文件桥接
      return this._fallbackFileBridge(prompt, opts);
    }
  }

  async _fallbackFileBridge(prompt, opts) {
    const tmpFile = path.join(this.sharedDir, '.tmp-prompt.md');
    fs.writeFileSync(tmpFile, prompt, 'utf-8');
    try {
      const result = await this._spawn(this.binary, [tmpFile], {
        cwd: opts.cwd,
        timeout: opts.timeout,
      });
      return { output: result.stdout.trim(), sessionId: null };
    } finally {
      try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
    }
  }
}

/**
 * Devin 适配器
 *
 * Devin 是一个自主 AI 软件工程师
 * 通过 API 或 CLI 交互
 */
class DevinAdapter extends WorkBuddyAdapter {
  constructor(config) {
    super({ ...config, binary: config.binary || 'devin' });
    this.apiUrl = config.apiUrl || null;
  }

  async execute(prompt, opts = {}) {
    // 如果配置了 API URL，使用 HTTP 调用
    if (this.apiUrl) {
      try {
        const response = await fetch(`${this.apiUrl}/api/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, cwd: opts.cwd }),
          signal: AbortSignal.timeout(opts.timeout || 300000),
        });
        const data = await response.json();
        return { output: data.result || data.output || '', sessionId: data.session_id };
      } catch (e) {
        // 回退到文件桥接
      }
    }
    // 回退：文件桥接
    return super.execute(prompt, opts);
  }
}

/**
 * GitHub Copilot CLI 适配器
 *
 * 调用方式: gh copilot -p "prompt" 或 copilot -p "prompt"
 */
class CopilotAdapter extends BaseAdapter {
  constructor(config) {
    super({ ...config, binary: config.binary || 'gh' });
  }

  async execute(prompt, opts = {}) {
    const args = ['copilot', '-p', prompt, '--output-format', 'json'];
    args.push(...this.defaultArgs);

    const result = await this._spawn(this.binary, args, {
      cwd: opts.cwd,
      timeout: opts.timeout,
    });

    let output = result.stdout;
    try {
      const parsed = JSON.parse(result.stdout);
      output = parsed.result || parsed.content || result.stdout;
    } catch (e) { /* not JSON */ }

    return { output: output.trim(), sessionId: null };
  }
}

/**
 * Continue 适配器
 *
 * Continue 是一个开源 AI 编程助手（VS Code / JetBrains 插件）
 * 通过 HTTP API 或 CLI 交互
 */
class ContinueAdapter extends BaseAdapter {
  constructor(config) {
    super({ ...config, binary: config.binary || 'continue' });
    this.apiUrl = config.apiUrl || 'http://localhost:6543';
  }

  async execute(prompt, opts = {}) {
    // Continue 通过本地 HTTP API 交互
    try {
      const response = await fetch(`${this.apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          stream: false,
        }),
        signal: AbortSignal.timeout(opts.timeout || 300000),
      });
      const data = await response.json();
      const output = data.choices?.[0]?.message?.content || '';
      return { output, sessionId: null };
    } catch (e) {
      return { output: `ERROR: Continue API not available at ${this.apiUrl}`, sessionId: null };
    }
  }
}

/**
 * 通用适配器
 *
 * 可配置的通用 CLI 调用
 * 适用于任何支持 "binary -p prompt" 模式的 agent
 */
class GenericAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.promptFlag = config.promptFlag || '-p';
    this.outputFlag = config.outputFlag || null;
  }

  async execute(prompt, opts = {}) {
    const args = [this.promptFlag, prompt];
    if (this.outputFlag) args.push(this.outputFlag);
    args.push(...this.defaultArgs);

    const result = await this._spawn(this.binary, args, {
      cwd: opts.cwd,
      timeout: opts.timeout,
    });

    return { output: result.stdout.trim(), sessionId: null };
  }
}
