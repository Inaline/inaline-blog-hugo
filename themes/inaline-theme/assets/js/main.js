/**
 * 全局脚本：随每个页面加载（见 DESIGN.md §4.3）。
 *
 * 约定：
 *  - 页面级逻辑不要写在这里，放到 assets/js/pages/<page>.js，由对应模板引入
 *  - 每个模块写成幂等 init()，事件用防重复绑定；后续接入 Swup 时，
 *    在 page:view 生命周期里再次调用 window.inalineInit() 即可，无需重写
 */
(function () {
  'use strict';

  var THEME_KEY = 'inaline-theme';

  /** 主题切换：写 data-theme + localStorage（初始值由 head 内联脚本决定） */
  function initThemeToggle() {
    var btn = document.querySelector('.theme-toggle');
    if (!btn || btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';

    btn.addEventListener('click', function () {
      var root = document.documentElement;
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;

      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) {
        /* 隐私模式下 localStorage 不可用，忽略即可 */
      }
    });
  }

  /** Header 滚动感知：滚动后加深阴影；向下滚动收起、向上滚动展开 */
  function initHeaderScroll() {
    var header = document.querySelector('.site-header');
    if (!header) return;

    var lastY = Math.max(0, window.scrollY);
    var topZone = header.offsetHeight + 24; // 顶部安全区：其内恒展开
    var DIRECTION_MIN = 8;                  // 小于此位移不判定方向，滤掉抖动

    function update() {
      var y = Math.max(0, window.scrollY); // iOS 橡皮筋回弹会产生负值
      header.classList.toggle('is-scrolled', y > 8);

      var delta = y - lastY;
      if (Math.abs(delta) < DIRECTION_MIN) return; // 小位移先累积，不更新基准
      lastY = y;

      // 向下滚 & 已离开安全区 & 焦点不在 Header 内 → 收起；否则展开
      var hide = delta > 0 && y > topZone && !header.contains(document.activeElement);
      header.classList.toggle('is-hidden', hide);
    }

    if (header.dataset.scrollBound !== 'true') {
      header.dataset.scrollBound = 'true';
      window.addEventListener('scroll', update, { passive: true });
      // 键盘 Tab 进入 Header 时强制展开，避免焦点元素滑出视口
      header.addEventListener('focusin', function () {
        header.classList.remove('is-hidden');
      });
    }

    update(); // 刷新后可能已处于滚动位置
  }

  /**
   * 页脚运行时长：初值由模板在构建时算好（无 JS 也读得到数），
   * 这里接管成"按真实时间逐秒重算"——用 Date.now() 反推差值而不是自增：
   * 后台标签页的定时器会被浏览器节流，自增会越走越慢
   */
  function initFooterUptime() {
    var el = document.querySelector('[data-uptime-start]');
    if (!el || el.dataset.uptimeBound === 'true') return; // 幂等：重复 init 不叠加定时器
    el.dataset.uptimeBound = 'true';

    var start = Number(el.dataset.uptimeStart) * 1000;
    var days = el.querySelector('[data-uptime-part="days"]');
    var hours = el.querySelector('[data-uptime-part="hours"]');
    var minutes = el.querySelector('[data-uptime-part="minutes"]');
    var seconds = el.querySelector('[data-uptime-part="seconds"]');
    if (!isFinite(start) || !days || !hours || !minutes || !seconds) return;

    function tick() {
      var s = Math.max(0, Math.floor((Date.now() - start) / 1000));
      days.textContent = Math.floor(s / 86400);
      hours.textContent = Math.floor((s % 86400) / 3600);
      minutes.textContent = Math.floor((s % 3600) / 60);
      seconds.textContent = s % 60;
    }

    tick(); // 先对齐一次：构建到现在这段时间差要补上
    setInterval(tick, 1000);
  }

  /**
   * 整卡可点：文章卡片与轮播图卡片把目标地址写在 data-card-href 上，
   * 点击卡片的空白处 / 文字区即跳转，不再只能点标题和缩略图。
   *
   * 用点击监听而不是铺满卡片的覆盖层：覆盖层会接走全部指针事件，
   * 标题与摘要就再也选不中、复制不了（§7.7）。因此这里也要放过
   * "拖选文字后的那次 click"——选择非空说明用户是在复制，不是要打开文章。
   * 卡片本身不进 Tab 序，键盘用户仍走标题链接。
   */
  function initClickableCards() {
    // 选区是否落在卡片内：只有"在卡上拖选"才拦住跳转；
    // 页面上别处的旧选区不应该让这张卡点不动
    function selectionInside(el) {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
      var range = sel.getRangeAt(0);
      if (range.intersectsNode) return range.intersectsNode(el);
      return el.contains(sel.anchorNode) || el.contains(sel.focusNode);
    }

    var cards = document.querySelectorAll('[data-card-href]');

    Array.prototype.forEach.call(cards, function (card) {
      if (card.dataset.cardClickBound === 'true') return;
      card.dataset.cardClickBound = 'true';

      card.addEventListener('click', function (e) {
        var href = card.dataset.cardHref;
        if (!href || e.defaultPrevented || e.button !== 0) return;
        // 带修饰键的点击不接管：留给用户按平台习惯操作（需要新标签页时走标题链接）
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        // 卡片里的链接 / 按钮自己处理，避免盖掉它们的原生行为
        if (e.target.closest('a, button, input, textarea, select, label')) return;
        // 刚在卡片上拖选完文字：用户是在选中 / 复制，不是要打开文章
        if (selectionInside(card)) return;
        window.location.href = href;
      });
    });
  }

  /**
   * 侧栏联系方式里的 copy 类按钮（微信这种没有网页地址的）：点击复制到剪贴板，
   * 并弹一个"已复制"气泡。气泡只在真的复制成功后才出——它是承诺，不是反馈音
   */
  function initSocialCopy() {
    var links = document.querySelectorAll('.social-link[data-copy]');
    if (!links.length) return;

    function copyText(text) {
      // 局域网 http 访问不是安全上下文，没有 clipboard API，用隐藏 textarea 兜底
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
      }
      return new Promise(function (resolve, reject) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-100px'; // 别让它把页面撑出滚动条
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try {
          ok = document.execCommand('copy');
        } catch (e) {
          ok = false;
        }
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      });
    }

    function flash(el) {
      el.classList.add('is-copied');
      clearTimeout(el.copyTimer); // 连点两次时重新计时，别让第一次的定时器提前收走气泡
      el.copyTimer = setTimeout(function () {
        el.classList.remove('is-copied');
      }, 1600);
    }

    Array.prototype.forEach.call(links, function (el) {
      if (el.dataset.copyBound === 'true') return;
      el.dataset.copyBound = 'true';
      el.addEventListener('click', function () {
        copyText(el.dataset.copy).then(function () {
          flash(el);
        }).catch(function () {
          /* 复制失败（浏览器不给权限）：不弹气泡，假装什么都没发生 */
        });
      });
    });
  }

  /**
   * 页面进入 / 滚动动效（DESIGN.md §5.3）：组件进入视口时淡入上移。
   * 只是视觉增强——减少动态效果、没有 IntersectionObserver、JS 失效时
   * 都不加 .reveal，内容始终按原样显示。
   */
  function initReveal() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    var selector = [
      '.page-header',
      '.page-content',
      '.term-list',
      '.carousel',
      '.post-list > .post-card',
      '.sidebar > .sidebar-card',
      '.pager',
      '.post-header',
      '.post-content',
      '.site-footer'
    ].join(',');

    var nodes = document.querySelectorAll(selector);
    if (!nodes.length) return;

    var pending = [];
    var initialIndex = 0;

    Array.prototype.forEach.call(nodes, function (el) {
      if (el.dataset.revealBound === 'true') return;
      el.dataset.revealBound = 'true';
      el.classList.add('reveal');

      // 首屏内已有的元素直接错峰进场，不必等观察器；
      // 首页 Hero 占满首屏，下面的轮播图与卡片会落到下面的观察分支
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.style.setProperty('--reveal-delay', Math.min(initialIndex * 50, 300) + 'ms');
        el.classList.add('is-visible');
        initialIndex++;
        return;
      }

      pending.push(el);
    });

    if (!pending.length) return;

    var io;
    try {
      io = new IntersectionObserver(function (entries) {
        // 同一批进场的元素依次错开半拍（如首页轮播图 + 首张卡片 + 侧栏同时露头）；
        // 慢慢滚动、每次只进一个时没有延迟
        var order = 0;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.style.setProperty('--reveal-delay', Math.min(order * 40, 200) + 'ms');
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
          order++;
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    } catch (e) {
      // 观察器创建失败时宁可不动，也不能把内容留在 opacity: 0
      pending.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    pending.forEach(function (el) { io.observe(el); });
  }

  function init() {
    initThemeToggle();
    initHeaderScroll();
    initFooterUptime();
    initClickableCards();
    initSocialCopy();
    initReveal();
  }

  init();

  // 供后续 Swup 生命周期复用
  window.inalineInit = init;
})();
