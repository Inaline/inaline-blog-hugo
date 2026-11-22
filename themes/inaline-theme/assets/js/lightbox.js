/**
 * 图片预览（DESIGN.md §5.4）：点击内容图片打开全屏大图，可缩放 / 拖动 / 切换。
 *
 * 分组约定（模板按容器打标即可，脚本不感知页面类型）：
 *  - 最近的 [data-lightbox-group] 祖先内的图片归为同一组；
 *  - 没有该属性时回退到最近的 .markdown（文章正文 / 页面内容）；
 *  - [data-lightbox-ignore] 祖先内的图片不参与预览（头像、表情等）；
 *    评论里的 .wl-emoji 也自动忽略，点表情不会打开大图；
 *  - data-lightbox-src 指定大图地址（缩略图场景），
 *    data-lightbox-caption 覆盖图注（默认取 alt）。
 *
 * 点击用事件委托、分组在点击时现算，Waline 等后插入的图片无需重新初始化。
 * 这是全局脚本（同 main.js），页面切换复用一套监听即可。
 */
(function () {
  'use strict';

  var GROUP_ATTR = 'data-lightbox-group';
  var IGNORE_SELECTOR = '[data-lightbox-ignore], .wl-emoji';
  var MAX_SCALE = 4;
  var ZOOM_STEP = 0.5;
  var SWIPE_X = 56;      // 横向切换的最小拖动距离
  var SWIPE_DOWN = 80;   // 下滑关闭的最小距离
  var SPINNER_DELAY = 200; // 超过这个时间还没加载完才露 spinner，缓存图片不闪

  var initialized = false;
  var ui = null;
  var gallery = [];
  var index = 0;
  var scale = 1;
  var tx = 0;
  var ty = 0;
  // 连续角度，不取模：每次 ±90° 都朝同方向转，避免 270° → 0° 被补间成反向 270°
  var rotation = 0;
  var loadToken = 0;     // 快速切图时作废上一次的 load / 定时器
  var spinnerTimer = null;
  var switchAnim = null;
  var isOpen = false;
  var lastFocus = null;
  var pointers = {};
  var pointerCount = 0;
  var gesture = null;
  var closeTimer = null;
  var stageSize = null; // 舞台内容区尺寸缓存，resize / 重新打开时失效

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function prefersReducedMotion() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** 图片地址：优先显式大图，其次浏览器已选中的 currentSrc，最后退回 src */
  function fullSrc(img) {
    return img.getAttribute('data-lightbox-src') ||
      img.currentSrc ||
      img.getAttribute('src') ||
      '';
  }

  /** 分组根：最近的 data-lightbox-group，没有则回退到 .markdown 内容容器 */
  function groupOf(img) {
    return img.closest('[' + GROUP_ATTR + ']') || img.closest('.markdown');
  }

  /** 取组内全部可预览图片（含传递性地排除 data-lightbox-ignore 子树） */
  function collect(root) {
    var out = [];
    Array.prototype.forEach.call(root.querySelectorAll('img'), function (img) {
      if (!img.closest(IGNORE_SELECTOR) && fullSrc(img)) out.push(img);
    });
    return out;
  }

  function values(obj) {
    var out = [];
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) out.push(obj[key]);
    }
    return out;
  }

  function distance(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  /** 未缩放的图片中心 = 舞台内容区中心（图片由 flex 居中） */
  function stageCenter() {
    var rect = ui.stage.getBoundingClientRect();
    return {
      x: rect.left + ui.stage.clientWidth / 2,
      y: rect.top + ui.stage.clientHeight / 2
    };
  }

  function buildUi() {
    if (ui) return;

    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.hidden = true;
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', '图片预览');
    lb.innerHTML = [
      '<div class="lightbox-stage" data-lightbox-stage>',
      '  <div class="lightbox-loader" aria-hidden="true"></div>',
      '  <img class="lightbox-image" alt="" draggable="false">',
      '  <p class="lightbox-caption" hidden></p>',
      '</div>',
      '<button type="button" class="lightbox-button lightbox-close" aria-label="关闭图片预览">',
      '  <i class="fa-solid fa-xmark" aria-hidden="true"></i>',
      '</button>',
      '<button type="button" class="lightbox-button lightbox-prev" aria-label="上一张">',
      '  <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>',
      '</button>',
      '<button type="button" class="lightbox-button lightbox-next" aria-label="下一张">',
      '  <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>',
      '</button>',
      '<div class="lightbox-toolbar">',
      '  <span class="lightbox-counter" aria-live="polite"></span>',
      '  <span class="lightbox-toolbar-sep" aria-hidden="true"></span>',
      '  <button type="button" class="lightbox-button lightbox-rotate-left" aria-label="向左旋转">',
      '    <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>',
      '  </button>',
      '  <button type="button" class="lightbox-button lightbox-rotate-right" aria-label="向右旋转">',
      '    <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>',
      '  </button>',
      '  <span class="lightbox-toolbar-sep" aria-hidden="true"></span>',
      '  <button type="button" class="lightbox-button lightbox-zoom-out" aria-label="缩小">',
      '    <i class="fa-solid fa-magnifying-glass-minus" aria-hidden="true"></i>',
      '  </button>',
      '  <span class="lightbox-zoom" aria-hidden="true">100%</span>',
      '  <button type="button" class="lightbox-button lightbox-zoom-in" aria-label="放大">',
      '    <i class="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i>',
      '  </button>',
      '  <button type="button" class="lightbox-button lightbox-reset" aria-label="重置缩放与旋转">',
      '    <i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>',
      '  </button>',
      '</div>'
    ].join('');
    document.body.appendChild(lb);

    ui = {
      root: lb,
      stage: lb.querySelector('[data-lightbox-stage]'),
      image: lb.querySelector('.lightbox-image'),
      caption: lb.querySelector('.lightbox-caption'),
      counter: lb.querySelector('.lightbox-counter'),
      sep: lb.querySelector('.lightbox-toolbar-sep'),
      zoom: lb.querySelector('.lightbox-zoom'),
      close: lb.querySelector('.lightbox-close'),
      prev: lb.querySelector('.lightbox-prev'),
      next: lb.querySelector('.lightbox-next'),
      rotateLeft: lb.querySelector('.lightbox-rotate-left'),
      rotateRight: lb.querySelector('.lightbox-rotate-right'),
      zoomIn: lb.querySelector('.lightbox-zoom-in'),
      zoomOut: lb.querySelector('.lightbox-zoom-out'),
      reset: lb.querySelector('.lightbox-reset')
    };

    bindUi();
  }

  function bindUi() {
    var el = ui;

    el.close.addEventListener('click', close);
    el.prev.addEventListener('click', function () { show(index - 1, true); });
    el.next.addEventListener('click', function () { show(index + 1, true); });
    el.rotateLeft.addEventListener('click', function () { rotateBy(-90); });
    el.rotateRight.addEventListener('click', function () { rotateBy(90); });
    el.zoomIn.addEventListener('click', function () {
      zoomTo(scale + ZOOM_STEP, stageCenter(), false);
    });
    el.zoomOut.addEventListener('click', function () {
      zoomTo(scale - ZOOM_STEP, stageCenter(), false);
    });
    el.reset.addEventListener('click', function () { resetView(true); });

    // 点空白遮罩关闭；点图片 / 图注不关闭
    el.stage.addEventListener('click', function (e) {
      if (e.target === el.stage) close();
    });

    el.stage.addEventListener('wheel', onWheel, { passive: false });
    el.image.addEventListener('pointerdown', onPointerDown);
    el.image.addEventListener('pointermove', onPointerMove);
    el.image.addEventListener('pointerup', onPointerUp);
    el.image.addEventListener('pointercancel', onPointerUp);
    el.image.addEventListener('dblclick', onDoubleClick);
  }

  /** 切图：新图从对应方向滑入；只做位移，不改透明度，避免画面忽明忽暗 */
  function playSwitch(direction) {
    if (!ui.image.animate || prefersReducedMotion()) return;

    if (switchAnim) {
      switchAnim.cancel();
      switchAnim = null;
    }

    switchAnim = ui.image.animate([
      { translate: (direction * 28) + 'px 0' },
      { translate: '0 0' }
    ], {
      duration: 450,
      easing: 'cubic-bezier(.22, 1, .36, 1)'
    });
    switchAnim.onfinish = function () { switchAnim = null; };
  }

  function show(nextIndex, animate) {
    var len = gallery.length;
    if (!len) return;

    var from = index;
    // 循环切换：第一张的上一张是最后一张
    index = ((nextIndex % len) + len) % len;
    // 1 = 从右侧滑入（下一张），-1 = 从左侧滑入（上一张）
    var direction = (index === from + 1 || (from === len - 1 && index === 0)) ? 1 : -1;

    // 切图时把上一张的缩放 / 旋转平滑归位（首张打开时直接归位，避免开场动画）
    resetView(!!animate);

    var source = gallery[index];
    var src = fullSrc(source);
    var caption = source.getAttribute('data-lightbox-caption') ||
      source.getAttribute('alt') || '';
    var token = ++loadToken;
    var settled = false;

    if (spinnerTimer) {
      clearTimeout(spinnerTimer);
      spinnerTimer = null;
    }
    ui.root.classList.remove('is-error', 'is-loading');
    ui.image.alt = source.getAttribute('alt') || '';

    function settle(ok) {
      if (token !== loadToken || settled) return;
      settled = true;

      if (spinnerTimer) {
        clearTimeout(spinnerTimer);
        spinnerTimer = null;
      }
      ui.root.classList.remove('is-loading');

      if (!ok) {
        ui.root.classList.add('is-error');
        return;
      }

      if (animate) playSwitch(direction);

      // 竖图旋转 90° 后要按新的外接框重新适配；图片尺寸此时才可知
      if (normalizedRotation() % 180 !== 0) {
        clampPan();
        applyTransform(false);
      }
    }

    ui.image.onload = function () { settle(true); };
    ui.image.onerror = function () { settle(false); };
    ui.image.src = src;

    if (ui.image.complete && ui.image.naturalWidth) {
      settle(true);
    } else {
      // 缓存图片会在延迟内直接 settle，spinner 根本不会出现；
      // 只有真的慢到超过 SPINNER_DELAY 才露出来
      spinnerTimer = setTimeout(function () {
        if (token !== loadToken || settled) return;
        ui.root.classList.add('is-loading');
      }, SPINNER_DELAY);
    }

    ui.caption.textContent = caption;
    ui.caption.hidden = !caption;

    var single = len < 2;
    ui.prev.hidden = single;
    ui.next.hidden = single;
    ui.counter.hidden = single;
    ui.sep.hidden = single;
    ui.counter.textContent = (index + 1) + ' / ' + len;

    preload(index - 1);
    preload(index + 1);
  }

  function preload(i) {
    if (gallery.length < 2) return;
    var src = fullSrc(gallery[(i + gallery.length) % gallery.length]);
    if (!src) return;
    var pre = new Image();
    pre.src = src;
  }

  /**
   * 以 point 为锚点缩放到 next。
   * 设 stageCenter 为 c、平移为 t、缩放为 s，让屏幕点 p 下的内容在缩放前后不动：
   *   t' = (p - c) - (s' / s) * (p - c - t)
   */
  function zoomTo(next, point, immediate) {
    next = clamp(next, 1, MAX_SCALE);
    if (Math.abs(next - scale) < 0.001) return;

    var c = stageCenter();
    var px = point.x - c.x;
    var py = point.y - c.y;
    var ratio = next / scale;

    tx = px - ratio * (px - tx);
    ty = py - ratio * (py - ty);
    scale = next;
    clampPan();
    applyTransform(!!immediate);
  }

  /** 只重置缩放与平移，保留旋转（双击用） */
  function resetZoom(animate) {
    scale = 1;
    tx = 0;
    ty = 0;
    clampPan();
    applyTransform(!animate);
  }

  /** 归一化到 0–359，仅用于判断是否旋转了 90° 的奇数倍 */
  function normalizedRotation() {
    return ((rotation % 360) + 360) % 360;
  }

  /** 缩放 / 平移 / 旋转全部归位（切图与工具栏重置用） */
  function resetView(animate) {
    // 归位到最近的「正立」等价角（360° 的整数倍），动画走最短路径：
    // 直接写 0 会让 270° 反向补间 270°（§5.4）
    rotation = Math.round(rotation / 360) * 360;
    resetZoom(animate);
  }

  /** 逆时针（-90）/ 顺时针（90）旋转：以图片中心为轴，平移归零 */
  function rotateBy(delta) {
    rotation += delta; // 不取模，保证过渡始终朝点击方向走 90°
    tx = 0;
    ty = 0;
    clampPan();
    applyTransform(false);
  }

  /** 舞台内容区尺寸（去掉内边距），旋转后的适配按它计算 */
  function stageContentSize() {
    if (stageSize) return stageSize;

    var cs = window.getComputedStyle(ui.stage);
    stageSize = {
      w: Math.max(0, ui.stage.clientWidth -
        parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)),
      h: Math.max(0, ui.stage.clientHeight -
        parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom))
    };
    return stageSize;
  }

  /** 旋转 90° / 270° 时按新的外接框缩到可容纳的尺寸；0° / 180° 保持原尺寸 */
  function fitScale() {
    if (normalizedRotation() % 180 === 0) return 1;

    var w = ui.image.offsetWidth || 0;
    var h = ui.image.offsetHeight || 0;
    if (!w || !h) return 1;

    var avail = stageContentSize();
    return Math.min(1, avail.w / h, avail.h / w);
  }

  /** 实际渲染倍率 = 用户缩放 × 旋转适配 */
  function renderScale() {
    return scale * fitScale();
  }

  function clampPan() {
    var w = ui.image.offsetWidth || 0;
    var h = ui.image.offsetHeight || 0;
    var scaled = renderScale();
    // 旋转 90° / 270° 后外接框的宽高互换
    var swap = normalizedRotation() % 180 !== 0;
    var boxW = (swap ? h : w) * scaled;
    var boxH = (swap ? w : h) * scaled;
    var avail = stageContentSize();
    var limitX = Math.max(0, (boxW - avail.w) / 2);
    var limitY = Math.max(0, (boxH - avail.h) / 2);

    tx = clamp(tx, -limitX, limitX);
    ty = clamp(ty, -limitY, limitY);
  }

  function applyTransform(immediate) {
    var img = ui.image;
    var value = 'translate(' + tx + 'px, ' + ty + 'px) scale(' +
      renderScale() + ') rotate(' + rotation + 'deg)';

    if (immediate) {
      // 拖动 / 滚轮 / 双指缩放必须跟手，不能被 transition 拖慢；
      // 下一帧再恢复过渡，让按钮缩放与旋转仍有缓动
      img.style.transition = 'none';
      img.style.transform = value;
      void img.offsetWidth;
      requestAnimationFrame(function () {
        img.style.transition = '';
      });
    } else {
      img.style.transition = '';
      img.style.transform = value;
    }

    ui.root.classList.toggle('is-zoomed', scale > 1.001);
    ui.zoom.textContent = Math.round(scale * 100) + '%';
  }

  function onWheel(e) {
    if (!isOpen) return;
    e.preventDefault();
    var factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomTo(scale * factor, { x: e.clientX, y: e.clientY }, true);
  }

  function onDoubleClick(e) {
    e.preventDefault();
    if (scale > 1.001) {
      resetZoom(false);
    } else {
      zoomTo(2, { x: e.clientX, y: e.clientY }, false);
    }
  }

  function onPointerDown(e) {
    if (!isOpen) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.preventDefault();
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    pointerCount++;

    if (pointerCount === 1) {
      gesture = {
        mode: scale > 1.001 ? 'pan' : 'swipe',
        startX: e.clientX,
        startY: e.clientY,
        startTx: tx,
        startTy: ty
      };
      ui.root.classList.toggle('is-dragging', gesture.mode === 'pan');
    } else if (pointerCount === 2) {
      var pts = values(pointers);
      gesture = {
        mode: 'pinch',
        startDist: distance(pts[0], pts[1]) || 1,
        startScale: scale,
        startTx: tx,
        startTy: ty
      };
      ui.root.classList.add('is-dragging');
    }

    try {
      ui.image.setPointerCapture(e.pointerId);
    } catch (err) {
      /* 不支持指针捕获时退化为普通移动，不影响单指操作 */
    }
  }

  function onPointerMove(e) {
    if (!pointers[e.pointerId] || !gesture) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };

    if (gesture.mode === 'pinch' && pointerCount >= 2) {
      var pts = values(pointers);
      var mid = midpoint(pts[0], pts[1]);
      var next = clamp(
        gesture.startScale * (distance(pts[0], pts[1]) / gesture.startDist),
        1,
        MAX_SCALE
      );
      var c = stageCenter();
      var px = mid.x - c.x;
      var py = mid.y - c.y;
      var ratio = next / gesture.startScale;

      scale = next;
      tx = px - ratio * (px - gesture.startTx);
      ty = py - ratio * (py - gesture.startTy);
      clampPan();
      applyTransform(true);
      return;
    }

    if (gesture.mode === 'pan') {
      tx = gesture.startTx + (e.clientX - gesture.startX);
      ty = gesture.startTy + (e.clientY - gesture.startY);
      clampPan();
      applyTransform(true);
    }
  }

  function onPointerUp(e) {
    if (!pointers[e.pointerId]) return;
    delete pointers[e.pointerId];
    if (pointerCount > 0) pointerCount--;

    if (pointerCount === 0) {
      if (gesture && gesture.mode === 'swipe' && e.type !== 'pointercancel') {
        var dx = e.clientX - gesture.startX;
        var dy = e.clientY - gesture.startY;

        if (Math.abs(dx) > SWIPE_X && Math.abs(dx) > Math.abs(dy) * 1.2) {
          show(dx < 0 ? index + 1 : index - 1, true);
        } else if (dy > SWIPE_DOWN && Math.abs(dy) > Math.abs(dx) * 1.2) {
          close();
        }
      }

      gesture = null;
      ui.root.classList.remove('is-dragging');
    } else if (pointerCount === 1 && gesture && gesture.mode === 'pinch') {
      // 双指变单指：剩下的手指从当前状态继续拖拽，而不是回到手势起点
      var rest = values(pointers)[0];
      gesture = {
        mode: scale > 1.001 ? 'pan' : 'swipe',
        startX: rest.x,
        startY: rest.y,
        startTx: tx,
        startTy: ty
      };
      ui.root.classList.toggle('is-dragging', gesture.mode === 'pan');
    }
  }

  function focusables() {
    return [ui.close, ui.prev, ui.next, ui.rotateLeft, ui.rotateRight,
      ui.zoomOut, ui.zoomIn, ui.reset]
      .filter(function (el) {
        return el && !el.hidden && el.offsetParent !== null;
      });
  }

  function trapFocus(e) {
    var list = focusables();
    if (!list.length) return;

    var first = list[0];
    var last = list[list.length - 1];
    var active = document.activeElement;

    if (!ui.root.contains(active)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onKeydown(e) {
    if (!isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowLeft' && gallery.length > 1) {
      e.preventDefault();
      show(index - 1, true);
    } else if (e.key === 'ArrowRight' && gallery.length > 1) {
      e.preventDefault();
      show(index + 1, true);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomTo(scale + ZOOM_STEP, stageCenter(), false);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomTo(scale - ZOOM_STEP, stageCenter(), false);
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      rotateBy(e.shiftKey ? -90 : 90); // R 顺时针、Shift + R 逆时针
    } else if (e.key === '0') {
      e.preventDefault();
      resetView(true);
    } else if (e.key === 'Tab') {
      trapFocus(e);
    }
  }

  function onResize() {
    if (!isOpen) return;
    stageSize = null;
    resetZoom(false);
  }

  function open(list, startIndex) {
    buildUi();
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    gallery = list;
    index = startIndex;
    lastFocus = document.activeElement;
    isOpen = true;
    stageSize = null;

    ui.root.hidden = false;
    void ui.root.offsetWidth; // 让 opacity 过渡从 0 开始
    ui.root.classList.add('is-open');
    document.documentElement.classList.add('is-lightbox-open');

    show(startIndex, false);
    ui.close.focus();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    loadToken++; // 作废还在等待的加载 / 淡入定时器

    if (spinnerTimer) {
      clearTimeout(spinnerTimer);
      spinnerTimer = null;
    }
    if (switchAnim) {
      switchAnim.cancel();
      switchAnim = null;
    }

    ui.root.classList.remove('is-open', 'is-dragging', 'is-zoomed', 'is-loading', 'is-error');
    document.documentElement.classList.remove('is-lightbox-open');

    pointers = {};
    pointerCount = 0;
    gesture = null;

    closeTimer = setTimeout(function () {
      closeTimer = null;
      if (isOpen) return; // 淡出期间又重新打开了
      ui.root.hidden = true;
      ui.image.removeAttribute('src');
    }, prefersReducedMotion() ? 0 : 200);

    if (lastFocus && lastFocus.focus) {
      try {
        lastFocus.focus({ preventScroll: true });
      } catch (err) {
        lastFocus.focus();
      }
    }

    lastFocus = null;
    gallery = [];
    index = 0;
  }

  /**
   * 点击内容图片打开预览。带修饰键的点击不接管：
   * 图片被链接包着时，用户仍可 Ctrl / Cmd + 点击按平台习惯打开链接。
   */
  function onClick(e) {
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var target = e.target;
    if (!target || !target.closest) return;

    var img = target.closest('img');
    if (!img || img.closest('.lightbox')) return;
    if (img.closest(IGNORE_SELECTOR)) return;

    var root = groupOf(img);
    if (!root) return;

    var list = collect(root);
    var start = list.indexOf(img);
    if (start < 0) return;

    e.preventDefault();
    open(list, start);
  }

  function init() {
    if (initialized) return;
    initialized = true;

    // 捕获阶段：先于整卡跳转（data-card-href）的冒泡监听，
    // preventDefault 之后卡片监听会主动让路，预览不会被带跳走
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('resize', onResize);
  }

  init();

  // 与其他全局脚本一致：后续接入 Swup 时可在 page:view 再次调用
  window.inalineLightboxInit = init;
})();
