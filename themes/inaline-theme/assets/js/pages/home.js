// 首页专用脚本（DESIGN.md §4.3：每个页面单独一个文件，不挤进 main.js）
(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // 一言打字机（§7.5）：随机取一条，逐字打出 → 停留 → 逐字删除 → 换下一条
  // 鼠标悬停卡片（或键盘焦点进入）时暂停，移开 / 失焦后从断点续上
  // -------------------------------------------------------------------------

  var TYPE_INTERVAL = 110;   // 打字时每字间隔
  var PUNCT_PAUSE = 260;     // 中文标点后的额外停顿，让节奏带点"语气"
  var HOLD = 2800;           // 整句打完后停留展示的时间
  var DELETE_INTERVAL = 45;  // 删除时每字间隔（比打字快，不拖沓）
  var RESTART_DELAY = 500;   // 删完到打出下一句首字的间隔
  var START_DELAY = 600;     // 进场延迟：模板里的静态首条先亮一下再开打
  var PUNCT_RE = /[，。！？；：、…,.!?;:]/;

  function initHeroQuote() {
    var box = document.querySelector('.hero-quote');
    var textEl = box && box.querySelector('.hero-quote-typed');
    if (!textEl || box.dataset.bound === 'true') return;
    box.dataset.bound = 'true';

    var quotes;
    try {
      quotes = JSON.parse(box.dataset.hitokoto || '[]');
    } catch (e) {
      quotes = []; // 解析失败就保留模板静态渲染的第一条，不再接管
    }
    if (!quotes.length) return;

    // 降级：不做打字动画，直接静态展示随机一条（光标由 CSS 隐藏）
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      textEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];
      return;
    }

    // —— 可暂停的下一步调度 ——
    // 卡片尺寸跟随打字变化，而切换按钮就压在卡片左下角：卡片"边打边长"
    // 会把按钮从指针底下挪走，点空。所以鼠标移上卡片（或键盘焦点进入）
    // 先暂停，移开 / 失焦再从断点精确续上——暂停时记下剩余时间，
    // 恢复时按剩余时间重新计时，而不是从头再等一遍
    var pending = null;  // 当前挂起的下一步：{ fn, left, id, started }
    var paused = false;
    var hovering = false;
    var focused = false;
    var schedule; // 由下面赋值，打字 / 删除 / 停留全走它

    function updatePause() {
      var shouldPause = hovering || focused;
      if (shouldPause === paused) return;
      paused = shouldPause;
      if (!pending) return;
      if (paused) {
        clearTimeout(pending.id);
        pending.left -= Date.now() - pending.started;
        if (pending.left < 0) pending.left = 0;
      } else {
        startPending();
      }
    }

    function startPending() {
      var job = pending;
      job.started = Date.now();
      job.id = setTimeout(function () {
        pending = null;
        job.fn();
      }, job.left);
    }

    schedule = function (fn, ms) {
      pending = { fn: fn, left: ms, id: 0, started: 0 };
      if (!paused) startPending();
    };

    // 焦点条件只认"键盘焦点"：鼠标点击按钮同样会产生焦点（Chrome / Firefox
    // 的行为），点完再移开鼠标，焦点还留在按钮上——若把这种焦点也计入暂停，
    // 打字机就永远不恢复。:focus-visible 是浏览器的"这焦点是键盘给的"判定；
    // 老浏览器不支持该伪类（matches 抛错）时退回"焦点即暂停"
    function isKeyboardFocus(el) {
      try {
        return el.matches(':focus-visible');
      } catch (e) {
        return true;
      }
    }

    box.addEventListener('mouseenter', function () { hovering = true; updatePause(); });
    box.addEventListener('mouseleave', function () { hovering = false; updatePause(); });
    box.addEventListener('focusin', function (e) {
      focused = !!(e && e.target && isKeyboardFocus(e.target));
      updatePause();
    });
    box.addEventListener('focusout', function () { focused = false; updatePause(); });

    // 当前条目的下标。0 = 模板静态渲染的那条，先原样打出它，
    // 不在开打时整句跳变；之后的轮换才是随机的
    var current = 0;

    // 随机取下一句，且不与当前句重复
    function pickNext() {
      if (quotes.length === 1) return 0;
      var next;
      do {
        next = Math.floor(Math.random() * quotes.length);
      } while (next === current);
      return next;
    }

    function typeQuote(index) {
      current = index;
      var chars = quotes[index];
      var pos = 0;
      textEl.textContent = '';
      box.classList.add('is-typing'); // 打字期间光标常亮

      (function type() {
        pos += 1;
        textEl.textContent = chars.slice(0, pos);

        if (pos < chars.length) {
          var justTyped = chars.charAt(pos - 1);
          schedule(type, TYPE_INTERVAL + (PUNCT_RE.test(justTyped) ? PUNCT_PAUSE : 0));
          return;
        }

        box.classList.remove('is-typing'); // 打完了，光标恢复闪烁
        // 只有一条时打完就停住——删除重打同一句像故障，不是展示
        if (quotes.length > 1) schedule(erase, HOLD);
      })();
    }

    function erase() {
      box.classList.add('is-typing');

      // 先删再判断：删空的那一刻就排下一句，
      // 否则要多等一个 DELETE_INTERVAL 刻度才发现已经删空
      (function backspace() {
        var rest = textEl.textContent.slice(0, -1);
        textEl.textContent = rest;
        if (rest.length > 0) {
          schedule(backspace, DELETE_INTERVAL);
          return;
        }
        schedule(function () { typeQuote(pickNext()); }, RESTART_DELAY);
      })();
    }

    schedule(function () { typeQuote(0); }, START_DELAY);
  }

  // -------------------------------------------------------------------------
  // Hero 背景切换（§7.1）：卡片左下角左右箭头在封面上循环，交叉淡入
  // -------------------------------------------------------------------------

  function initHeroCovers() {
    var hero = document.querySelector('.hero');
    var layers = hero ? hero.querySelectorAll('.hero-bg-layer') : [];
    var box = document.querySelector('.hero-quote');
    var prev = box && box.querySelector('.hero-cover-btn--prev');
    var next = box && box.querySelector('.hero-cover-btn--next');
    if (!hero || layers.length < 2 || !prev || !next || hero.dataset.coversBound === 'true') return;
    hero.dataset.coversBound = 'true';

    // 与模板里 .is-active 的那层对应
    var index = 0;
    var i;
    for (i = 0; i < layers.length; i++) {
      if (layers[i].classList.contains('is-active')) { index = i; break; }
    }

    function show(target) {
      var count = layers.length;
      var j = ((target % count) + count) % count; // 负数取模也回绕
      layers[index].classList.remove('is-active');
      layers[j].classList.add('is-active');
      index = j;
    }

    // initial_cover = random：模板那次随机是"每次构建"的，只当无 JS 兜底；
    // 构建产物是静态 HTML，要让浏览器刷新也换图，只能在这里按每次载入重摇
    if (hero.dataset.coverRandom === 'true') {
      show(Math.floor(Math.random() * layers.length));
    }

    prev.addEventListener('click', function () { show(index - 1); });
    next.addEventListener('click', function () { show(index + 1); });
  }

  function init() {
    initHeroQuote();
    initHeroCovers();
  }

  init();

  // 与 main.js 的约定一致：暴露给后续 Swup 的 page:view 生命周期复用
  window.inalinePageInit = init;
})();
