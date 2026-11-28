/**
 * 全屏搜索浮层（DESIGN.md §7.15）
 *
 * 交互：
 *  - 点击 Header 搜索按钮：浮层打开，搜索框在视口中央，不自动聚焦；
 *  - 点击 / 聚焦搜索框：搜索框上移到顶部，结果区暂不展示；
 *  - 输入变化 300ms 防抖后：展示结果区（首页同款文章卡，最多 5 条）；
 *  - ⌘ / Ctrl K：打开并直接聚焦输入框；Esc / 关闭按钮 / 点浮层空白收起；
 *  - 关闭 / 重新打开时清空输入并复位到居中初态。
 *
 * 搜索索引尚未接入（⏳）：结果区先用最近 5 篇文章占位；输入只负责触发
 * 展示，不做真实过滤。接入后替换列表数据即可，交互骨架不变。
 *
 * 事件用 dataset.bound 防重复绑定；后续接入 Swup 时在 page:view 再调用
 * window.inalineSearchInit 即可。
 */
(function () {
  'use strict';

  var DEBOUNCE = 300;

  function init() {
    var overlay = document.getElementById('search-overlay');
    var trigger = document.querySelector('.search-toggle');
    if (!overlay || !trigger || trigger.dataset.searchBound === 'true') return;
    trigger.dataset.searchBound = 'true';

    var input = overlay.querySelector('[data-search-input]');
    var field = overlay.querySelector('.search-field');
    var results = overlay.querySelector('[data-search-results]');
    var moreLink = overlay.querySelector('[data-search-more]');
    var moreBase = moreLink ? moreLink.getAttribute('href') : '';
    var closers = overlay.querySelectorAll('[data-search-close]');
    var lastFocus = null;
    var timer = null;

    // 「查看全部文章」带上当前输入，交给搜索页读取 ?q=
    function updateMore(query) {
      if (!moreLink || !moreBase) return;
      var base = moreBase.split('?')[0];
      moreLink.setAttribute('href', query ? base + '?q=' + encodeURIComponent(query) : moreBase);
    }

    function focusable() {
      var nodes = overlay.querySelectorAll(
        'a[href]:not([tabindex="-1"]), button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      return Array.prototype.filter.call(nodes, function (el) {
        return el.offsetParent !== null;
      });
    }

    function reset() {
      window.clearTimeout(timer);
      overlay.classList.remove('is-active');
      overlay.scrollTop = 0;
      if (input) input.value = '';
      if (results) results.hidden = true;
      updateMore('');
    }

    function open(opts) {
      opts = opts || {};
      if (!overlay.hidden) {
        if (opts.focusInput && input) input.focus({ preventScroll: true });
        return;
      }

      lastFocus = document.activeElement;
      reset();
      overlay.hidden = false;
      document.body.classList.add('search-open');
      trigger.setAttribute('aria-expanded', 'true');

      window.requestAnimationFrame(function () {
        if (opts.focusInput && input) {
          // ⌘ / Ctrl K：直接进入输入态（搜索框上移）
          overlay.classList.add('is-active');
          input.focus({ preventScroll: true });
        } else {
          // 点击入口：保持居中初态，焦点先落在浮层本身
          overlay.focus({ preventScroll: true });
        }
      });
    }

    function close() {
      if (overlay.hidden) return;
      window.clearTimeout(timer);
      overlay.hidden = true;
      document.body.classList.remove('search-open');
      trigger.setAttribute('aria-expanded', 'false');
      reset();
      var target = lastFocus && document.contains(lastFocus) ? lastFocus : trigger;
      if (target && typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    }

    function scheduleResults() {
      window.clearTimeout(timer);
      var query = input ? input.value.trim() : '';
      if (!query) {
        if (results) results.hidden = true;
        return;
      }
      timer = window.setTimeout(function () {
        if (results) results.hidden = false;
      }, DEBOUNCE);
    }

    if (input) {
      input.addEventListener('focus', function () {
        overlay.classList.add('is-active');
      });
      input.addEventListener('input', function () {
        updateMore(input.value.trim());
        scheduleResults();
      });
    }

    // 点胶囊内除关闭按钮外的任何空白 / 图标都聚焦输入框
    if (field) {
      field.addEventListener('click', function (e) {
        if (!input || e.target.closest('[data-search-close]')) return;
        input.focus({ preventScroll: true });
      });
    }

    trigger.addEventListener('click', function () {
      if (overlay.hidden) open();
      else close();
    });

    Array.prototype.forEach.call(closers, function (btn) {
      btn.addEventListener('click', close);
    });

    // 点击浮层空白（结果区 / 胶囊之外的区域）收起
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open({ focusInput: true });
        return;
      }

      if (overlay.hidden) return;

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

      if (e.shiftKey && (active === first || active === overlay)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  init();
  window.inalineSearchInit = init;
})();
