/**
 * i18n.js — CLI 多语言支持
 *
 * 支持语言: en (English), zh (中文), ja (日本語), ko (한국어)
 * 默认语言: 从环境变量 LANG 或 --lang 参数读取
 */

const LANGUAGES = ['en', 'zh', 'ja', 'ko'];

const MESSAGES = {
  // ── 通用 ──
  'init.success': {
    en: 'Collaboration system initialized',
    zh: '协作体系初始化完成',
    ja: 'コラボレーションシステム初期化完了',
    ko: '협업 시스템 초기화 완료',
  },
  'init.next_steps': {
    en: 'Next steps',
    zh: '下一步',
    ja: '次のステップ',
    ko: '다음 단계',
  },

  // ── 工牌 ──
  'badge.issued': {
    en: 'Badge issued',
    zh: '工牌已签发',
    ja: 'バッジ発行完了',
    ko: '배지 발급 완료',
  },
  'badge.not_found': {
    en: 'Badge not found',
    zh: '工牌不存在',
    ja: 'バッジが見つかりません',
    ko: '배지를 찾을 수 없음',
  },

  // ── 任务 ──
  'task.created': {
    en: 'Task created',
    zh: '任务已创建',
    ja: 'タスク作成完了',
    ko: '작업 생성 완료',
  },
  'task.no_tasks': {
    en: 'No tasks',
    zh: '暂无任务',
    ja: 'タスクなし',
    ko: '작업 없음',
  },
  'task.invalid_transition': {
    en: 'Invalid status transition',
    zh: '非法状态转换',
    ja: '無効なステータス遷移',
    ko: '잘못된 상태 전환',
  },

  // ── 消息 ──
  'inbox.sent': {
    en: 'Message sent',
    zh: '消息已发送',
    ja: 'メッセージ送信完了',
    ko: '메시지 전송 완료',
  },
  'inbox.no_unread': {
    en: 'No unread messages',
    zh: '无未读消息',
    ja: '未読メッセージなし',
    ko: '읽지 않은 메시지 없음',
  },
  'inbox.new_notification': {
    en: 'New message notification',
    zh: '新消息通知',
    ja: '新着メッセージ通知',
    ko: '새 메시지 알림',
  },

  // ── 握手 ──
  'handshake.complete': {
    en: 'Handshake complete',
    zh: '握手完成',
    ja: 'ハンドシェイク完了',
    ko: '핸드셰이크 완료',
  },
  'handshake.unread': {
    en: 'unread messages',
    zh: '未读消息',
    ja: '未読メッセージ',
    ko: '읽지 않은 메시지',
  },
  'handshake.active_tasks': {
    en: 'active tasks',
    zh: '活跃任务',
    ja: 'アクティブタスク',
    ko: '활성 작업',
  },

  // ── 记忆 ──
  'memory.compact.success': {
    en: 'Memory compacted',
    zh: '记忆压缩完成',
    ja: 'メモリ圧縮完了',
    ko: '메모리 압축 완료',
  },
  'memory.no_compact_needed': {
    en: 'All memory files within limits',
    zh: '所有记忆文件均在限制内',
    ja: 'すべてのメモリファイルが制限内',
    ko: '모든 메모리 파일이 제한 내',
  },

  // ── 冲突 ──
  'conflict.none': {
    en: 'No unresolved conflicts',
    zh: '无未解决冲突',
    ja: '未解決のコンフリクトなし',
    ko: '미해결 충돌 없음',
  },
  'conflict.resolved': {
    en: 'Conflict resolved',
    zh: '冲突已解决',
    ja: 'コンフリクト解決済み',
    ko: '충돌 해결됨',
  },

  // ── 编排器 ──
  'run.executing': {
    en: 'Executing',
    zh: '执行中',
    ja: '実行中',
    ko: '실행 중',
  },
  'run.success': {
    en: 'Completed',
    zh: '完成',
    ja: '完了',
    ko: '완료',
  },
  'run.failed': {
    en: 'Failed',
    zh: '失败',
    ja: '失敗',
    ko: '실패',
  },
  'pipeline.running': {
    en: 'Running pipeline',
    zh: '执行流水线',
    ja: 'パイプライン実行中',
    ko: '파이프라인 실행 중',
  },

  // ── 发现 ──
  'discover.none': {
    en: 'No agents detected',
    zh: '未检测到 agent',
    ja: 'エージェントが検出されません',
    ko: '에이전트가 감지되지 않음',
  },
  'discover.found': {
    en: 'Detected agents',
    zh: '检测到以下 agent',
    ja: '検出されたエージェント',
    ko: '감지된 에이전트',
  },

  // ── 错误 ──
  'error.permission_denied': {
    en: 'Permission denied',
    zh: '权限不足',
    ja: '権限がありません',
    ko: '권한이 없습니다',
  },
  'error.not_found': {
    en: 'Not found',
    zh: '未找到',
    ja: '見つかりません',
    ko: '찾을 수 없음',
  },
  'error.timeout': {
    en: 'Operation timed out',
    zh: '操作超时',
    ja: '操作がタイムアウトしました',
    ko: '작업 시간 초과',
  },
};

/**
 * 获取当前语言
 * @returns {string}
 */
export function getLang() {
  // 优先级: 环境变量 COLLAB_LANG > LANG > 默认 en
  const envLang = process.env.COLLAB_LANG || process.env.LANG || 'en';
  const short = envLang.slice(0, 2).toLowerCase();
  return LANGUAGES.includes(short) ? short : 'en';
}

/**
 * 翻译消息
 *
 * @param {string} key - 消息 key
 * @param {string} [lang] - 语言（默认自动检测）
 * @returns {string}
 */
export function t(key, lang) {
  const targetLang = lang || getLang();
  const msg = MESSAGES[key];
  if (!msg) return key;
  return msg[targetLang] || msg['en'] || key;
}

/**
 * 格式化握手摘要（多语言）
 */
export function formatHandshakeSummary({ role, unreadCount, activeTaskCount }, lang) {
  const l = lang || getLang();
  const parts = [];

  if (l === 'zh') {
    parts.push(`🪪 工牌: ${role}`);
    if (unreadCount > 0) parts.push(`📬 未读: ${unreadCount}条`);
    if (activeTaskCount > 0) parts.push(`📋 活跃任务: ${activeTaskCount}个`);
  } else if (l === 'ja') {
    parts.push(`🪪 バッジ: ${role}`);
    if (unreadCount > 0) parts.push(`📬 未読: ${unreadCount}件`);
    if (activeTaskCount > 0) parts.push(`📋 アクティブ: ${activeTaskCount}件`);
  } else if (l === 'ko') {
    parts.push(`🪪 배지: ${role}`);
    if (unreadCount > 0) parts.push(`📬 읽지 않음: ${unreadCount}건`);
    if (activeTaskCount > 0) parts.push(`📋 활성 작업: ${activeTaskCount}건`);
  } else {
    parts.push(`🪪 Badge: ${role}`);
    if (unreadCount > 0) parts.push(`📬 Unread: ${unreadCount}`);
    if (activeTaskCount > 0) parts.push(`📋 Active tasks: ${activeTaskCount}`);
  }

  return parts.join(' | ');
}
