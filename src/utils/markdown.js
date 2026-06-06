/**
 * markdown.js — Markdown 表格解析/生成工具
 */

/**
 * 解析 Markdown 表格为对象数组
 * @param {string} text - 包含表格的 Markdown 文本
 * @returns {Array<Object>}
 */
export function parseTable(text) {
  const lines = text.split('\n');
  const tableStart = lines.findIndex(l => l.trim().startsWith('|'));
  if (tableStart === -1) return [];

  const headerLine = lines[tableStart];
  const headers = splitTableRow(headerLine);

  // 跳过分隔线 (|---|---|)
  const dataStart = tableStart + 2;
  const rows = [];

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;
    const cells = splitTableRow(line);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] || '').trim();
    });
    rows.push(obj);
  }

  return rows;
}

/**
 * 将对象数组渲染为 Markdown 表格
 * @param {string[]} headers
 * @param {Array<Object>} rows
 * @returns {string}
 */
export function renderTable(headers, rows) {
  const headerLine = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataLines = rows.map(row =>
    `| ${headers.map(h => row[h] ?? '').join(' | ')} |`
  );
  return [headerLine, separator, ...dataLines].join('\n');
}

/**
 * 统计文本行数（去除 frontmatter）
 * @param {string} text
 * @returns {number}
 */
export function countBodyLines(text) {
  const body = stripFrontmatter(text);
  return body.split('\n').filter(l => l.trim()).length;
}

/**
 * 去除 YAML frontmatter，返回 Markdown body
 * @param {string} text
 * @returns {string}
 */
export function stripFrontmatter(text) {
  const match = text.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1].trimStart() : text;
}

// ── 内部工具 ──

function splitTableRow(line) {
  return line
    .split('|')
    .slice(1, -1) // 去掉首尾空元素
    .map(cell => cell.trim());
}
