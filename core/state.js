/* ============================================================
   STATE — 全局状态管理
   主题/ 用户信息 / AI配置 / 运行时状态
   ============================================================ */

import { getSetting, setSetting } from './db.js';

/* ---- 全局状态对象 ---- */
const state = {
  theme: 'dark',
  statusbarVisible: true,
  user: null,
  aiConfig: null,
  wallpaperLight: null,
  wallpaperDark: null,
  isFirstLaunch: false
};

/* ---- 初始化状态（从IndexedDB 读取） ---- */
export async function initState() {
  /*---- 读取主题 ---- */
  state.theme = await getSetting('theme_mode', 'dark');
  applyTheme(state.theme);

  /* ---- 读取状态栏可见性 ---- */
  state.statusbarVisible = await getSetting('statusbar_visible', true);
  applyStatusbar(state.statusbarVisible);

  /* ---- 读取用户信息 ---- */
  state.user = await getSetting('global_user', null);
  state.isFirstLaunch = !state.user;

  /* ---- 读取AI配置 ---- */
  state.aiConfig = await getSetting('ai_config', null);

  /* ---- 读取壁纸 ---- */
  state.wallpaperLight = await getSetting('wallpaper_light', null);
  state.wallpaperDark = await getSetting('wallpaper_dark', null);applyWallpaper();

  console.log('[State] Initialized', { isFirstLaunch: state.isFirstLaunch });
}

/* ---- 获取状态 ---- */
export function getState() {
  return state;
}

/* ============================================================
   THEME — 主题切换
   ============================================================ */

/* ---- 应用主题 ---- */
export function applyTheme(mode) {
  let effectiveTheme = mode;

  if (mode === 'auto') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.documentElement.setAttribute('data-theme', effectiveTheme);
  state.theme = mode;

  /* 壁纸也要跟着切换 */
  applyWallpaper();
}

/* ---- 设置并保存主题 ---- */
export async function setTheme(mode) {
  applyTheme(mode);
  await setSetting('theme_mode', mode);
}

/* ============================================================
   STATUSBAR — 状态栏显示/隐藏
   ============================================================ */

/* ---- 应用状态栏可见性 ---- */
export function applyStatusbar(visible) {
  const statusbar = document.getElementById('statusbar');
  if (statusbar) {
    statusbar.style.display = visible ? 'flex' : 'none';
  }
  state.statusbarVisible = visible;
}

/* ---- 设置并保存状态栏可见性 ---- */
export async function setStatusbarVisible(visible) {
  applyStatusbar(visible);
  await setSetting('statusbar_visible', visible);
}

/* ============================================================
   WALLPAPER — 壁纸管理
   ============================================================ */

/* ---- 应用壁纸 ---- */
export function applyWallpaper() {
  const layer = document.getElementById('layer-wallpaper');
  if (!layer) return;

  const currentTheme = document.documentElement.getAttribute('data-theme');
  const wp = currentTheme === 'dark' ? state.wallpaperDark : state.wallpaperLight;

  if (wp) {
    layer.style.backgroundImage = `url(${wp})`;
    layer.style.background = '';layer.style.backgroundImage = `url(${wp})`;layer.style.backgroundSize = 'cover';
    layer.style.backgroundPosition = 'center';
  } else {
    layer.style.backgroundImage = '';
    if (currentTheme === 'dark') {
      layer.style.background = 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)';
    } else {
      layer.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
    }
  }
}

/* ---- 设置壁纸 ---- */
export async function setWallpaper(base64, mode) {
  if (mode === 'dark') {
    state.wallpaperDark = base64;await setSetting('wallpaper_dark', base64);
  } else {
    state.wallpaperLight = base64;
    await setSetting('wallpaper_light', base64);
  }
  applyWallpaper();
}

/* ============================================================
   USER — 用户信息
   ============================================================ */

/* ---- 设置用户信息 ---- */
export async function setUser(userData) {
  state.user = userData;
  state.isFirstLaunch = false;
  await setSetting('global_user', userData);
}

/* ============================================================
   AI CONFIG — AI配置
   ============================================================ */

/* ---- 设置AI配置 ---- */
export async function setAIConfig(config) {
  state.aiConfig = config;
  await setSetting('ai_config', config);
}
