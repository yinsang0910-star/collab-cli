/**
 * mcp-server.test.js — MCP Server 集成测试
 *
 * 测试 MCP JSON-RPC 协议的正确性
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tmpDir;
let sharedDir;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-mcp-test-'));
  sharedDir = path.join(tmpDir, '.shared');
  fs.mkdirSync(sharedDir, { recursive: true });

  // 初始化 .shared 结构
  const initModule = await import('../commands/init.js');
  initModule.init({ projectName: 'MCP Test', sharedDir });
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * 发送 JSON-RPC 请求到 MCP server 并获取响应
 */
function mcpRequest(server, method, params = {}, id = 1) {
  return new Promise((resolve, reject) => {
    const request = { jsonrpc: '2.0', id, method, params };
    let responseData = '';

    const onData = (chunk) => {
      responseData += chunk.toString();
      const lines = responseData.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        try {
          const response = JSON.parse(lines[lines.length - 1]);
          server.stdout.removeListener('data', onData);
          resolve(response);
        } catch (e) {
          // Not complete JSON yet, wait for more
        }
      }
    };

    server.stdout.on('data', onData);
    server.stdin.write(JSON.stringify(request) + '\n');

    setTimeout(() => {
      server.stdout.removeListener('data', onData);
      reject(new Error('MCP request timeout'));
    }, 5000);
  });
}

describe('MCP Server', () => {
  it('should respond to initialize', async () => {
    const server = spawn('node', [
      path.join(__dirname, 'mcp-server.js'),
      '--shared', sharedDir,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    try {
      const response = await mcpRequest(server, 'initialize', {}, 1);
      assert.equal(response.jsonrpc, '2.0');
      assert.equal(response.id, 1);
      assert.ok(response.result);
      assert.equal(response.result.protocolVersion, '2024-11-05');
      assert.ok(response.result.capabilities.tools);
      assert.equal(response.result.serverInfo.name, 'collab');
    } finally {
      server.kill();
    }
  });

  it('should list tools', async () => {
    const server = spawn('node', [
      path.join(__dirname, 'mcp-server.js'),
      '--shared', sharedDir,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    try {
      // Initialize first
      await mcpRequest(server, 'initialize', {}, 1);

      // List tools
      const response = await mcpRequest(server, 'tools/list', {}, 2);
      assert.ok(response.result.tools);
      assert.ok(response.result.tools.length > 0);

      const toolNames = response.result.tools.map(t => t.name);
      assert.ok(toolNames.includes('collab_status'));
      assert.ok(toolNames.includes('collab_handshake'));
      assert.ok(toolNames.includes('collab_inbox_check'));
      assert.ok(toolNames.includes('collab_inbox_send'));
      assert.ok(toolNames.includes('collab_task_create'));
      assert.ok(toolNames.includes('collab_task_list'));
    } finally {
      server.kill();
    }
  });

  it('should execute collab_status', async () => {
    const server = spawn('node', [
      path.join(__dirname, 'mcp-server.js'),
      '--shared', sharedDir,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    try {
      await mcpRequest(server, 'initialize', {}, 1);

      const response = await mcpRequest(server, 'tools/call', {
        name: 'collab_status',
        arguments: {},
      }, 3);

      assert.ok(response.result);
      assert.ok(response.result.content);
      assert.ok(response.result.content[0].text.includes('协作体系状态'));
    } finally {
      server.kill();
    }
  });

  it('should create and list tasks via MCP', async () => {
    const server = spawn('node', [
      path.join(__dirname, 'mcp-server.js'),
      '--shared', sharedDir,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    try {
      await mcpRequest(server, 'initialize', {}, 1);

      // Create task
      const createResp = await mcpRequest(server, 'tools/call', {
        name: 'collab_task_create',
        arguments: { title: 'MCP Test Task', priority: 'P0', assignee: 'agent-01' },
      }, 3);
      assert.ok(createResp.result.content[0].text.includes('T-'));

      // List tasks
      const listResp = await mcpRequest(server, 'tools/call', {
        name: 'collab_task_list',
        arguments: {},
      }, 4);
      assert.ok(listResp.result.content[0].text.includes('MCP Test Task'));
    } finally {
      server.kill();
    }
  });

  it('should send and check inbox via MCP', async () => {
    const server = spawn('node', [
      path.join(__dirname, 'mcp-server.js'),
      '--shared', sharedDir,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    try {
      await mcpRequest(server, 'initialize', {}, 1);

      // Send message
      const sendResp = await mcpRequest(server, 'tools/call', {
        name: 'collab_inbox_send',
        arguments: {
          from: 'agent-01',
          to: 'agent-02',
          title: 'MCP Test Message',
          priority: 'P1',
          body: 'This is a test message from MCP.',
        },
      }, 3);
      assert.ok(sendResp.result.content[0].text.includes('MSG-'));

      // Check inbox
      const checkResp = await mcpRequest(server, 'tools/call', {
        name: 'collab_inbox_check',
        arguments: { agent_id: 'agent-02' },
      }, 4);
      assert.ok(checkResp.result.content[0].text.includes('MCP Test Message'));
    } finally {
      server.kill();
    }
  });
});
