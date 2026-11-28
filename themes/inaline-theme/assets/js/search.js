/**
 * 全屏搜索浮层（DESIGN.md §7.15）
 *
 * 交互：
 *  - 点击 Header 搜索按钮：浮层打开，搜索框在视口中央，不自动聚焦；
 *  - 点击 / 聚焦搜索框：搜索框上移到顶部；
 *  - 输入变化 300ms 防抖后：Fuse.js 搜索 /index.json，展示最多 5 条结果；
 *  - ⌘ / Ctrl K：打开并直接聚焦输入框；Esc / 关闭按钮 / 点浮层空白收起；
 *  - 关闭 / 重新打开时清空输入并复位到居中初态。
 *
 * 索引懒加载（打开时就预取），之后与 /search/ 页共用缓存；
 * 结果卡由 search-core.js 渲染，沿用首页 .post-card。
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
    var list = overlay.querySelector('[data-search-result-list]');
    var status = overlay.querySelector('[data-search-status]');
    var moreWrap = overlay.querySelector('[data-search-more-wrap]');
    var moreLink = overlay.querySelector('[data-search-more]');
    var moreBase = moreLink ? moreLink.getAttribute('href') : '';
    var closers = overlay.querySelectorAll('[data-search-close]');
    var core = window.inalineSearchCore;
    var lastFocus = null;
    var timer = null;
    var searchToken = 0;

    function focusable() {
      var nodes = overlay.querySelectorAll(
        'a[href]:not([tabindex="-1"]), button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      return Array.prototype.filter.call(nodes, function (el) {
        return el.offsetParent !== null;
      });
    }

    function updateMore(query) {
      if (!moreLink || !moreBase) return;
      var base = moreBase.split('?')[0];
      moreLink.setAttribute('href', query ? base + '?q=' + encodeURIComponent(query) : moreBase);
    }

    function setStatus(text) {
      if (!status) return;
      status.textContent = text || '';
      status.hidden = !text;
    }

    function hideMore() {
      if (moreWrap) moreWrap.hidden = true;
    }

    function clearResults() {
      if (list) list.textContent = '';
      setStatus('');
      hideMore();
    }

    function hideResults() {
      searchToken++;
      window.clearTimeout(timer);
      if (results) results.hidden = true;
      clearResults();
      updateMore('');
    }

    function showResults(resultsData, query) {
      if (!results || !list) return;
      results.hidden = false;
      list.textContent = '';
      setStatus('');
      hideMore();

      if (!resultsData.length) {
        setStatus('没有找到相关内容');
        return;
      }

      var limit = Math.min(resultsData.length, 5);
      for (var i = 0; i < limit; i++) {
        list.appendChild(core.createCard(resultsData[i], i));
      }
      if (moreWrap) moreWrap.hidden = false;
      updateMore(query);
      core.bindCards();
    }

    function runSearch(query) {
      if (!core) {
        setStatus('搜索组件加载失败');
        results.hidden = false;
        return;
      }
      var token = ++searchToken;
      results.hidden = false;
      list.textContent = '';
      hideMore();
      setStatus('正在搜索…');

      core.search(query).then(function (resultsData) {
        if (token !== searchToken || overlay.hidden) return;
        showResults(resultsData, query);
      }).catch(function () {
        if (token !== searchToken || overlay.hidden) return;
        list.textContent = '';
        hideMore();
        setStatus('搜索索引加载失败，请稍后再试');
      });
    }

    function scheduleSearch() {
      window.clearTimeout(timer);
      var query = input ? input.value.trim() : '';
      updateMore(query);

      if (!query) {
        hideResults();
        return;
      }

      timer = window.setTimeout(function () {
        runSearch(query);
      }, DEBOUNCE);
    }

    function reset() {
      searchToken++;
      window.clearTimeout(timer);
      overlay.classList.remove('is-active');
      overlay.scrollTop = 0;
      if (input) input.value = '';
      if (results) results.hidden = true;
      clearResults();
      updateMore('');
    }

    function preload() {
      if (core) core.load().catch(function () {});
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
      preload();

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
      overlay.hidden = true;
      document.body.classList.remove('search-open');
      trigger.setAttribute('aria-expanded', 'false');
      reset();
      var target = lastFocus && document.contains(lastFocus) ? lastFocus : trigger;
      if (target && typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    }

    if (input) {
      input.addEventListener('focus', function () {
        overlay.classList.add('is-active');
      });
      input.addEventListener('input', scheduleSearch);
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
