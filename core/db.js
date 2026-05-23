/* ============================================================
   DATABASE — Dexie.js IndexedDB 封装
   所有表定义 + 通用 CRUD 方法
   ============================================================ */

/* ---- 全局数据库实例 ---- */
let db = null;

/* ---- 初始化数据库 ---- */
export async function initDB() {
  db = new Dexie('ShadowDB');

  /* ---- 表结构定义 ---- */
  db.version(1).stores({
    settings:'key',
    characters:     '++id, name, createdAt',
    channels:       '++id, type, updatedAt',
    messages:       '++id, channelId, createdAt, isSummarized',
    calendarEvents: '++id, date',
    forumBoards:    '++id, name',
    forumPosts:     '++id, boardId, createdAt',
    stickers:       '++id, category',
    knowledgeBooks: '++id',
    errorLogs:      '++id, timestamp, type'
  });

  await db.open();
  console.log('[DB] Database opened');
  return db;
}

/* ---- 获取数据库实例 ---- */
export function getDB() {
  return db;
}

/* ============================================================
   SETTINGS — 键值对存取
   ============================================================ */

/* ---- 读取设置 ---- */
export async function getSetting(key, defaultValue = null) {
  try {
    const row = await db.settings.get(key);
    return row ? row.value : defaultValue;
  } catch (err) {
    console.error(`[DB] getSetting(${key}) failed:`, err);
    return defaultValue;
  }
}

/* ---- 写入设置 ---- */
export async function setSetting(key, value) {
  try {
    await db.settings.put({ key, value });
  } catch (err) {
    console.error(`[DB] setSetting(${key}) failed:`, err);
  }
}

/* ---- 删除设置 ---- */
export async function deleteSetting(key) {
  try {
    await db.settings.delete(key);
  } catch (err) {
    console.error(`[DB] deleteSetting(${key}) failed:`, err);
  }
}

/* ============================================================
   ERROR LOGS — 错误日志存取
   ============================================================ */

/* ---- 写入错误日志 ---- */
export async function addErrorLog(logEntry) {
  try {
    await db.errorLogs.add(logEntry);
    /* 保留最多500条 */
    const count = await db.errorLogs.count();
    if (count > 500) {
      const oldest = await db.errorLogs.orderBy('timestamp').limit(count - 500).toArray();
      constidsToDelete = oldest.map(e => e.id);
      await db.errorLogs.bulkDelete(idsToDelete);
    }
  } catch (err) {
    /* 日志写入本身不能再抛错 */
  }
}

/* ---- 读取全部错误日志 ---- */
export async function getErrorLogs() {
  try {
    return await db.errorLogs.orderBy('timestamp').reverse().toArray();
  } catch (err) {
    return [];
  }
}

/* ---- 清空错误日志 ---- */
export async function clearErrorLogs() {
  try {
    await db.errorLogs.clear();
  } catch (err) {
    /* 静默 */
  }
}
