/* ============================================================
   HOMESCREEN — 手机主界面
   壁纸 / 状态栏 / Widget+App混排网格 / Dock / 多页滑动
   ============================================================ */

import { getSetting, setSetting } from '../core/db.js';
import { openApp } from '../core/router.js';
import { getState } from '../core/state.js';
import { formatTime, showToast, showBottomSheet, showConfirm, fileToBase64, pickFile } from '../core/utils.js';

/* ---- 模块状态 ---- */
let currentPage = 0;
let totalPages = 1;
let isEditing = false;
let longPressTimer = null;
let statusbarInterval = null;

/* ---- 默认布局数据 ---- */
const DEFAULT_ITEMS = [
  /* Widget */
  { id: 'widget-clock', type: 'widget', widgetType: 'clock', size: 'small', label: '时钟', customText: '', imageUrl: '' },
  { id: 'widget-calendar', type: 'widget', widgetType: 'calendar', size: 'small', label: '日历', customText: '', imageUrl: '' },
  /* App 图标 */
  { id: 'app-chat', type: 'app', appId: 'chat', label: '聊天', icon: '', color: '#00B900' },
  { id: 'app-calendar', type: 'app', appId: 'calendar', label: '日历', icon: '', color: '#FF3B30' },
  { id: 'app-forum', type: 'app', appId: 'forum', label: '论坛', icon: '', color: '#007AFF' },
  { id: 'app-settings', type: 'app', appId: 'settings', label: '设置', icon: '', color: '#8E8E93' }
];

const DEFAULT_DOCK = ['app-chat', 'app-settings'];

/* ============================================================
   初始化
   ============================================================ */

export async function initHomescreen() {
  /* ---- 读取布局数据 ---- */
  let items = await getSetting('home_items', null);
  if (!items) {
    items = DEFAULT_ITEMS;
    await setSetting('home_items', items);
  }

  let dockItems = await getSetting('dock_apps', null);
  if (!dockItems) {
    dockItems = DEFAULT_DOCK;
    await setSetting('dock_apps', dockItems);
  }

  /* ---- 渲染 ---- */
  _renderPages(items, dockItems);
  _initStatusbar();
  _initPageSwipe();
  _initEditMode();

  /* ---- 监听引导完成 ---- */
  window.addEventListener('onboarding-complete', async () => {
    const items = await getSetting('home_items', DEFAULT_ITEMS);
    const dockItems = await getSetting('dock_apps', DEFAULT_DOCK);
    _renderPages(items, dockItems);
  });

  console.log('[Homescreen] Initialized');
}

/* ============================================================
   RENDER — 渲染页面
   ============================================================ */

function _renderPages(items, dockItems) {
  const container = document.getElementById('pages-container');
  const indicator = document.getElementById('page-indicator');
  const dock = document.getElementById('dock');

  /* ---- 分页：每页最多 20 个格子（4列×5行，Widget占多格） ---- */
  const pages = _paginateItems(items);
  totalPages = pages.length;

  /* ---- 渲染页面 ---- */
  container.innerHTML = '';
  pages.forEach((pageItems, pageIndex) => {
    const page = document.createElement('div');
    page.className = 'home-page';
    page.dataset.page = pageIndex;

    pageItems.forEach(item => {
      if (item.type === 'widget') {
        page.appendChild(_createWidgetElement(item));
      } else {
        page.appendChild(_createAppIconElement(item));
      }
    });

    container.appendChild(page);
  });

  /* ---- 渲染页面指示器 ---- */
  indicator.innerHTML = '';
  for (let i = 0; i < totalPages; i++) {
    const dot = document.createElement('div');
    dot.className = `page-dot ${i === currentPage ? 'active' : ''}`;
    dot.addEventListener('click', () => _goToPage(i));
    indicator.appendChild(dot);
  }

  /* ---- 渲染Dock ---- */
  dock.innerHTML = '';
  dockItems.forEach(itemId => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      const el = _createDockIconElement(item);
      dock.appendChild(el);
    }
  });

  /* ---- 应用当前页 ---- */
  _goToPage(currentPage);
}

/* ---- 分页逻辑 ---- */
function _paginateItems(items) {
  const pages = [[]];
  let currentSlots = 0;
  const maxSlots = 20; /* 4列 × 5行 */

  items.forEach(item => {
    let slots = 1;
    if (item.type === 'widget') {
      if (item.size === 'small') slots = 2;
      else if (item.size === 'medium') slots = 4; /* 2列×2行 → 实际占4格 */
      else if (item.size === 'large') slots = 8; /* 4列×2行 → 实际占8格 */
    }

    if (currentSlots + slots > maxSlots) {
      pages.push([]);
      currentSlots = 0;
    }

    pages[pages.length - 1].push(item);
    currentSlots += slots;
  });

  if (pages.length === 0) pages.push([]);
  return pages;
}

/* ============================================================
   CREATE ELEMENTS — 创建 DOM 元素
   ============================================================ */

/* ---- 创建 App 图标 ---- */
function _createAppIconElement(item) {
  const wrapper = document.createElement('div');
  wrapper.className = 'app-icon-wrapper';
  wrapper.dataset.itemId = item.id;

  const iconDiv = document.createElement('div');
  iconDiv.className = 'app-icon';

  if (item.icon) {
    /*用户自定义图标（URL或base64） */
    iconDiv.innerHTML = `<img src="${item.icon}" alt="${item.label}" onerror="this.style.display='none'">`;
  } else {
    /* 默认：用颜色+首字母 */
    iconDiv.style.background = item.color || 'var(--accent)';
    iconDiv.innerHTML = `<span style="color:#fff;font-size:24px;font-weight:700;">${(item.label || '?')[0]}</span>`;
  }

  /*删除按钮 */
  const deleteBadge = document.createElement('div');
  deleteBadge.className = 'delete-badge';
  deleteBadge.textContent = '×';
  iconDiv.appendChild(deleteBadge);

  const label = document.createElement('div');
  label.className = 'app-icon-label';
  label.textContent = item.label || '';

  wrapper.appendChild(iconDiv);
  wrapper.appendChild(label);

  /*---- 点击事件 ---- */
  wrapper.addEventListener('click', (e) => {
    if (isEditing) return;
    if (e.target.classList.contains('delete-badge')) return;

    /*缩放动画 */
    iconDiv.style.transform = 'scale(0.9)';
    setTimeout(() => { iconDiv.style.transform = 'scale(1.05)'; }, 80);
    setTimeout(() => {
      iconDiv.style.transform = 'scale(1)';if (item.appId) {
        openApp(item.appId);
      }
    }, 160);
  });

  /* ---- 删除事件 ---- */
  deleteBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    showConfirm('删除图标', `确定要从主屏幕移除「${item.label}」吗？`, async () => {
      let items = await getSetting('home_items', DEFAULT_ITEMS);
      items = items.filter(i => i.id !== item.id);
      await setSetting('home_items', items);
      const dockItems = await getSetting('dock_apps', DEFAULT_DOCK);
      _renderPages(items, dockItems);
      showToast('已移除', 'success');
    }, '删除', true);
  });

  return wrapper;
}

/* ---- 创建 Widget 元素 ---- */
function _createWidgetElement(item) {
  const widget = document.createElement('div');
  const sizeClass = item.size === 'large' ? 'widget-large' : item.size === 'medium' ? 'widget-medium' : 'widget-small';
  widget.className = `widget-item ${sizeClass}`;
  widget.dataset.itemId = item.id;

  /*删除按钮 */
  const deleteBadge = document.createElement('div');
  deleteBadge.className = 'delete-badge';
  deleteBadge.textContent = '×';
  widget.appendChild(deleteBadge);

  /* ---- 根据类型渲染内容 ---- */
  if (item.imageUrl) {
    /* 有自定义图片 */
    widget.innerHTML += `
      <img class="widget-image" src="${item.imageUrl}" onerror="this.style.display='none'" alt="">
      <div class="widget-image-overlay">
        <div class="widget-title">${item.label || ''}</div>
        <div class="widget-body" style="font-size:14px;">${item.customText || ''}</div>
      </div>
    `;
  } else if (item.widgetType === 'clock') {
    widget.innerHTML += `
      <div class="widget-title">时钟</div>
      <div class="widget-body widget-clock-time">${formatTime()}</div>
      <div class="widget-sub">${item.customText || '当前时间'}</div>
    `;
    /* 实时更新 */
    setInterval(() => {
      const el = widget.querySelector('.widget-clock-time');
      if (el) el.textContent = formatTime();
    }, 1000);
  } else if (item.widgetType === 'calendar') {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    widget.innerHTML += `
      <div class="widget-title">日历</div>
      <div class="widget-body">${month}月${day}日</div>
      <div class="widget-sub">${item.customText || '星期' + weekdays[now.getDay()]}</div>
    `;
  } else if (item.widgetType === 'custom') {
    widget.innerHTML += `
      <div class="widget-title">${item.label || '自定义'}</div>
      <div class="widget-body" style="font-size:16px;line-height:1.4;">${item.customText || ''}</div>
    `;
  } else {
    widget.innerHTML += `
      <div class="widget-title">${item.label ||'Widget'}</div>
      <div class="widget-body">${item.customText || '--'}</div>
    `;
  }

  /* ---- 点击编辑Widget ---- */
  widget.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-badge')) return;
    if (isEditing) {
      _showWidgetEditor(item);
    }
  });

  /* ---- 删除事件 ---- */
  deleteBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    showConfirm('删除小组件', `确定要移除「${item.label}」吗？`, async () => {
      let items = await getSetting('home_items', DEFAULT_ITEMS);
      items = items.filter(i => i.id !== item.id);
      await setSetting('home_items', items);
      const dockItems = await getSetting('dock_apps', DEFAULT_DOCK);
      _renderPages(items, dockItems);
      showToast('已移除', 'success');
    }, '删除', true);
  });

  return widget;
}

/* ---- 创建 Dock 图标 ---- */
function _createDockIconElement(item) {
  const el = document.createElement('div');
  el.className = 'dock-icon';
  el.dataset.itemId = item.id;

  if (item.icon) {
    el.innerHTML = `<img src="${item.icon}" alt="${item.label}" onerror="this.style.display='none'">`;
  } else {
    el.style.background = item.color || 'var(--accent)';
    el.innerHTML = `<span style="color:#fff;font-size:24px;font-weight:700;">${(item.label || '?')[0]}</span>`;
  }

  el.addEventListener('click', () => {
    if (item.appId) {
      openApp(item.appId);
    }
  });

  return el;
}

/* ============================================================
   STATUSBAR — 状态栏实时更新
   ============================================================ */

function _initStatusbar() {
  const timeEl = document.getElementById('statusbar-time');
  const batteryText = document.getElementById('statusbar-battery-text');
  const batteryIcon = document.getElementById('statusbar-battery');
  const wifiIcon = document.getElementById('statusbar-wifi');

  /* ---- 时间更新 ---- */
  function updateTime() {
    if (timeEl) timeEl.textContent = formatTime();
  }
  updateTime();
  statusbarInterval = setInterval(updateTime, 1000);

  /* ---- 电量 ---- */
  if (navigator.getBattery) {
    navigator.getBattery().then(battery => {
      function updateBattery() {
        const level = Math.round(battery.level * 100);
        if (batteryText) batteryText.textContent = level + '%';
      }
      updateBattery();
      battery.addEventListener('levelchange', updateBattery);
    }).catch(() => {});
  }

  /* ---- WiFi ---- */
  function updateWifi() {
    if (wifiIcon) {
      wifiIcon.style.opacity = navigator.onLine ? '1' : '0.3';
    }
  }
  updateWifi();
  window.addEventListener('online', updateWifi);
  window.addEventListener('offline', updateWifi);
}

/* ============================================================
   PAGE SWIPE — 左右滑动切换页面
   ============================================================ */

function _initPageSwipe() {
  const content = document.getElementById('home-content');
  let startX = 0;
  let startY = 0;
  let isDragging = false;
  let isHorizontal = null;
  const container = document.getElementById('pages-container');

  /* ---- Touch---- */
  content.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = true;
    isHorizontal = null;container.style.transition = 'none';
  }, { passive: true });

  content.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    /* 判断方向 */
    if (isHorizontal === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      isHorizontal = Math.abs(dx) > Math.abs(dy);
    }

    if (isHorizontal) {
      const offset = -(currentPage * 100) + (dx / content.offsetWidth) * 100;
      container.style.transform = `translateX(${offset}%)`;
    }
  }, { passive: true });

  content.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;
    container.style.transition = '';

    if (!isHorizontal) return;

    const dx = e.changedTouches[0].clientX - startX;
    const threshold = content.offsetWidth * 0.2;

    if (dx< -threshold && currentPage < totalPages - 1) {
      _goToPage(currentPage + 1);
    } else if (dx > threshold && currentPage > 0) {
      _goToPage(currentPage - 1);
    } else {
      _goToPage(currentPage);
    }
  });

  /* ---- Mouse（桌面端） ---- */
  content.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    isDragging = true;
    isHorizontal = null;
    container.style.transition = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (isHorizontal === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      isHorizontal = Math.abs(dx) > Math.abs(dy);
    }

    if (isHorizontal) {
      const offset = -(currentPage * 100) + (dx / content.offsetWidth) * 100;
      container.style.transform = `translateX(${offset}%)`;
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    container.style.transition = '';

    if (!isHorizontal) return;

    const dx = e.clientX - startX;
    const threshold = content.offsetWidth * 0.2;

    if (dx < -threshold && currentPage < totalPages - 1) {
      _goToPage(currentPage + 1);
    } else if (dx > threshold && currentPage > 0) {
      _goToPage(currentPage - 1);
    } else {
      _goToPage(currentPage);
    }
  });
}

/* ----跳转到指定页 ---- */
function _goToPage(pageIndex) {
  currentPage = Math.max(0, Math.min(pageIndex, totalPages - 1));
  const container = document.getElementById('pages-container');
  container.style.transform = `translateX(${-currentPage * 100}%)`;

  /* 更新指示器 */
  document.querySelectorAll('.page-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentPage);
  });
}

/* ============================================================
   EDIT MODE — 长按编辑模式
   ============================================================ */

function _initEditMode() {
  const content = document.getElementById('home-content');

  /* ---- 长按进入编辑模式 ---- */
  let pressTimer = null;

  content.addEventListener('pointerdown', (e) => {
    const wrapper = e.target.closest('.app-icon-wrapper, .widget-item');
    if (!wrapper) return;

    pressTimer = setTimeout(() => {
      _enterEditMode();
    }, 600);
  });

  content.addEventListener('pointerup', () => clearTimeout(pressTimer));
  content.addEventListener('pointerleave', () => clearTimeout(pressTimer));content.addEventListener('pointermove', () => clearTimeout(pressTimer));

  /* ---- 点击空白退出编辑模式 ---- */
  document.getElementById('phone-container').addEventListener('click', (e) => {
    if (!isEditing) return;
    const isItem = e.target.closest('.app-icon-wrapper, .widget-item, .dock-icon, .delete-badge, .bottom-sheet, .confirm-dialog');
    if (!isItem) {
      _exitEditMode();
    }
  });
}

/* ---- 进入编辑模式 ---- */
function _enterEditMode() {
  if (isEditing) return;
  isEditing = true;

  document.querySelectorAll('.app-icon-wrapper').forEach(el => el.classList.add('editing'));
  document.querySelectorAll('.widget-item').forEach(el => el.classList.add('editing'));

  /* 添加「+」按钮到每页末尾 */
  document.querySelectorAll('.home-page').forEach(page => {
    if (!page.querySelector('.add-item-btn')) {
      const addBtn = document.createElement('div');
      addBtn.className = 'app-icon-wrapper add-item-btn';
      addBtn.innerHTML = `
        <div class="app-icon" style="background:var(--input-bg);border:2px dashed var(--text-tertiary);">
          <span style="font-size:28px;color:var(--text-tertiary);">+</span>
        </div>
        <div class="app-icon-label">添加</div>
      `;
      addBtn.addEventListener('click', () => _showAddItemSheet());
      page.appendChild(addBtn);
    }
  });

  showToast('编辑模式：点击空白处退出', 'info', 1500);
}

/* ---- 退出编辑模式 ---- */
function _exitEditMode() {
  if (!isEditing) return;
  isEditing = false;

  document.querySelectorAll('.app-icon-wrapper').forEach(el => el.classList.remove('editing'));
  document.querySelectorAll('.widget-item').forEach(el => el.classList.remove('editing'));
  document.querySelectorAll('.add-item-btn').forEach(el => el.remove());
}

/* ============================================================
   ADD ITEM — 添加新图标/Widget
   ============================================================ */

function _showAddItemSheet() {
  const { body, close } = showBottomSheet('添加到主屏幕', `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <!--======== 添加App图标 ======== -->
      <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-top:8px;">App图标</div>
      <div class="settings-list">
        <div class="settings-item" data-action="add-app">
          <div class="settings-item-left">
            <div class="settings-item-icon" style="background:#007AFF;">📱</div>
            <span class="settings-item-text">自定义 App 图标</span>
          </div>
          <span class="settings-item-arrow">›</span>
        </div></div>

      <!-- ======== 添加Widget ======== -->
      <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-top:8px;">小组件</div>
      <div class="settings-list">
        <div class="settings-item" data-action="add-widget-clock">
          <div class="settings-item-left">
            <div class="settings-item-icon" style="background:#FF9500;">🕐</div>
            <span class="settings-item-text">时钟（小）</span>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
        <div class="settings-item" data-action="add-widget-calendar">
          <div class="settings-item-left">
            <div class="settings-item-icon" style="background:#FF3B30;">📅</div>
            <span class="settings-item-text">日历（小）</span>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
        <div class="settings-item" data-action="add-widget-custom-small">
          <div class="settings-item-left">
            <div class="settings-item-icon" style="background:#AF52DE;">✏️</div>
            <span class="settings-item-text">自定义文字（小）</span>
          </div>
          <span class="settings-item-arrow">›</span>
        </div><div class="settings-item" data-action="add-widget-custom-medium">
          <div class="settings-item-left">
            <div class="settings-item-icon" style="background:#5856D6;">🖼️</div>
            <span class="settings-item-text">自定义图文（中）</span>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
        <div class="settings-item" data-action="add-widget-custom-large">
          <div class="settings-item-left">
            <div class="settings-item-icon" style="background:#34C759;">🖼️</div>
            <span class="settings-item-text">自定义图文（大）</span>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
      </div>
    </div>
  `);

  /* ---- 事件绑定 ---- */
  body.querySelectorAll('.settings-item').forEach(item => {
    item.addEventListener('click', async () => {
      const action = item.dataset.action;
      close();

      if (action === 'add-app') {
        _showAppIconEditor();
      } else if (action === 'add-widget-clock') {
        await _addItem({ id: 'widget-clock-' + Date.now(), type: 'widget', widgetType: 'clock', size: 'small', label: '时钟', customText: '', imageUrl: '' });
      } else if (action === 'add-widget-calendar') {
        await _addItem({ id: 'widget-cal-' + Date.now(), type: 'widget', widgetType: 'calendar', size: 'small', label: '日历', customText: '', imageUrl: '' });
      } else if (action === 'add-widget-custom-small') {
        _showCustomWidgetEditor('small');
      } else if (action === 'add-widget-custom-medium') {
        _showCustomWidgetEditor('medium');
      } else if (action === 'add-widget-custom-large') {
        _showCustomWidgetEditor('large');
      }
    });
  });
}

/* ---- 添加项目并刷新 ---- */
async function _addItem(item) {
  let items = await getSetting('home_items', DEFAULT_ITEMS);
  items.push(item);
  await setSetting('home_items', items);
  const dockItems = await getSetting('dock_apps', DEFAULT_DOCK);
  _renderPages(items, dockItems);
  if (isEditing) _enterEditMode();
  showToast('已添加', 'success');
}

/* ============================================================
   APP ICON EDITOR — 自定义App图标编辑器
   ============================================================ */

function _showAppIconEditor(existingItem = null) {
  const isEdit = !!existingItem;
  const { body, close } = showBottomSheet(isEdit ? '编辑图标' : '添加 App 图标', `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <span class="input-label">图标名称</span>
      <input class="input-field" id="edit-app-label" placeholder="App 名称" value="${isEdit ? existingItem.label : ''}" maxlength="10">

      <span class="input-label">图标图片（URL 或上传）</span>
      <input class="input-field" id="edit-app-icon-url" placeholder="输入图片URL" value="${isEdit && existingItem.icon && !existingItem.icon.startsWith('data:') ? existingItem.icon : ''}">
      <button class="btn btn-secondary" id="edit-app-upload" style="padding:10px;">📁 上传本地图片</button>

      <div id="edit-app-preview" style="width:60px;height:60px;border-radius:13.5px;overflow:hidden;background:var(--bg-tertiary);margin:0 auto;display:flex;align-items:center;justify-content:center;">
        ${isEdit && existingItem.icon ? `<img src="${existingItem.icon}" style="width:100%;height:100%;object-fit:cover;">` : '<span style="color:var(--text-tertiary);">预览</span>'}
      </div>

      <span class="input-label">背景颜色（无图标时使用）</span>
      <input class="input-field" id="edit-app-color" type="color" value="${isEdit ? existingItem.color || '#007AFF' : '#007AFF'}" style="height:44px;padding:4px;">

      <span class="input-label">关联 App ID（可选）</span>
      <input class="input-field" id="edit-app-appid" placeholder="如chat, calendar, forum, settings" value="${isEdit ? existingItem.appId || '' : ''}">

      <button class="btn btn-primary" id="edit-app-save">${isEdit ? '保存' : '添加'}</button>
    </div>
  `);

  let iconData = isEdit ? existingItem.icon : '';

  /* ---- URL输入预览 ---- */
  body.querySelector('#edit-app-icon-url').addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url) {
      iconData = url;
      body.querySelector('#edit-app-preview').innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<span style=color:var(--danger)>加载失败</span>'">`;
    }
  });

  /* ---- 上传图片 ---- */
  body.querySelector('#edit-app-upload').addEventListener('click', async () => {
    const file = await pickFile('image/*');
    if (file) {
      try {
        iconData = await fileToBase64(file);
        body.querySelector('#edit-app-preview').innerHTML = `<img src="${iconData}" style="width:100%;height:100%;object-fit:cover;">`;
        body.querySelector('#edit-app-icon-url').value = '';
        showToast('图片已加载', 'success');
      } catch {
        showToast('图片读取失败', 'error');
      }
    }
  });

  /* ---- 保存 ---- */
  body.querySelector('#edit-app-save').addEventListener('click', async () => {
    const label = body.querySelector('#edit-app-label').value.trim();
    if (!label) {
      showToast('请输入名称', 'warning');
      return;
    }

    const newItem = {
      id: isEdit ? existingItem.id :'app-custom-' + Date.now(),
      type: 'app',
      appId: body.querySelector('#edit-app-appid').value.trim() || '',
      label,
      icon: iconData || '',
      color: body.querySelector('#edit-app-color').value
    };

    let items = await getSetting('home_items', DEFAULT_ITEMS);
    if (isEdit) {
      const idx = items.findIndex(i => i.id === existingItem.id);
      if (idx >= 0) items[idx] = newItem;
    } else {
      items.push(newItem);
    }
    await setSetting('home_items', items);
    const dockItems = await getSetting('dock_apps', DEFAULT_DOCK);
    _renderPages(items, dockItems);
    if (isEditing) _enterEditMode();
    close();
    showToast(isEdit ? '已保存' : '已添加', 'success');
  });
}

/* ============================================================
   WIDGET EDITOR — 小组件编辑器
   ============================================================ */

function _showWidgetEditor(item) {
  _showCustomWidgetEditor(item.size, item);
}

function _showCustomWidgetEditor(size, existingItem = null) {
  const isEdit = !!existingItem;
  const { body, close } = showBottomSheet(isEdit ? '编辑小组件' : '添加自定义小组件', `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <span class="input-label">标题</span>
      <input class="input-field" id="edit-widget-label" placeholder="小组件标题" value="${isEdit ? existingItem.label || '' : ''}" maxlength="20">

      <span class="input-label">自定义文字</span>
      <textarea class="input-field" id="edit-widget-text" placeholder="显示的内容文字" rows="3">${isEdit ? existingItem.customText || '' : ''}</textarea>

      <span class="input-label">背景图片 URL（可选）</span>
      <input class="input-field" id="edit-widget-image" placeholder="输入图片 URL" value="${isEdit ? existingItem.imageUrl || '' : ''}">
      <button class="btn btn-secondary" id="edit-widget-upload" style="padding:10px;">📁 上传本地图片</button>

      <div id="edit-widget-preview" style="height:80px;border-radius:12px;overflow:hidden;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;">
        ${isEdit && existingItem.imageUrl ? `<img src="${existingItem.imageUrl}" style="width:100%;height:100%;object-fit:cover;">` : '<span style="color:var(--text-tertiary);">图片预览</span>'}
      </div>

      <span class="input-label">尺寸</span>
      <select class="input-field" id="edit-widget-size" style="appearance:auto;">
        <option value="small" ${size === 'small' ? 'selected' : ''}>小（2×1）</option>
        <option value="medium" ${size === 'medium' ? 'selected' : ''}>中（2×2）</option>
        <option value="large" ${size === 'large' ? 'selected' : ''}>大（4×2）</option>
      </select>

      <button class="btn btn-primary" id="edit-widget-save">${isEdit ? '保存' : '添加'}</button>
    </div>
  `);

  let imageData = isEdit ? existingItem.imageUrl || '' : '';

  /* ---- URL输入预览 ---- */
  body.querySelector('#edit-widget-image').addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url) {
      imageData = url;
      body.querySelector('#edit-widget-preview').innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<span style=color:var(--danger)>加载失败</span>'">`;
    }
  });

  /* ---- 上传图片 ---- */
  body.querySelector('#edit-widget-upload').addEventListener('click', async () => {
    const file = await pickFile('image/*');
    if (file) {
      try {
        imageData = await fileToBase64(file);
        body.querySelector('#edit-widget-preview').innerHTML = `<img src="${imageData}" style="width:100%;height:100%;object-fit:cover;">`;
        body.querySelector('#edit-widget-image').value = '';
        showToast('图片已加载', 'success');
      } catch {
        showToast('图片读取失败', 'error');
      }
    }
  });

  /* ---- 保存 ---- */
  body.querySelector('#edit-widget-save').addEventListener('click', async () => {
    const label = body.querySelector('#edit-widget-label').value.trim() || '自定义';
    const customText = body.querySelector('#edit-widget-text').value;
    const selectedSize = body.querySelector('#edit-widget-size').value;

    const newItem = {
      id: isEdit ? existingItem.id : 'widget-custom-' + Date.now(),
      type: 'widget',
      widgetType: 'custom',
      size: selectedSize,
      label,
      customText,
      imageUrl: imageData
    };

    let items = await getSetting('home_items', DEFAULT_ITEMS);
    if (isEdit) {
      const idx = items.findIndex(i => i.id === existingItem.id);
      if (idx >= 0) items[idx] = newItem;
    } else {
      items.push(newItem);
    }
    await setSetting('home_items', items);
    const dockItems = await getSetting('dock_apps', DEFAULT_DOCK);
    _renderPages(items, dockItems);
    if (isEditing) _enterEditMode();
    close();
    showToast(isEdit ? '已保存' : '已添加', 'success');
  });
}
