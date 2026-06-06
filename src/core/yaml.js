/**
 * yaml.js — Frontmatter 解析/写入封装
 *
 * 基于 gray-matter，提供简洁的读写接口
 */

import matter from 'gray-matter';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 读取文件并解析 frontmatter
 * @param {string} filePath - 绝对路径
 * @returns {{ data: Object, content: string, raw: string }}
 *   data: YAML frontmatter 对象
 *   content: Markdown body（不含 frontmatter）
 *   raw: 原始完整文本
 */
export function read(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  return {
    data: parsed.data,
    content: parsed.content.trimStart(),
    raw,
  };
}

/**
 * 写入文件（frontmatter + body）
 * @param {string} filePath
 * @param {Object} data - frontmatter 对象
 * @param {string} content - Markdown body
 */
export function write(filePath, data, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const output = matter.stringify(`\n${content}`, data);
  fs.writeFileSync(filePath, output, 'utf-8');
}

/**
 * 仅更新 frontmatter（保留 body 不变）
 * @param {string} filePath
 * @param {Object} patch - 要合并的字段
 */
export function updateData(filePath, patch) {
  const { data, content } = read(filePath);
  write(filePath, { ...data, ...patch }, content);
}

/**
 * 安全读取——文件不存在时返回默认值
 * @param {string} filePath
 * @param {Object} defaults - data 的默认值
 * @returns {{ data: Object, content: string, exists: boolean }}
 */
export function safeRead(filePath, defaults = {}) {
  if (!fs.existsSync(filePath)) {
    return { data: defaults, content: '', exists: false };
  }
  const { data, content } = read(filePath);
  return { data: { ...defaults, ...data }, content, exists: true };
}

/**
 * 检查 frontmatter 中是否包含必需字段
 * @param {Object} data
 * @param {string[]} required
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validate(data, required) {
  const missing = required.filter(f => data[f] === undefined || data[f] === null);
  return { valid: missing.length === 0, missing };
}
