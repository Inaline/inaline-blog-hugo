/**
 * 搜索页（DESIGN.md §7.15）
 *
 * 默认只显示空态；输入变化 300ms 防抖后展开结果。
 * 搜索索引尚未接入（⏳）：结果仍是全部文章占位，前端每页 10 篇分页；
 * 接入后把真实结果交给同一套列表 / 分页即可。
 *
 * URL 的 ?q= 用来承接浮层「查看全部文章」带过来的关键词：页面加载时回填输入框
 * 并直接展开结果；用户输入 / 清空时同步写回 URL。分页翻页不改变 URL。
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
    if (!results || !empty || !list) return;

    var cards = Array.prototype.slice.call(list.querySelectorAll('.post-card'));
    var total = cards.length;
    var pageSize = parseInt(list.getAttribute('data-page-size'), 10) || 10;
    var current = 1;
    var timer = null;
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

    function totalPages() {
      return Math.max(1, Math.ceil(total / pageSize));
    }

    function applyPage() {
      var start = (current - 1) * pageSize;
      var end = start + pageSize;
      cards.forEach(function (card, i) {
        card.hidden = i < start || i >= end;
      });
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

    function go(pageNo) {
      current = Math.min(Math.max(1, pageNo), totalPages());
      applyPage();
      buildPager();
      scrollToResults();
    }

    function renderPage() {
      applyPage();
      buildPager();
      if (count) count.textContent = '共 ' + total + ' 篇';
    }

    function showResults(q) {
      results.hidden = false;
      empty.hidden = true;
      current = 1;
      renderPage();
      if (q) writeQuery(q);
    }

    function hideResults() {
      results.hidden = true;
      empty.hidden = false;
      current = 1;
      if (pager) {
        pager.hidden = true;
        pager.innerHTML = '';
      }
      writeQuery('');
    }

    function onInput() {
      window.clearTimeout(timer);
      var q = input.value.trim();
      if (!q) {
        hideResults();
        return;
      }
      timer = window.setTimeout(function () {
        showResults(q);
      }, DEBOUNCE);
    }

    input.addEventListener('input', onInput);

    var initial = readQuery();
    if (initial) {
      input.value = initial;
      showResults(initial);
    } else {
      hideResults();
    }
  }

  init();
  window.inalineSearchPageInit = init;
})();
