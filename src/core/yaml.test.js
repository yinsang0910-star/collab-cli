/**
 * yaml.test.js — yaml.js 单元测试
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as yaml from '../core/yaml.js';

let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('yaml.read', () => {
  it('should parse frontmatter and body', () => {
    const filePath = path.join(tmpDir, 'test-read.md');
    fs.writeFileSync(filePath, '---\nname: test\nvalue: 42\n---\n\n# Hello\n\nWorld\n');

    const result = yaml.read(filePath);
    assert.equal(result.data.name, 'test');
    assert.equal(result.data.value, 42);
    assert.ok(result.content.includes('# Hello'));
    assert.ok(result.content.includes('World'));
  });

  it('should handle file without frontmatter', () => {
    const filePath = path.join(tmpDir, 'no-front.md');
    fs.writeFileSync(filePath, '# Just content\n');

    const result = yaml.read(filePath);
    assert.deepEqual(result.data, {});
    assert.ok(result.content.includes('# Just content'));
  });
});

describe('yaml.write', () => {
  it('should write frontmatter + body', () => {
    const filePath = path.join(tmpDir, 'test-write.md');
    yaml.write(filePath, { name: 'test', count: 5 }, '# Title\n\nBody text\n');

    const raw = fs.readFileSync(filePath, 'utf-8');
    assert.ok(raw.includes('name: test'));
    assert.ok(raw.includes('count: 5'));
    assert.ok(raw.includes('# Title'));
    assert.ok(raw.includes('Body text'));
  });

  it('should create directories if needed', () => {
    const filePath = path.join(tmpDir, 'nested', 'dir', 'file.md');
    yaml.write(filePath, { key: 'val' }, 'content');

    assert.ok(fs.existsSync(filePath));
    const result = yaml.read(filePath);
    assert.equal(result.data.key, 'val');
  });
});

describe('yaml.updateData', () => {
  it('should merge frontmatter while keeping body', () => {
    const filePath = path.join(tmpDir, 'test-update.md');
    yaml.write(filePath, { version: 1, status: 'open' }, '# Original body\n');

    yaml.updateData(filePath, { version: 2, status: 'closed' });

    const result = yaml.read(filePath);
    assert.equal(result.data.version, 2);
    assert.equal(result.data.status, 'closed');
    assert.ok(result.content.includes('# Original body'));
  });
});

describe('yaml.safeRead', () => {
  it('should return defaults for non-existent file', () => {
    const result = yaml.safeRead(path.join(tmpDir, 'nope.md'), { default: true });
    assert.equal(result.exists, false);
    assert.equal(result.data.default, true);
  });

  it('should return actual data for existing file', () => {
    const filePath = path.join(tmpDir, 'exists.md');
    yaml.write(filePath, { real: true }, 'content');

    const result = yaml.safeRead(filePath, { default: true });
    assert.equal(result.exists, true);
    assert.equal(result.data.real, true);
  });
});

describe('yaml.validate', () => {
  it('should pass when all fields present', () => {
    const { valid, missing } = yaml.validate({ a: 1, b: 2, c: 3 }, ['a', 'b']);
    assert.equal(valid, true);
    assert.deepEqual(missing, []);
  });

  it('should fail when fields missing', () => {
    const { valid, missing } = yaml.validate({ a: 1 }, ['a', 'b', 'c']);
    assert.equal(valid, false);
    assert.deepEqual(missing, ['b', 'c']);
  });
});
