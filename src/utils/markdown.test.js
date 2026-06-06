/**
 * markdown.test.js — markdown.js 单元测试
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTable, renderTable, countBodyLines, stripFrontmatter } from '../utils/markdown.js';

describe('parseTable', () => {
  it('should parse a simple table', () => {
    const text = [
      '| Name | Age |',
      '|------|-----|',
      '| Alice | 30 |',
      '| Bob | 25 |',
    ].join('\n');

    const result = parseTable(text);
    assert.equal(result.length, 2);
    assert.equal(result[0].Name, 'Alice');
    assert.equal(result[0].Age, '30');
    assert.equal(result[1].Name, 'Bob');
  });

  it('should return empty array for no table', () => {
    assert.deepEqual(parseTable('# No table here'), []);
  });
});

describe('renderTable', () => {
  it('should render objects to markdown table', () => {
    const result = renderTable(
      ['ID', 'Status'],
      [{ ID: 'T-001', Status: 'DONE' }, { ID: 'T-002', Status: 'OPEN' }]
    );

    assert.ok(result.includes('| ID | Status |'));
    assert.ok(result.includes('| T-001 | DONE |'));
    assert.ok(result.includes('| T-002 | OPEN |'));
  });
});

describe('countBodyLines', () => {
  it('should count lines excluding frontmatter', () => {
    const text = '---\nkey: value\n---\n\nLine 1\nLine 2\nLine 3\n';
    assert.equal(countBodyLines(text), 3);
  });

  it('should count all lines if no frontmatter', () => {
    const text = 'Line 1\nLine 2\n';
    assert.equal(countBodyLines(text), 2);
  });
});

describe('stripFrontmatter', () => {
  it('should remove frontmatter block', () => {
    const text = '---\nkey: value\n---\n\n# Title\n';
    const result = stripFrontmatter(text);
    assert.ok(!result.includes('key: value'));
    assert.ok(result.includes('# Title'));
  });

  it('should return original if no frontmatter', () => {
    const text = '# Title\n';
    assert.equal(stripFrontmatter(text), text);
  });
});
