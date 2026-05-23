/* ============================================================
   ROUTER — 路由系统
   管理锁屏 / 主界面 / App 层级切换
   ============================================================ */

/* ---- 路由状态 ---- */
const routerState = {
  currentScreen: 'boot',   /* boot | lockscreen | home | app */
  currentApp: null,         /* 当前打开的 App ID */
  appStack: [],             /* App 内部导航栈 */
  listeners: []             /* 路由变化监听器 */
};

/* ---- 初始化路由 ---- */
export function initRouter() {
  /* 监听浏览器后退 */
  window.addEventListener('popstate', () => {
    if (routerState.currentScreen === 'app') {
      closeApp();
    }
  });

  console.log('[Router] Initialized');
}

/* ---- 获取当前路由状态 ---- */
export function getRouterState() {
  return { ...routerState };
}

/* ---- 切换到指定屏幕 ---- */
export function navigateTo(screen) {
  routerState.currentScreen = screen;
  _notifyListeners();
}

/* ---- 打开 App ---- */
export function openApp(appId) {
  const layerApp = document.getElementById('layer-app');
  const appContainer = document.getElementById('app-container');

  routerState.currentScreen = 'app';
  routerState.currentApp = appId;
  routerState.appStack = [appId];

  /* 添加历史记录以支持后退 */
  history.pushState({ app: appId }, '');

  /* 触发打开动画 */
  layerApp.classList.add('active');

  /* 派发自定义事件，让对应 App 模块响应 */
  window.dispatchEvent(new CustomEvent('app-open', { detail: { appId } }));

  _notifyListeners();
}

/* ---- 关闭 App ---- */
export function closeApp() {
  const layerApp = document.getElementById('layer-app');
  const appContainer = document.getElementById('app-container');

  layerApp.classList.remove('active');

  /* 等动画结束后清理 */
  setTimeout(() => {
    appContainer.innerHTML = '';
    routerState.currentScreen = 'home';
    routerState.currentApp = null;
    routerState.appStack = [];
    _notifyListeners();
  }, 350);
}

/* ---- 注册路由变化监听 ---- */
export function onRouteChange(callback) {
  routerState.listeners.push(callback);
}

/* ---- 通知所有监听器 ---- */
function _notifyListeners() {
  routerState.listeners.forEach(fn => {
    try { fn({ ...routerState }); } catch (e) { console.error('[Router] Listener error:', e); }
  });
}
