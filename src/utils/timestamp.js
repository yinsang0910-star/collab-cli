/**
 * timestamp.js — ISO 8601 时间戳工具
 *
 * 所有时间戳统一使用 ISO 8601 格式 + 时区偏移
 */

/**
 * 获取当前时间的 ISO 字符串（含时区）
 * @returns {string} e.g. "2026-06-06T14:30:00+08:00"
 */
export function now() {
  const iso = new Date().toISOString();
  // 去掉毫秒部分，保留 YYYY-MM-DDTHH:MM:SS
  const noMs = iso.replace(/\.\d{3}Z$/, '');
  return noMs + getTimezoneOffset();
}

/**
 * 获取当前日期字符串
 * @returns {string} e.g. "2026-06-06"
 */
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 生成会话 ID
 * @param {string} agentId
 * @returns {string} e.g. "s-20260606-143000-claude-01"
 */
export function sessionId(agentId) {
  const d = new Date();
  const ts = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    '-',
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join('');
  return `s-${ts}-${agentId}`;
}

/**
 * 计算两个时间戳之间的天数差
 * @param {string} isoTimestamp
 * @returns {number}
 */
export function daysSince(isoTimestamp) {
  const then = new Date(isoTimestamp);
  const now = new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

/**
 * 判断时间戳是否在指定天数内
 * @param {string} isoTimestamp
 * @param {number} days
 * @returns {boolean}
 */
export function isWithinDays(isoTimestamp, days) {
  return daysSince(isoTimestamp) <= days;
}

/**
 * 获取本地时区偏移字符串
 * @returns {string} e.g. "+08:00"
 */
function getTimezoneOffset() {
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}
