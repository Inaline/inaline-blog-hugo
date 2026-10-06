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

  function init() {
    initThemeToggle();
    initHeaderScroll();
  }

  init();

  // 供后续 Swup 生命周期复用
  window.inalineInit = init;
})();
