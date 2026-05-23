/* ============================================================
   LOCKSCREEN — 开机粒子动画 + 锁屏界面
   ============================================================ */

import { getState } from '../core/state.js';
import { navigateTo } from '../core/router.js';
import { formatTime, formatDate } from '../core/utils.js';

/* ---- 模块状态 ---- */
let bootFinished = false;
let lockscreenTimerInterval = null;

/* ============================================================
   初始化
   ============================================================ */

export function initLockscreen() {
  _startBootAnimation();
  _initLockscreenClock();
  _initSwipeToUnlock();
  console.log('[Lockscreen] Initialized');
}

/* ============================================================
   BOOT ANIMATION —粒子聚合效果
   ============================================================ */

function _startBootAnimation() {
  const canvas = document.getElementById('boot-canvas');
  const layerBoot = document.getElementById('layer-boot');
  if (!canvas || !layerBoot) return;

  const ctx = canvas.getContext('2d');
  const container = document.getElementById('phone-container');
  const W = container.offsetWidth;
  const H = container.offsetHeight;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  /*---- Step 1: 离屏Canvas采样文字像素 ---- */
  const offscreen = document.createElement('canvas');
  offscreen.width = W;
  offscreen.height = H;
  const offCtx = offscreen.getContext('2d');

  const fontSize = Math.min(72, W * 0.16);
  offCtx.fillStyle = '#ffffff';
  offCtx.font = `bold ${fontSize}px -apple-system, 'SF Pro Display', sans-serif`;
  offCtx.textAlign = 'center';
  offCtx.textBaseline = 'middle';
  offCtx.fillText('SHADOW', W / 2, H / 2);

  const imageData = offCtx.getImageData(0, 0, W, H);
  const pixels = imageData.data;

  /* ---- Step 2: 采样目标点 ---- */
  const targetPoints = [];
  const sampleStep = 3;
  for (let y = 0; y < H; y += sampleStep) {
    for (let x = 0; x < W; x += sampleStep) {
      const i = (y * W + x) * 4;
      if (pixels[i + 3] > 128) {
        targetPoints.push({ x, y });
      }
    }
  }

  /* ---- Step 3: 生成粒子 ---- */
  const particleCount = Math.min(200, Math.floor(W / 2));
  const particles = [];

  for (let i = 0; i < particleCount; i++) {
    const target = targetPoints[Math.floor(Math.random() * targetPoints.length)];
    /*初始位置在屏幕四周随机 */
    const side = Math.floor(Math.random() * 4);
    let startX, startY;
    switch (side) {
      case 0: startX = Math.random() * W; startY = -20; break;
      case 1: startX = W + 20; startY = Math.random() * H; break;
      case 2: startX = Math.random() * W; startY = H + 20; break;
      case 3: startX = -20; startY = Math.random() * H; break;
    }

    particles.push({
      x: startX,
      y: startY,
      targetX: target.x,
      targetY: target.y,
      size: 1.5 + Math.random() * 1.5,
      alpha: 1,
      arrived: false,
      disperseVx: (Math.random() - 0.5) * 3,
      disperseVy:-(1 + Math.random() * 3)
    });
  }

  /* ---- Step 4: 动画循环 ---- */
  let phase = 'converge'; /* converge → hold → disperse → done */
  let holdStart = 0;
  let disperseStart = 0;
  let allArrived = false;

  function animate() {
    ctx.clearRect(0, 0, W, H);

    if (phase === 'converge') {
      /* ---- 粒子向目标移动 ---- */
      let arrivedCount = 0;
      for (const p of particles) {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        p.x += dx * 0.08;
        p.y += dy * 0.08;

        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
          p.arrived = true;
          arrivedCount++;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
        ctx.fill();
      }

      if (arrivedCount >= particles.length * 0.95&& !allArrived) {
        allArrived = true;
        holdStart = performance.now();
        phase = 'hold';
      }

      requestAnimationFrame(animate);

    } else if (phase === 'hold') {
      /* ---- 停留1000ms ---- */
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.targetX, p.targetY, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
        ctx.fill();
      }

      if (performance.now() - holdStart > 1000) {
        disperseStart = performance.now();
        phase = 'disperse';
      }

      requestAnimationFrame(animate);

    } else if (phase === 'disperse') {
      /* ---- 粒子飘散 ---- */
      const elapsed = performance.now() - disperseStart;
      const progress = Math.min(elapsed / 500, 1);

      for (const p of particles) {
        p.x = p.targetX + p.disperseVx * elapsed * 0.1;
        p.y = p.targetY + p.disperseVy * elapsed * 0.1;p.alpha = 1 - progress;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
        ctx.fill();
      }

      if (progress >= 1) {
        phase = 'done';
        _onBootComplete();
      } else {
        requestAnimationFrame(animate);
      }
    }
  }

  requestAnimationFrame(animate);
}

/* ---- 开机动画完成 ---- */
function _onBootComplete() {
  const layerBoot = document.getElementById('layer-boot');
  layerBoot.classList.add('hidden');

  bootFinished = true;

  const state = getState();
  if (state.isFirstLaunch) {
    /*首次启动 → 显示引导 */
    _showOnboarding();
  } else {
    /* 正常启动 → 显示锁屏 */
    navigateTo('lockscreen');
  }
}

/* ============================================================
   LOCKSCREEN CLOCK — 锁屏时钟
   ============================================================ */

function _initLockscreenClock() {
  const timeEl = document.getElementById('lockscreen-time');
  const dateEl = document.getElementById('lockscreen-date');

  function update() {
    const now = new Date();
    if (timeEl) timeEl.textContent = formatTime(now);
    if (dateEl) dateEl.textContent = formatDate(now);
  }

  update();
  lockscreenTimerInterval = setInterval(update, 1000);
}

/* ============================================================
   SWIPE TO UNLOCK — 上滑解锁
   ============================================================ */

function _initSwipeToUnlock() {
  const lockscreen = document.getElementById('layer-lockscreen');
  if (!lockscreen) return;

  let startY = 0;
  let isDragging = false;

  /* ---- Touch事件 ---- */
  lockscreen.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    isDragging = true;
  }, { passive: true });

  lockscreen.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const deltaY = startY - e.touches[0].clientY;
    if (deltaY > 0) {
      lockscreen.style.transform = `translateY(${-deltaY}px)`;
      lockscreen.style.transition = 'none';
    }
  }, { passive: true });

  lockscreen.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const endY = e.changedTouches[0].clientY;
    const deltaY = startY - endY;

    lockscreen.style.transition = '';

    if (deltaY > 80) {
      _unlock();
    } else {
      lockscreen.style.transform = '';
    }
  });

  /* ---- Mouse 事件（桌面端） ---- */
  lockscreen.addEventListener('mousedown', (e) => {
    startY = e.clientY;
    isDragging = true;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaY = startY - e.clientY;
    if (deltaY > 0) {
      lockscreen.style.transform = `translateY(${-deltaY}px)`;
      lockscreen.style.transition = 'none';
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const deltaY = startY - e.clientY;

    lockscreen.style.transition = '';

    if (deltaY > 80) {
      _unlock();
    } else {
      lockscreen.style.transform = '';
    }
  });
}

/* ---- 解锁 ---- */
function _unlock() {
  const lockscreen = document.getElementById('layer-lockscreen');
  lockscreen.classList.add('unlocked');
  navigateTo('home');

  setTimeout(() => {
    lockscreen.classList.add('hidden');
  }, 500);
}

/* ============================================================
   ONBOARDING — 首次启动引导
   ============================================================ */

function _showOnboarding() {
  const layer = document.getElementById('layer-onboarding');
  layer.classList.add('active');

  /*隐藏锁屏 */
  const lockscreen = document.getElementById('layer-lockscreen');
  lockscreen.classList.add('hidden');

  /* ---- 引导步骤 HTML ---- */
  layer.innerHTML = `
    <!--======== Step 1: 欢迎 ======== -->
    <div class="onboarding-step active" data-step="1">
      <div class="onboarding-logo">SHADOW</div>
      <div class="onboarding-subtitle">你的AI虚拟手机<br>创建角色，开始对话</div>
      <button class="btn btn-primary" id="onboarding-start">开始设置</button>
    </div>

    <!-- ======== Step 2: 用户信息 ======== -->
    <div class="onboarding-step" data-step="2">
      <div class="onboarding-avatar-picker" id="onboarding-avatar">
        <svg viewBox="0 0 24 24"><path d="M19 7v2.99s-1.99.01-20V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-42 33-4 4 5H5z"/></svg>
      </div>
      <span class="input-label">你的名字</span>
      <input class="input-field" id="onboarding-name" placeholder="输入你的名字" maxlength="20">
      <button class="btn btn-primary" id="onboarding-next2">下一步</button>
    </div>

    <!-- ======== Step 3: AI配置 ======== -->
    <div class="onboarding-step" data-step="3">
      <div style="font-size:24px;font-weight:700;margin-bottom:4px;">AI 配置</div>
      <div class="onboarding-subtitle" style="margin-bottom:12px;">填写你的 OpenAI 兼容 API 信息</div>
      <span class="input-label">Base URL</span>
      <input class="input-field" id="onboarding-baseurl" placeholder="https://api.openai.com/v1" value="https://api.openai.com/v1">
      <span class="input-label">API Key</span>
      <input class="input-field" id="onboarding-apikey" placeholder="sk-..." type="password">
      <span class="input-label">模型名</span>
      <input class="input-field" id="onboarding-model" placeholder="gpt-4o" value="gpt-4o">
      <button class="btn btn-secondary" id="onboarding-test">测试连接</button>
      <div id="onboarding-test-result" style="font-size:13px;color:var(--text-secondary);min-height:20px;text-align:center;"></div>
      <button class="btn btn-primary" id="onboarding-finish">完成设置</button>
      <button class="btn btn-ghost" id="onboarding-skip">稍后设置</button>
    </div>
  `;

  /* ---- 引导数据 ---- */
  let avatarBase64 = null;

  /* ---- Step 1→ Step 2 ---- */
  layer.querySelector('#onboarding-start').addEventListener('click', () => {
    _goToStep(layer, 2);
  });

  /* ---- 头像选择 ---- */
  layer.querySelector('#onboarding-avatar').addEventListener('click', async () => {
    const { pickFile, fileToBase64, showToast } = await import('../core/utils.js');
    const file = await pickFile('image/*');
    if (file) {
      try {
        avatarBase64 = await fileToBase64(file);
        const avatarEl = layer.querySelector('#onboarding-avatar');
        avatarEl.innerHTML = `<img src="${avatarBase64}" alt="avatar">`;
        showToast('头像已设置', 'success');
      } catch (err) {
        showToast('头像读取失败', 'error');
      }
    }
  });

  /* ---- Step 2 → Step 3 ---- */
  layer.querySelector('#onboarding-next2').addEventListener('click', async () => {
    const { showToast } = await import('../core/utils.js');
    const name = layer.querySelector('#onboarding-name').value.trim();
    if (!name) {
      showToast('请输入你的名字', 'warning');
      return;
    }
    _goToStep(layer, 3);
  });

  /* ---- 测试连接 ---- */
  layer.querySelector('#onboarding-test').addEventListener('click', async () => {
    const { showToast } = await import('../core/utils.js');
    const btn = layer.querySelector('#onboarding-test');
    const resultEl = layer.querySelector('#onboarding-test-result');

    const baseURL = layer.querySelector('#onboarding-baseurl').value.trim();
    const apiKey = layer.querySelector('#onboarding-apikey').value.trim();
    const model = layer.querySelector('#onboarding-model').value.trim();

    if (!baseURL || !apiKey) {
      showToast('请填写 Base URL 和 API Key', 'warning');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 正在测试...';
    resultEl.textContent = '';

    try {
      const startTime = Date.now();
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json','Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'gpt-4o',
          messages: [{ role: 'user', content:'Hi' }],
          max_tokens: 5
        })
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        resultEl.style.color = 'var(--accent-secondary)';
        resultEl.textContent = `✅ 连接成功！延迟: ${latency}ms`;
        showToast('连接成功', 'success');} else {
        const errData = await response.json().catch(() => ({}));
        resultEl.style.color = 'var(--danger)';
        resultEl.textContent = `❌ 失败: ${errData.error?.message || response.statusText}`;
        showToast('连接失败', 'error');
      }
    } catch (err) {
      resultEl.style.color = 'var(--danger)';
      resultEl.textContent = `❌ 网络错误: ${err.message}`;
      showToast('连接失败', 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '测试连接';
  });

  /* ---- 完成设置 ---- */
  layer.querySelector('#onboarding-finish').addEventListener('click', async () => {
    await _finishOnboarding(layer, avatarBase64);
  });

  /* ---- 跳过 ---- */
  layer.querySelector('#onboarding-skip').addEventListener('click', async () => {
    await _finishOnboarding(layer, avatarBase64, true);
  });
}

/* ---- 切换引导步骤 ---- */
function _goToStep(layer, stepNum) {
  layer.querySelectorAll('.onboarding-step').forEach(s => s.classList.remove('active'));
  layer.querySelector(`[data-step="${stepNum}"]`).classList.add('active');
}

/* ---- 完成引导 ---- */
async function _finishOnboarding(layer, avatarBase64, skipAI = false) {
  const { showToast } = await import('../core/utils.js');
  const { setUser, setAIConfig } = await import('../core/state.js');

  const name = layer.querySelector('#onboarding-name')?.value.trim() || 'User';

  /* ---- 保存用户信息 ---- */
  await setUser({
    name,
    avatar: avatarBase64 || '',
    persona: ''
  });

  /* ---- 保存AI配置（如果没跳过） ---- */
  if (!skipAI) {
    const baseURL = layer.querySelector('#onboarding-baseurl')?.value.trim() || 'https://api.openai.com/v1';
    const apiKey = layer.querySelector('#onboarding-apikey')?.value.trim() || '';
    const model = layer.querySelector('#onboarding-model')?.value.trim() || 'gpt-4o';

    await setAIConfig({ baseURL, apiKey, model });
  }

  showToast('设置完成！', 'success');

  /* ---- 关闭引导，进入主界面 ---- */
  layer.classList.remove('active');
  navigateTo('home');

  /* 通知主界面刷新 */
  window.dispatchEvent(new CustomEvent('onboarding-complete'));
}
