/* ============================================================
   SETTINGS — 系统设置页面
   AI配置 / 用户信息 / 外观 / 数据管理 / 错误日志
   ============================================================ */

import { getSetting, setSetting, getDB } from '../core/db.js';
import { getState, setTheme, setStatusbarVisible, setWallpaper, setUser, setAIConfig, applyTheme } from '../core/state.js';
import { showToast, showConfirm, showBottomSheet, fileToBase64, pickFile, formatTimestamp, getErrorLogs, clearErrorLogs } from '../core/utils.js';
import { closeApp } from '../core/router.js';

/* ============================================================
   初始化 — 监听 App 打开事件
   ============================================================ */

export function initSettings() {
  window.addEventListener('app-open', (e) => {
    if (e.detail.appId === 'settings') {
      _renderSettings();
    }
  });

  console.log('[Settings] Initialized');
}

/* ============================================================
   RENDER — 渲染设置页面
   ============================================================ */

async function _renderSettings() {
  const container = document.getElementById('app-container');
  const state = getState();

  container.innerHTML = `
    <!-- ======== 导航栏 ======== -->
    <div class="app-navbar">
      <button class="app-navbar-btn" id="settings-back">← 返回</button>
      <span class="app-navbar-title">设置</span>
      <span></span>
    </div>

    <!-- ======== 设置内容（可滚动） ======== -->
    <div id="settings-scroll" style="height:calc(100% - 44px);overflow-y:auto;padding:16px;-webkit-overflow-scrolling:touch;">

      <!-- ======== AI设置 ======== -->
      <div class="settings-group">
        <div class="settings-group-title">AI 设置</div>
        <div class="settings-list">
          <div class="settings-item" id="settings-ai-baseurl">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:#007AFF;">🌐</div>
              <span class="settings-item-text">Base URL</span>
            </div>
            <span class="settings-item-value" id="settings-ai-baseurl-val">${state.aiConfig?.baseURL || '未设置'}</span>
            <span class="settings-item-arrow">›</span>
          </div>
          <div class="settings-item" id="settings-ai-apikey">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:#FF9500;">🔑</div>
              <span class="settings-item-text">API Key</span>
            </div>
            <span class="settings-item-value">${state.aiConfig?.apiKey ? '••••••' + state.aiConfig.apiKey.slice(-4) : '未设置'}</span>
            <span class="settings-item-arrow">›</span>
          </div>
          <div class="settings-item" id="settings-ai-model">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:#AF52DE;">🤖</div>
              <span class="settings-item-text">模型</span>
            </div>
            <span class="settings-item-value">${state.aiConfig?.model || '未设置'}</span>
            <span class="settings-item-arrow">›</span>
          </div>
          <div class="settings-item" id="settings-ai-test">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:#34C759;">🧪</div>
              <span class="settings-item-text">测试连接</span>
            </div>
            <span class="settings-item-value" id="settings-ai-test-result"></span>
            <span class="settings-item-arrow">›</span>
          </div></div>
      </div>

      <!-- ======== 我的账号 ======== -->
      <div class="settings-group">
        <div class="settings-group-title">我的账号</div>
        <div class="settings-list">
          <div class="settings-item" id="settings-user-avatar">
            <div class="settings-item-left">
              <div style="width:40px;height:40px;border-radius:50%;overflow:hidden;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                ${state.user?.avatar ? `<img src="${state.user.avatar}" style="width:100%;height:100%;object-fit:cover;">` : '<span style="font-size:20px;">👤</span>'}
              </div>
              <span class="settings-item-text">${state.user?.name || '未设置'}</span>
            </div>
            <span class="settings-item-arrow">›</span>
          </div>
          <div class="settings-item" id="settings-user-persona">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:#5856D6;">📝</div>
              <span class="settings-item-text">个人人设</span>
            </div>
            <span class="settings-item-value">${state.user?.persona ? '已设置' : '未设置'}</span>
            <span class="settings-item-arrow">›</span>
          </div>
        </div>
      </div>

      <!-- ======== 外观 ======== -->
      <div class="settings-group">
        <div class="settings-group-title">外观</div>
        <div class="settings-list">
          <div class="settings-item" id="settings-theme">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:#FF9500;">🎨</div>
              <span class="settings-item-text">深浅色模式</span>
            </div>
            <span class="settings-item-value" id="settings-theme-val">${state.theme === 'dark' ? '深色' : state.theme === 'light' ? '浅色' : '跟随系统'}</span>
            <span class="settings-item-arrow">›</span>
          </div>
          <div class="settings-item" id="settings-wallpaper">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:#34C759;">🖼️</div>
              <span class="settings-item-text">壁纸</span>
            </div>
            <span class="settings-item-arrow">›</span>
          </div>
          <div class="settings-item" id="settings-statusbar-toggle">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:#8E8E93;">📶</div>
              <span class="settings-item-text">显示状态栏</span>
            </div>
            <div class="toggle-switch ${state.statusbarVisible ? 'active' : ''}" id="settings-statusbar-switch"></div>
          </div>
        </div>
      </div>

      <!-- ======== 数据管理 ======== -->
      <div class="settings-group">
        <div class="settings-group-title">数据管理</div>
        <div class="settings-list">
          <div class="settings-item" id="settings-export">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:#007AFF;">📤</div>
              <span class="settings-item-text">导出全部数据</span>
            </div>
            <span class="settings-item-arrow">›</span>
          </div>
          <div class="settings-item" id="settings-import">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:#34C759;">📥</div>
              <span class="settings-item-text">导入数据备份</span>
            </div>
            <span class="settings-item-arrow">›</span>
          </div>
          <div class="settings-item" id="settings-clear-all">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:#FF3B30;">🗑️</div>
              <span class="settings-item-text" style="color:var(--danger);">清除所有数据</span>
            </div>
            <span class="settings-item-arrow">›</span>
          </div>
        </div>
      </div>

      <!-- ======== 错误日志 ======== -->
      <div class="settings-group">
        <div class="settings-group-title">错误日志</div>
        <div class="settings-list">
          <div class="settings-item" id="settings-error-logs">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:#FF453A;">🐛</div>
              <span class="settings-item-text">查看错误日志</span>
            </div>
            <span class="settings-item-value" id="settings-error-count"></span>
            <span class="settings-item-arrow">›</span>
          </div>
        </div>
      </div>

      <!-- ======== 关于 ======== -->
      <div class="settings-group">
        <div class="settings-group-title">关于</div>
        <div class="settings-list">
          <div class="settings-item">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:#000;">
                <span style="color:#fff;font-size:12px;font-weight:800;">S</span>
              </div>
              <span class="settings-item-text">SHADOW v1.0</span>
            </div>
            <span class="settings-item-value">by NEWST</span>
          </div>
          <div class="settings-item" id="settings-github">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:#333;">🔗</div>
              <span class="settings-item-text">GitHub</span>
            </div>
            <span class="settings-item-value">NEWST</span>
            <span class="settings-item-arrow">›</span>
          </div>
        </div>
      </div><div style="height:40px;"></div>
    </div>
  `;

  /* ---- 加载错误日志数量 ---- */
  _loadErrorCount();

  /* ============================================================
     EVENT BINDINGS — 事件绑定
     ============================================================ */

  /* ---- 返回 ---- */
  container.querySelector('#settings-back').addEventListener('click', closeApp);

  /* ---- AI Base URL ---- */
  container.querySelector('#settings-ai-baseurl').addEventListener('click', () => {
    _editSingleField('Base URL', state.aiConfig?.baseURL || '', async (val) => {
      const config = { ...state.aiConfig, baseURL: val };
      await setAIConfig(config);
      _renderSettings();
      showToast('已保存', 'success');
    });
  });

  /* ---- AI API Key ---- */
  container.querySelector('#settings-ai-apikey').addEventListener('click', () => {
    _editSingleField('API Key', state.aiConfig?.apiKey || '', async (val) => {
      const config = { ...state.aiConfig, apiKey: val };
      await setAIConfig(config);
      _renderSettings();
      showToast('已保存', 'success');
    },'password');
  });

  /* ---- AI Model ---- */
  container.querySelector('#settings-ai-model').addEventListener('click', () => {
    _editSingleField('模型名', state.aiConfig?.model || '', async (val) => {
      const config = { ...state.aiConfig, model: val };
      await setAIConfig(config);
      _renderSettings();
      showToast('已保存', 'success');
    });
  });

  /* ---- AI测试连接 ---- */
  container.querySelector('#settings-ai-test').addEventListener('click', async () => {
    const resultEl = container.querySelector('#settings-ai-test-result');
    if (!state.aiConfig?.baseURL || !state.aiConfig?.apiKey) {
      showToast('请先设置 Base URL 和 API Key', 'warning');
      return;
    }

    resultEl.textContent = '测试中...';
    resultEl.style.color = 'var(--text-secondary)';

    try {
      const startTime = Date.now();
      const response = await fetch(`${state.aiConfig.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.aiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: state.aiConfig.model || 'gpt-4o',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5
        })
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        resultEl.textContent = `✅ ${latency}ms`;
        resultEl.style.color = 'var(--accent-secondary)';
        showToast(`连接成功！延迟 ${latency}ms`, 'success');
      } else {
        const errData = await response.json().catch(() => ({}));
        resultEl.textContent = '❌ 失败';
        resultEl.style.color = 'var(--danger)';
        showToast(`连接失败: ${errData.error?.message || response.statusText}`, 'error');
      }
    } catch (err) {
      resultEl.textContent = '❌ 错误';
      resultEl.style.color = 'var(--danger)';
      showToast(`网络错误: ${err.message}`, 'error');
    }
  });

  /* ---- 用户头像+名字 ---- */
  container.querySelector('#settings-user-avatar').addEventListener('click', () => {
    _showUserEditor();
  });

  /* ---- 用户人设 ---- */
  container.querySelector('#settings-user-persona').addEventListener('click', () => {
    _editSingleField('个人人设', state.user?.persona || '', async (val) => {
      await setUser({ ...state.user, persona: val });
      _renderSettings();
      showToast('已保存', 'success');
    }, 'textarea');
  });

  /* ---- 主题切换 ---- */
  container.querySelector('#settings-theme').addEventListener('click', () => {
    _showThemePicker();
  });

  /* ---- 壁纸 ---- */
  container.querySelector('#settings-wallpaper').addEventListener('click', () => {
    _showWallpaperPicker();
  });

  /* ---- 状态栏开关 ---- */
  container.querySelector('#settings-statusbar-toggle').addEventListener('click', async () => {
    const sw = container.querySelector('#settings-statusbar-switch');
    const isActive = sw.classList.contains('active');
    sw.classList.toggle('active');
    await setStatusbarVisible(!isActive);
    showToast(!isActive ? '状态栏已显示' : '状态栏已隐藏', 'info');
  });

  /* ---- 导出数据 ---- */
  container.querySelector('#settings-export').addEventListener('click', _exportData);

  /* ---- 导入数据 ---- */
  container.querySelector('#settings-import').addEventListener('click', _importData);

  /* ---- 清除所有数据 ---- */
  container.querySelector('#settings-clear-all').addEventListener('click', () => {
    showConfirm('清除所有数据', '此操作不可撤销，所有聊天记录、角色、设置都将被删除。', async () => {
      try {
        const db = getDB();
        await db.delete();
        showToast('数据已清除，即将刷新...', 'success');
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        showToast('清除失败: ' + err.message, 'error');
      }
    }, '清除', true);
  });

  /* ---- 错误日志 ---- */
  container.querySelector('#settings-error-logs').addEventListener('click', _showErrorLogs);

  /* ---- GitHub---- */
  container.querySelector('#settings-github')?.addEventListener('click', () => {
    window.open('https://github.com/NEWST', '_blank');
  });
}

/* ============================================================
   ERROR COUNT — 加载错误日志数量
   ============================================================ */

async function _loadErrorCount() {
  try {
    const logs = await getErrorLogs();
    const el = document.getElementById('settings-error-count');
    if (el) el.textContent = logs.length > 0 ? `${logs.length} 条` : '无';
  } catch {
    /* 静默 */
  }
}

/* ============================================================
   EDIT SINGLE FIELD — 通用单字段编辑弹窗
   ============================================================ */

function _editSingleField(label, currentValue, onSave, inputType = 'text') {
  const isTextarea = inputType === 'textarea';
  const { body, close } = showBottomSheet(label, `
    <div style="display:flex;flex-direction:column;gap:14px;">
      ${isTextarea
        ? `<textarea class="input-field" id="edit-field-input" rows="5" placeholder="输入${label}">${currentValue}</textarea>`
        : `<input class="input-field" id="edit-field-input" type="${inputType}" placeholder="输入${label}" value="${currentValue}">`
      }
      <button class="btn btn-primary" id="edit-field-save">保存</button>
    </div>
  `);

  body.querySelector('#edit-field-save').addEventListener('click', () => {
    const val = body.querySelector('#edit-field-input').value;
    close();
    onSave(val);
  });
}

/* ============================================================
   USER EDITOR — 用户信息编辑
   ============================================================ */

function _showUserEditor() {
  const state = getState();
  const { body, close } = showBottomSheet('编辑个人信息', `
    <div style="display:flex;flex-direction:column;align-items:center;gap:14px;">
      <div id="user-avatar-picker" style="width:80px;height:80px;border-radius:50%;overflow:hidden;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px dashed var(--text-tertiary);">
        ${state.user?.avatar ? `<img src="${state.user.avatar}" style="width:100%;height:100%;object-fit:cover;">` : '<span style="font-size:32px;">👤</span>'}
      </div>
      <span style="font-size:12px;color:var(--text-secondary);">点击更换头像</span>
      <span class="input-label" style="align-self:flex-start;">名字</span>
      <input class="input-field" id="user-name-input" value="${state.user?.name || ''}" placeholder="你的名字" maxlength="20">
      <button class="btn btn-primary" id="user-save-btn">保存</button>
    </div>
  `);

  let avatarData = state.user?.avatar || '';

  body.querySelector('#user-avatar-picker').addEventListener('click', async () => {
    const file = await pickFile('image/*');
    if (file) {
      try {
        avatarData = await fileToBase64(file);
        body.querySelector('#user-avatar-picker').innerHTML = `<img src="${avatarData}" style="width:100%;height:100%;object-fit:cover;">`;
        showToast('头像已更新', 'success');
      } catch {
        showToast('头像读取失败', 'error');
      }
    }
  });

  body.querySelector('#user-save-btn').addEventListener('click', async () => {
    const name = body.querySelector('#user-name-input').value.trim();
    if (!name) {
      showToast('请输入名字', 'warning');
      return;
    }
    await setUser({ ...state.user, name, avatar: avatarData });
    close();
    _renderSettings();
    showToast('已保存', 'success');
  });
}

/* ============================================================
   THEME PICKER — 主题选择
   ============================================================ */

function _showThemePicker() {
  const state = getState();
  const { body, close } = showBottomSheet('深浅色模式', `
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div class="settings-list">
        <div class="settings-item theme-option" data-theme="light">
          <div class="settings-item-left">
            <span class="settings-item-text">☀️ 浅色</span>
          </div>
          <span style="color:var(--accent);">${state.theme === 'light' ? '✓' : ''}</span>
        </div>
        <div class="settings-item theme-option" data-theme="dark">
          <div class="settings-item-left">
            <span class="settings-item-text">🌙 深色</span>
          </div>
          <span style="color:var(--accent);">${state.theme === 'dark' ? '✓' : ''}</span>
        </div><div class="settings-item theme-option" data-theme="auto">
          <div class="settings-item-left">
            <span class="settings-item-text">🔄跟随系统</span>
          </div>
          <span style="color:var(--accent);">${state.theme === 'auto' ? '✓' : ''}</span>
        </div>
      </div></div>
  `);

  body.querySelectorAll('.theme-option').forEach(opt => {
    opt.addEventListener('click', async () => {
      const theme = opt.dataset.theme;
      await setTheme(theme);
      close();
      _renderSettings();
      showToast(`已切换为${theme === 'dark' ? '深色' : theme === 'light' ? '浅色' : '跟随系统'}模式`, 'success');
    });
  });
}

/* ============================================================
   WALLPAPER PICKER — 壁纸选择
   ============================================================ */

function _showWallpaperPicker() {
  const { body, close } = showBottomSheet('壁纸设置', `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div class="settings-list">
        <div class="settings-item" id="wp-light">
          <div class="settings-item-left">
            <div class="settings-item-icon" style="background:#FFD60A;">☀️</div>
            <span class="settings-item-text">浅色模式壁纸</span>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
        <div class="settings-item" id="wp-dark">
          <div class="settings-item-left">
            <div class="settings-item-icon" style="background:#5856D6;">🌙</div>
            <span class="settings-item-text">深色模式壁纸</span>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
      </div>
    </div>
  `);

  body.querySelector('#wp-light').addEventListener('click', async () => {
    close();
    const file = await pickFile('image/*');
    if (file) {
      try {
        showToast('正在处理壁纸...', 'info');
        const base64 = await fileToBase64(file);
        await setWallpaper(base64, 'light');
        showToast('浅色壁纸已设置', 'success');
      } catch {
        showToast('壁纸设置失败', 'error');
      }
    }
  });

  body.querySelector('#wp-dark').addEventListener('click', async () => {
    close();
    const file = await pickFile('image/*');
    if (file) {
      try {
        showToast('正在处理壁纸...', 'info');
        const base64 = await fileToBase64(file);
        await setWallpaper(base64, 'dark');
        showToast('深色壁纸已设置', 'success');
      } catch {
        showToast('壁纸设置失败', 'error');
      }
    }
  });
}

/* ============================================================
   ERROR LOGS VIEWER — 错误日志查看器
   ============================================================ */

async function _showErrorLogs() {
  const logs = await getErrorLogs();

  const { body, close } = showBottomSheet('错误日志', `
    <div style="display:flex;flex-direction:column;gap:8px;">
      <!--======== 操作按钮 ======== -->
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <button class="btn btn-secondary" id="error-log-copy-all" style="flex:1;padding:10px;font-size:13px;">📋 复制全部</button>
        <button class="btn btn-danger" id="error-log-clear" style="flex:1;padding:10px;font-size:13px;">🗑️ 清空日志</button>
      </div>

      <!-- ======== 日志统计 ======== -->
      <div style="font-size:12px;color:var(--text-secondary);text-align:center;margin-bottom:4px;">
        共${logs.length} 条日志
      </div>

      <!-- ======== 日志列表 ======== -->
      <div id="error-log-list" style="max-height:50vh;overflow-y:auto;border-radius:12px;background:var(--bg-tertiary);">
        ${logs.length === 0
          ? '<div style="padding:40px;text-align:center;color:var(--text-tertiary);font-size:14px;">🎉 暂无错误日志</div>'
          : logs.map(log => `
            <div class="error-log-item" data-id="${log.id}">
              <div class="error-log-time">${formatTimestamp(log.timestamp)}</div>
              <span class="error-log-type ${log.type}">${log.type.toUpperCase()}</span>
              <span style="font-size:11px;color:var(--text-tertiary);">${log.source || ''}${log.line ? ':' + log.line : ''}</span>
              <div class="error-log-message">${_escapeHtml(log.message)}</div>
              ${log.stack ? `<div class="error-log-stack">${_escapeHtml(log.stack)}</div>` : ''}
              <button class="error-log-copy" data-log='${JSON.stringify(log).replace(/'/g, "&#39;")}'>📋 复制此条</button>
            </div>
          `).join('')
        }
      </div>
    </div>
  `);

  /*---- 复制单条 ---- */
  body.querySelectorAll('.error-log-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      try {
        const logData = JSON.parse(btn.dataset.log);
        const text = `[${formatTimestamp(logData.timestamp)}] [${logData.type}] ${logData.message}\n${logData.stack || ''}`.trim();
        navigator.clipboard.writeText(text).then(() => {
          showToast('已复制到剪贴板', 'success');
        }).catch(() => {
          _fallbackCopy(text);
        });
      } catch {
        showToast('复制失败', 'error');
      }
    });
  });

  /* ---- 复制全部 ---- */
  body.querySelector('#error-log-copy-all').addEventListener('click', () => {
    if (logs.length === 0) {
      showToast('没有日志可复制', 'info');
      return;
    }
    const allText = logs.map(log =>
      `[${formatTimestamp(log.timestamp)}] [${log.type}] [${log.source || ''}] ${log.message}\n${log.stack || ''}`
    ).join('\n---\n');

    navigator.clipboard.writeText(allText).then(() => {
      showToast('已复制全部日志', 'success');
    }).catch(() => {
      _fallbackCopy(allText);
    });
  });

  /* ---- 清空日志 ---- */
  body.querySelector('#error-log-clear').addEventListener('click', () => {
    showConfirm('清空日志', '确定要清空所有错误日志吗？', async () => {
      await clearErrorLogs();
      close();
      showToast('日志已清空', 'success');
      _loadErrorCount();
    }, '清空', true);
  });
}

/* ============================================================
   DATA EXPORT / IMPORT — 数据导出导入
   ============================================================ */

/* ---- 导出全部数据 ---- */
async function _exportData() {
  showToast('正在导出数据...', 'info');
  try {
    const db = getDB();
    const data = {
      exportTime: new Date().toISOString(),
      version: '1.0',
      settings: await db.settings.toArray(),
      characters: await db.characters.toArray(),
      channels: await db.channels.toArray(),
      messages: await db.messages.toArray(),
      calendarEvents: await db.calendarEvents.toArray(),
      forumBoards: await db.forumBoards.toArray(),
      forumPosts: await db.forumPosts.toArray(),
      stickers: await db.stickers.toArray()
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `shadow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('数据导出成功', 'success');
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}

/* ---- 导入数据 ---- */
async function _importData() {
  const file = await pickFile('.json');
  if (!file) return;

  showToast('正在导入数据...', 'info');

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.version) {
      showToast('无效的备份文件', 'error');
      return;
    }

    showConfirm('导入数据', '导入将覆盖当前所有数据，确定继续吗？', async () => {
      try {
        const db = getDB();

        /* 清空现有数据 */
        await db.settings.clear();
        await db.characters.clear();
        await db.channels.clear();
        await db.messages.clear();
        await db.calendarEvents.clear();
        await db.forumBoards.clear();
        await db.forumPosts.clear();
        await db.stickers.clear();

        /* 写入新数据 */
        if (data.settings?.length) await db.settings.bulkPut(data.settings);
        if (data.characters?.length) await db.characters.bulkPut(data.characters);
        if (data.channels?.length) await db.channels.bulkPut(data.channels);
        if (data.messages?.length) await db.messages.bulkPut(data.messages);
        if (data.calendarEvents?.length) await db.calendarEvents.bulkPut(data.calendarEvents);
        if (data.forumBoards?.length) await db.forumBoards.bulkPut(data.forumBoards);
        if (data.forumPosts?.length) await db.forumPosts.bulkPut(data.forumPosts);
        if (data.stickers?.length) await db.stickers.bulkPut(data.stickers);

        showToast('数据导入成功，即将刷新...', 'success');
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        showToast('导入失败: ' + err.message, 'error');
      }
    }, '导入', false);
  } catch (err) {
    showToast('文件解析失败: ' + err.message, 'error');
  }
}

/* ============================================================
   HELPERS — 辅助函数
   ============================================================ */

/* ---- HTML转义 ---- */
function _escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* ---- 降级复制（clipboard API不可用时） ---- */
function _fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.cssText = 'position:fixed;left:-9999px;';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showToast('已复制到剪贴板', 'success');
  } catch {
    showToast('复制失败，请手动复制', 'error');
  }
  document.body.removeChild(textarea);
}
