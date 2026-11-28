/**
 * 搜索页（DESIGN.md §7.15）
 *
 * 默认空态；输入变化 300ms 防抖后用 Fuse.js 搜索（共用 search-core.js）。
 * 结果沿用首页 .post-card，前端每页 10 篇分页；?q= 用于承接浮层跳转。
 * 分页翻页不改变 URL。
 */
(function () {
  'use strict';

  var DEBOUNCE = 300;

  function init() {
    var input = document.querySelector('[data-search-page-input]');
    var page = document.querySelector('[data-search-page]');
    if (!input || !page) return;

    var results = page.querySelector('[data-search-page-results]');
    var empty = page.querySelector('[data-search-page-empty]');
    var list = page.querySelector('[data-search-page-list]');
    var pager = page.querySelector('[data-search-page-pager]');
    var count = page.querySelector('[data-search-page-count]');
    var status = page.querySelector('[data-search-page-status]');
    var core = window.inalineSearchCore;
    if (!results || !empty || !list) return;

    var allResults = [];
    var pageSize = parseInt(list.getAttribute('data-page-size'), 10) || 10;
    var current = 1;
    var timer = null;
    var searchToken = 0;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function readQuery() {
      try {
        return (new URLSearchParams(window.location.search).get('q') || '').trim();
      } catch (e) {
        return '';
      }
    }

    function writeQuery(q) {
      try {
        var url = new URL(window.location.href);
        if (q) url.searchParams.set('q', q);
        else url.searchParams.delete('q');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      } catch (e) {
        /* 隐私模式 / 旧浏览器：忽略 URL 同步 */
      }
    }

    function setStatus(text) {
      if (!status) return;
      status.textContent = text || '';
      status.hidden = !text;
    }

    function hidePager() {
      if (pager) {
        pager.hidden = true;
        pager.innerHTML = '';
      }
    }

    function totalPages() {
      return Math.max(1, Math.ceil(allResults.length / pageSize));
    }

    function scrollToResults() {
      results.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'start'
      });
    }

    function stepLink(pageNo, icon, label) {
      var a = document.createElement('a');
      a.className = 'pager-link pager-link--step';
      a.href = '#';
      a.setAttribute('aria-label', label);
      a.innerHTML = '<i class="fa-solid ' + icon + '" aria-hidden="true"></i>';
      a.addEventListener('click', function (e) {
        e.preventDefault();
        go(pageNo);
      });
      return a;
    }

    function buildPager() {
      if (!pager) return;
      var pages = totalPages();
      pager.innerHTML = '';
      if (pages <= 1) {
        pager.hidden = true;
        return;
      }
      pager.hidden = false;
      if (current > 1) pager.appendChild(stepLink(current - 1, 'fa-chevron-left', '上一页'));
      for (var i = 1; i <= pages; i++) {
        if (i === current) {
          var span = document.createElement('span');
          span.className = 'pager-link is-current';
          span.setAttribute('aria-current', 'page');
          span.textContent = String(i);
          pager.appendChild(span);
        } else {
          (function (pageNo) {
            var a = document.createElement('a');
            a.className = 'pager-link';
            a.href = '#';
            a.textContent = String(pageNo);
            a.addEventListener('click', function (e) {
              e.preventDefault();
              go(pageNo);
            });
            pager.appendChild(a);
          })(i);
        }
      }
      if (current < pages) pager.appendChild(stepLink(current + 1, 'fa-chevron-right', '下一页'));
    }

    function render(scroll) {
      list.textContent = '';
      if (count) count.textContent = '共 ' + allResults.length + ' 条';

      if (!allResults.length) {
        setStatus('没有找到相关内容');
        hidePager();
        return;
      }

      setStatus('');
      var start = (current - 1) * pageSize;
      var end = Math.min(start + pageSize, allResults.length);
      for (var i = start; i < end; i++) {
        list.appendChild(core.createCard(allResults[i], i - start));
      }
      core.bindCards();
      buildPager();
      if (scroll) scrollToResults();
    }

    function go(pageNo) {
      current = Math.min(Math.max(1, pageNo), totalPages());
      render(true);
    }

    function showShell() {
      results.hidden = false;
      empty.hidden = true;
      list.textContent = '';
      hidePager();
    }

    function runSearch(query) {
      if (!core) {
        showShell();
        setStatus('搜索组件加载失败');
        return;
      }

      var token = ++searchToken;
      showShell();
      setStatus('正在搜索…');

      core.search(query).then(function (data) {
        if (token !== searchToken) return;
        allResults = data;
        current = 1;
        writeQuery(query);
        render(false);
      }).catch(function () {
        if (token !== searchToken) return;
        allResults = [];
        current = 1;
        list.textContent = '';
        hidePager();
        if (count) count.textContent = '共 0 条';
        setStatus('搜索索引加载失败，请稍后再试');
      });
    }

    function hideResults() {
      searchToken++;
      window.clearTimeout(timer);
      results.hidden = true;
      empty.hidden = false;
      list.textContent = '';
      allResults = [];
      current = 1;
      hidePager();
      setStatus('');
      if (count) count.textContent = '共 0 条';
      writeQuery('');
    }

    function onInput() {
      window.clearTimeout(timer);
      var query = input.value.trim();
      if (!query) {
        hideResults();
        return;
      }
      timer = window.setTimeout(function () {
        runSearch(query);
      }, DEBOUNCE);
    }

    input.addEventListener('input', onInput);

    if (core) core.load().catch(function () {});

    var initial = readQuery();
    if (initial) {
      input.value = initial;
      runSearch(initial);
    } else {
      hideResults();
    }
  }

  init();
  window.inalineSearchPageInit = init;
})();
