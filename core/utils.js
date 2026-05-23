/* ============================================================
   UTILS — 工具函数
   Toast / Loading / 确认弹窗 / 错误日志 / 通用辅助
   ============================================================ */

import { addErrorLog, getErrorLogs, clearErrorLogs } from './db.js';

/* ============================================================
   TOAST — 顶部提示
   ============================================================ */

let toastTimer = null;

/* ---- 显示 Toast ---- */
export function showToast(message, type = 'info', duration = 2500) {
  const container = document.getElementById('layer-toast');
  if (!container) return;

  /* 移除旧的 */
  const old = container.querySelector('.toast');
  if (old) {
    old.remove();
    clearTimeout(toastTimer);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  /* 触发动画 */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('show');});
  });

  /* 自动消失 */
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ============================================================
   CONFIRM — iOS风格确认弹窗
   ============================================================ */

/* ---- 显示确认弹窗 ---- */
export function showConfirm(title, message, onConfirm, confirmText = '确认', isDanger = false) {
  const overlay = document.getElementById('layer-overlay');
  if (!overlay) return;

  overlay.classList.add('active');

  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';

  dialog.innerHTML = `
    <div class="confirm-dialog-bg"></div>
    <div class="confirm-dialog-box">
      <div class="confirm-dialog-body">
        <div class="confirm-dialog-title">${title}</div>
        <div class="confirm-dialog-message">${message}</div>
      </div>
      <div class="confirm-dialog-actions">
        <button class="confirm-dialog-btn cancel-btn">取消</button>
        <button class="confirm-dialog-btn ${isDanger ? 'danger' : ''} confirm-btn">${confirmText}</button>
      </div>
    </div>
  `;

  overlay.appendChild(dialog);

  requestAnimationFrame(() => {
    dialog.classList.add('show');
  });

  /* ---- 事件绑定 ---- */
  const close = () => {
    dialog.classList.remove('show');
    setTimeout(() => {
      dialog.remove();
      if (!overlay.querySelector('.confirm-dialog')) {
        overlay.classList.remove('active');
      }
    }, 200);
  };

  dialog.querySelector('.confirm-dialog-bg').addEventListener('click', close);
  dialog.querySelector('.cancel-btn').addEventListener('click', close);
  dialog.querySelector('.confirm-btn').addEventListener('click', () => {
    close();
    if (onConfirm) onConfirm();
  });
}

/* ============================================================
   BOTTOM SHEET — 底部弹出面板
   ============================================================ */

/* ---- 显示底部Sheet ---- */
export function showBottomSheet(title, contentHTML, options = {}) {
  const overlay = document.getElementById('layer-overlay');
  if (!overlay) return;

  overlay.classList.add('active');

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';

  wrapper.innerHTML = `
    <div class="bottom-sheet-overlay"></div>
    <div class="bottom-sheet">
      <div class="bottom-sheet-handle"></div>
      ${title ? `<div class="bottom-sheet-title">${title}</div>` : ''}
      <div class="bottom-sheet-body">${contentHTML}</div>
    </div>
  `;

  overlay.appendChild(wrapper);

  const sheetOverlay = wrapper.querySelector('.bottom-sheet-overlay');
  const sheet = wrapper.querySelector('.bottom-sheet');

  requestAnimationFrame(() => {
    sheetOverlay.classList.add('show');
    sheet.classList.add('show');
  });

  /* ---- 关闭方法 ---- */
  const close = () => {
    sheet.classList.remove('show');
    sheetOverlay.classList.remove('show');
    setTimeout(() => {
      wrapper.remove();
      if (!overlay.querySelector('.bottom-sheet')) {
        overlay.classList.remove('active');
      }
    }, 350);
  };

  sheetOverlay.addEventListener('click', close);

  /* 返回 sheet body和 close 方法，方便外部操作 */
  return {
    body: wrapper.querySelector('.bottom-sheet-body'),
    sheet: sheet,
    close
  };
}

/* ============================================================
   ERROR LOGGER — 全局错误捕获 + 日志存储
   ============================================================ */

/* ---- 初始化错误捕获 ---- */
export function initUtils() {
  /* ---- 捕获未处理的错误 ---- */
  window.addEventListener('error', (event) => {
    _logError({
      type: 'error',
      message: event.message ||'Unknown error',
      source: event.filename || '',
      line: event.lineno || 0,
      col: event.colno || 0,
      stack: event.error?.stack || ''
    });
  });

  /* ---- 捕获未处理的 Promise rejection ---- */
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    _logError({
      type: 'error',
      message: reason?.message || String(reason) || 'Unhandled Promise rejection',
      source: 'Promise',
      line: 0,
      col: 0,
      stack: reason?.stack || ''
    });
  });

  /* ---- 拦截 console.error ---- */
  const originalError = console.error;
  console.error = function(...args) {
    originalError.apply(console, args);
    const message = args.map(a => {
      if (a instanceof Error) return a.message;
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    }).join(' ');

    _logError({
      type: 'error',
      message,
      source: 'console.error',
      line: 0,
      col: 0,
      stack: (args.find(a => a instanceof Error))?.stack || ''
    });
  };

  /* ---- 拦截 console.warn ---- */
  const originalWarn = console.warn;
  console.warn = function (...args) {
    originalWarn.apply(console, args);
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    _logError({
      type: 'warn',
      message,
      source: 'console.warn',
      line: 0,
      col: 0,
      stack: ''
    });
  };

  console.log('[Utils] Error logger initialized');
}

/* ---- 内部：写入错误日志 ---- */
function _logError(entry) {
  const logEntry = {
    timestamp: Date.now(),
    type: entry.type || 'error',
    message: entry.message || '',
    source: entry.source || '',
    line: entry.line || 0,
    col: entry.col || 0,
    stack: entry.stack || ''
  };

  /* 异步写入，不阻塞 */
  addErrorLog(logEntry).catch(() => {});
}

/* ---- 手动记录日志 ---- */
export function logInfo(message) {
  _logError({ type: 'info', message, source: 'manual' });
}

/* ---- 导出给设置页使用 ---- */
export { getErrorLogs, clearErrorLogs };

/* ============================================================
   FILE UTILS — 文件处理
   ============================================================ */

/* ---- 文件转base64 ---- */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/* ---- 触发文件选择 ---- */
export function pickFile(accept = 'image/*') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      resolve(input.files[0] || null);
    };
    input.click();
  });
}

/* ============================================================
   TIME UTILS — 时间格式化
   ============================================================ */

/* ---- 格式化时间 HH:MM---- */
export function formatTime(date = new Date()) {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/* ---- 格式化日期 ---- */
export function formatDate(date = new Date()) {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekday = weekdays[date.getDay()];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${weekday}, ${month}月${day}日`;
}

/* ---- 格式化时间戳为可读字符串 ---- */
export function formatTimestamp(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* ============================================================
   ID UTILS — 唯一ID生成
   ============================================================ */

/* ---- 生成短ID ---- */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
