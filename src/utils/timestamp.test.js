/**
 * timestamp.test.js — timestamp.js 单元测试
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { now, today, sessionId, daysSince, isWithinDays } from '../utils/timestamp.js';

describe('now()', () => {
  it('should return ISO 8601 string with timezone', () => {
    const result = now();
    assert.ok(result.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/),
      `Expected ISO format, got: ${result}`);
  });
});

describe('today()', () => {
  it('should return YYYY-MM-DD format', () => {
    const result = today();
    assert.ok(result.match(/^\d{4}-\d{2}-\d{2}$/));
  });

  it('should match current date', () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    assert.equal(today(), expected);
  });
});

describe('sessionId()', () => {
  it('should contain agent id', () => {
    const result = sessionId('claude-01');
    assert.ok(result.includes('claude-01'));
  });

  it('should start with s-', () => {
    const result = sessionId('test');
    assert.ok(result.startsWith('s-'));
  });
});

describe('daysSince()', () => {
  it('should return 0 for today', () => {
    const todayIso = new Date().toISOString();
    assert.equal(daysSince(todayIso), 0);
  });

  it('should return ~1 for yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    assert.equal(daysSince(yesterday), 1);
  });
});

describe('isWithinDays()', () => {
  it('should return true for recent timestamp', () => {
    assert.equal(isWithinDays(now(), 3), true);
  });

  it('should return false for old timestamp', () => {
    assert.equal(isWithinDays('2020-01-01T00:00:00+00:00', 3), false);
  });
});
