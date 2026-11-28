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
  var PAGE_BG_KEY = 'inaline-page-bg';

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

  /**
   * 封面记忆（DESIGN.md §7.1）：首页把当前激活封面写进 localStorage，
   * 文章页的页脚据此还原上一次首页看到的封面（见 initFooterCover）。
   * 切换本身归 home.js（初始随机 + 左右箭头），这里只观察 .is-active 的变化，
   * 因此两边不需要互相调用，各自保持幂等 init。
   */
  function initPageBgMemory() {
    var bg = document.querySelector('.page-bg[data-page-bg="home"]');
    if (!bg || bg.dataset.bgMemoryBound === 'true') return;
    bg.dataset.bgMemoryBound = 'true';

    function save() {
      var active = bg.querySelector('.page-bg-layer.is-active');
      var cover = active && active.getAttribute('data-cover');
      if (!cover) return;
      try {
        localStorage.setItem(PAGE_BG_KEY, cover);
      } catch (e) {
        /* 隐私模式下 localStorage 不可用，忽略即可 */
      }
    }

    save(); // 初始那张；home.js 的随机重摇 / 箭头切换会再触发下面的观察

    if (!window.MutationObserver) return;
    var observer = new MutationObserver(save);
    var layers = bg.querySelectorAll('.page-bg-layer');
    Array.prototype.forEach.call(layers, function (layer) {
      observer.observe(layer, { attributes: true, attributeFilter: ['class'] });
    });
  }

  /**
   * 分类 / 标签词条页背景（DESIGN.md §7.12）：不参与封面切换，也不写记忆，
   * 但沿用首页上次选中的封面，让首页 → 词条页的背景保持连续；
   * 没有记录 / 记录不在封面池里时保留模板构建期选好的那张。
   */
  function initPageBgRestore() {
    var bg = document.querySelector('.page-bg[data-page-bg="term"]');
    if (!bg || bg.dataset.bgRestoreBound === 'true') return;
    bg.dataset.bgRestoreBound = 'true';

    var cover = '';
    try {
      cover = localStorage.getItem(PAGE_BG_KEY) || '';
    } catch (e) {
      /* 隐私模式下 localStorage 不可用，保留构建期封面 */
    }
    if (!cover) return;

    var target = null;
    var layers = bg.querySelectorAll('.page-bg-layer');
    Array.prototype.forEach.call(layers, function (layer) {
      if (layer.getAttribute('data-cover') === cover) target = layer;
    });
    if (!target || target.classList.contains('is-active')) return;

    var active = bg.querySelector('.page-bg-layer.is-active');
    if (active) active.classList.remove('is-active');
    target.classList.add('is-active');
  }

  /**
   * 文章页 / 归档页 / 搜索页 / 动态页页脚背景（DESIGN.md §7.1 / §7.13 / §7.14 / §7.15）：
   * 整页背景取消后，背景图只在页脚出现。取首页上次展示的封面（同 PAGE_BG_KEY），
   * 校验它属于封面池后写进 --footer-cover；没有记录 / 记录失效时退回封面池第一张。
   */
  function initFooterCover() {
    var footer = document.querySelector('.site-footer[data-footer-covers]');
    if (!footer || footer.dataset.footerCoverBound === 'true') return;
    footer.dataset.footerCoverBound = 'true';

    var covers = (footer.getAttribute('data-footer-covers') || '').split(' ');
    if (!covers.length || !covers[0]) return;

    var cover = '';
    try {
      cover = localStorage.getItem(PAGE_BG_KEY) || '';
    } catch (e) {
      /* 隐私模式下 localStorage 不可用，忽略即可 */
    }
    if (covers.indexOf(cover) === -1) cover = covers[0];

    footer.style.setProperty('--footer-cover', "url('" + cover + "')");
    footer.classList.add('has-cover-bg');
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

  /** 复制文本：局域网 http 访问不是安全上下文，没有 clipboard API，用隐藏 textarea 兜底 */
  function copyText(text) {
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

  /**
   * 侧栏联系方式里的 copy 类按钮（微信这种没有网页地址的）：点击复制到剪贴板，
   * 并弹一个"已复制"气泡。气泡只在真的复制成功后才出——它是承诺，不是反馈音
   */
  function initSocialCopy() {
    var links = document.querySelectorAll('.social-link[data-copy]');
    if (!links.length) return;

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
   * 代码窗口（DESIGN.md §9.4）：
   *  - 窗口条右侧的"复制"按钮把代码写进剪贴板，成功后短暂显示"已复制"；
   *  - 行数超过阈值的代码块默认收起，代码区下方的居中箭头负责展开 / 收起。
   *
   * 按 Chroma 的 .line 数量判断长度，而不是像素高度——等宽字体是
   * font-display: swap，加载完成前后高度会变，行数不受影响。
   */
  function initCodeWindows() {
    var LINE_LIMIT = 12;

    var windows = document.querySelectorAll('.code-window');

    Array.prototype.forEach.call(windows, function (win) {
      if (win.dataset.codeWindowBound === 'true') return;
      win.dataset.codeWindowBound = 'true';

      var body = win.querySelector('.code-window-body');
      if (!body) return;

      // 行号列只是视觉辅助：拿掉它的 Tab 停靠点与朗读
      var numberCell = body.querySelector('.lntd:first-child');
      if (numberCell) numberCell.setAttribute('aria-hidden', 'true');
      var numberPre = numberCell && numberCell.querySelector('pre');
      if (numberPre) numberPre.removeAttribute('tabindex');

      // 复制：行号在另一列，必须取代码列，不能取 body 里第一个 <code>
      var code = body.querySelector('code[data-lang]') ||
                 body.querySelector('.lntd:last-child code') ||
                 body.querySelector('code');
      var copy = win.querySelector('.code-window-copy');
      if (copy && code) {
        var copyIcon = copy.querySelector('i');
        copy.hidden = false;
        copy.addEventListener('click', function () {
          copyText(code.textContent).then(function () {
            copy.setAttribute('aria-label', '已复制');
            if (copyIcon) copyIcon.className = 'fa-solid fa-check';
            clearTimeout(copy.copyTimer);
            copy.copyTimer = setTimeout(function () {
              copy.setAttribute('aria-label', '复制代码');
              if (copyIcon) copyIcon.className = 'fa-regular fa-copy';
            }, 1600);
          }).catch(function () {
            /* 复制失败（浏览器不给权限）：不打扰用户 */
          });
        });
      }

      var lines = body.querySelectorAll('.chroma .line').length;
      if (!lines) {
        // 理论上高亮结果总有 .line；兜底按换行数算，别让折叠整块失灵
        lines = code ? code.textContent.split('\n').length : 0;
      }

      // 折行模式的行号槽按最大行号位数收窄，避免固定宽度留白过大
      win.style.setProperty('--code-line-digits', String(lines).length);

      // 自动换行开关：只在代码横向溢出时露出；等宽字体就绪后重测一次，
      // 字体切换会改变代码宽度。按钮一旦露出就保留，方便切回不换行
      var wrap = win.querySelector('.code-window-wrap');
      if (wrap) {
        var showWrap = function () {
          if (body.scrollWidth > body.clientWidth + 1) wrap.hidden = false;
        };
        showWrap();
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(showWrap);
        } else {
          window.addEventListener('load', showWrap, { once: true });
        }
        wrap.addEventListener('click', function () {
          var wrapped = win.classList.toggle('is-wrapped');
          wrap.setAttribute('aria-pressed', String(wrapped));
          wrap.setAttribute('aria-label', wrapped ? '关闭自动换行' : '开启自动换行');
        });
      }

      var fold = win.querySelector('.code-window-fold');
      var foldBtn = win.querySelector('.code-window-fold-btn');
      var barToggle = win.querySelector('.code-window-toggle');
      if (!fold || !foldBtn) return;
      if (lines <= LINE_LIMIT) return;

      // 底部折叠条与标题栏开关共用一套状态，点任意一个都同步另一处
      var toggles = [foldBtn];
      if (barToggle) toggles.push(barToggle);

      function setCollapsed(collapsed) {
        win.classList.toggle('is-collapsed', collapsed);
        toggles.forEach(function (btn) {
          btn.setAttribute('aria-expanded', String(!collapsed));
          btn.setAttribute('aria-label', collapsed ? '展开代码' : '收起代码');
        });
      }

      fold.hidden = false;
      if (barToggle) barToggle.hidden = false;
      setCollapsed(true);

      toggles.forEach(function (btn) {
        btn.addEventListener('click', function () {
          setCollapsed(!win.classList.contains('is-collapsed'));
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
      '.taxonomy-card',
      '.carousel',
      '.post-list > .post-card',
      '.moments-card',
      '.moments-comments',
      '.sidebar > .sidebar-card',
      '.pager',
      '.post-header',
      '.term-header',
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

  /**
   * 移动端抽屉菜单（DESIGN.md §6.9）
   *
   * 开合、遮罩、Esc / 焦点锁、body 滚动锁；页面 / 分类选项卡；
   * 页面树的可展开节点。≤768px 由 Header 左侧菜单按钮触发；
   * 桌面断点（≥769px）切换时自动收起，避免遮罩与滚动锁残留。
   *
   * 抽屉关闭时模板上的 inert 会让内部链接退出 Tab / 读屏树；
   * 打开 / 收起时这里同步维护，收起动画期间也不会留下可聚焦的隐藏链接。
   */
  function initMobileMenu() {
    var root = document.querySelector('[data-mobile-menu]');
    var toggle = document.querySelector('.menu-toggle');
    if (!root || !toggle || root.dataset.mobileMenuBound === 'true') return;
    root.dataset.mobileMenuBound = 'true';

    var panel = root.querySelector('.mobile-menu');
    var overlay = root.querySelector('.mobile-menu-overlay');
    var closeBtn = panel && panel.querySelector('.mobile-menu-close');
    if (!panel || !overlay) return;

    var lastFocus = null;
    var mq = window.matchMedia('(min-width: 769px)');

    function isOpen() {
      return panel.classList.contains('is-open');
    }

    function focusable() {
      var nodes = panel.querySelectorAll(
        'a[href]:not([tabindex="-1"]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      return Array.prototype.filter.call(nodes, function (el) {
        // offsetParent 过滤掉隐藏的分类面板；closest('[inert]') 过滤掉收起的子菜单
        return el.offsetParent !== null && !el.closest('[inert]');
      });
    }

    function open() {
      if (isOpen()) return;
      lastFocus = document.activeElement;
      panel.classList.add('is-open');
      overlay.classList.add('is-open');
      panel.removeAttribute('inert');
      panel.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('is-menu-open');

      // 等 visibility 生效后再移焦点，避免在不可见元素上聚焦失败
      window.requestAnimationFrame(function () {
        var target = closeBtn || panel;
        if (target) target.focus({ preventScroll: true });
      });
    }

    function close(opts) {
      opts = opts || {};
      if (!isOpen()) return;

      panel.classList.remove('is-open');
      overlay.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('is-menu-open');

      // 先把焦点移出去，再给面板加 inert / aria-hidden：
      // 否则焦点会短暂留在 aria-hidden 子树里，部分读屏会直接丢掉焦点
      if (opts.restoreFocus !== false) {
        var target = lastFocus && document.contains(lastFocus) ? lastFocus : toggle;
        if (target && typeof target.focus === 'function') {
          target.focus({ preventScroll: true });
        }
      }

      panel.setAttribute('inert', '');
      panel.setAttribute('aria-hidden', 'true');
    }

    toggle.addEventListener('click', function () {
      if (isOpen()) close();
      else open();
    });

    Array.prototype.forEach.call(root.querySelectorAll('[data-mobile-menu-close]'), function (el) {
      el.addEventListener('click', function () { close(); });
    });

    // 抽屉内是真实链接：跳转前先收起。外链新标签页也会回到菜单按钮
    Array.prototype.forEach.call(panel.querySelectorAll('a[href]'), function (link) {
      link.addEventListener('click', function () { close(); });
    });

    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      if (e.key !== 'Tab') return;

      var items = focusable();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      var active = document.activeElement;

      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // --- 页面 / 分类选项卡 ---
    var tabs = panel.querySelectorAll('[data-menu-tab]');
    var panes = panel.querySelectorAll('[data-menu-pane]');

    function activateTab(name) {
      Array.prototype.forEach.call(tabs, function (tab) {
        var active = tab.getAttribute('data-menu-tab') === name;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.setAttribute('tabindex', active ? '0' : '-1');
      });
      Array.prototype.forEach.call(panes, function (pane) {
        var active = pane.getAttribute('data-menu-pane') === name;
        pane.classList.toggle('is-active', active);
        pane.hidden = !active;
      });
    }

    Array.prototype.forEach.call(tabs, function (tab, index) {
      tab.addEventListener('click', function () {
        activateTab(tab.getAttribute('data-menu-tab'));
      });

      // 方向键切换选项卡（ARIA tabs 的键盘约定）
      tab.addEventListener('keydown', function (e) {
        var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        var next = tabs[(index + dir + tabs.length) % tabs.length];
        activateTab(next.getAttribute('data-menu-tab'));
        next.focus();
      });
    });

    // --- 页面树展开 / 收起 ---
    Array.prototype.forEach.call(panel.querySelectorAll('[data-menu-tree-toggle]'), function (btn) {
      btn.addEventListener('click', function () {
        var tree = btn.closest('[data-menu-tree]');
        if (!tree) return;

        var expanded = !tree.classList.contains('is-expanded');
        tree.classList.toggle('is-expanded', expanded);
        btn.setAttribute('aria-expanded', String(expanded));

        var body = tree.querySelector('.mobile-menu-tree-body');
        if (body) {
          if (expanded) body.removeAttribute('inert');
          else body.setAttribute('inert', '');
        }
      });
    });

    // 跨过桌面断点时自动收起
    function onMQ(e) {
      if (e.matches) close({ restoreFocus: false });
    }

    if (mq.addEventListener) mq.addEventListener('change', onMQ);
    else if (mq.addListener) mq.addListener(onMQ);
  }

  function init() {
    initThemeToggle();
    initPageBgMemory();
    initPageBgRestore();
    initFooterCover();
    initHeaderScroll();
    initMobileMenu();
    initFooterUptime();
    initClickableCards();
    initSocialCopy();
    initCodeWindows();
    initReveal();
  }

  init();

  // 供后续 Swup 生命周期复用
  window.inalineInit = init;
  // 搜索结果是运行时插入的卡片，渲染完后单独补一次整卡点击绑定
  window.inalineBindCards = initClickableCards;
})();
