// 文章页专用脚本（DESIGN.md §4.3 / §8.5：侧栏目录）
(function () {
  'use strict';

  var ACTIVATION_OFFSET = 24; // 标题顶边越过 Header 底部后再留一点，避免压线时来回跳
  var reducedMotion = window.matchMedia &&
                      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // -------------------------------------------------------------------------
  // 侧栏目录
  //
  // 三件事共用一个滚动节流：
  //  1. 高亮当前章节——按文档顺序找最后一个越过激活线的标题
  //  2. 折叠状态——只展开当前项所在分支，其余父项收起（参考站逻辑）
  //  3. 阅读进度——视口中线已经读过的正文比例，写到标题行右侧
  // 目录树由 Hugo 构建时生成，这里只切 class，不生成任何 DOM。
  // -------------------------------------------------------------------------
  function initToc() {
    var card = document.querySelector('.sidebar-toc');
    if (!card || card.dataset.tocBound === 'true') return;

    var nav = card.querySelector('.article-toc');
    var links = card.querySelectorAll('.toc-link[href^="#"]');
    if (!nav || !links.length) return;
    card.dataset.tocBound = 'true';

    var entries = [];
    Array.prototype.forEach.call(links, function (link) {
      var id = link.getAttribute('href').slice(1);
      try {
        id = decodeURIComponent(id); // 链接里的中文 / 特殊字符是百分号编码的
      } catch (e) {
        /* 非法的百分号编码：按原样查 */
      }
      var heading = document.getElementById(id);
      // 标题被删 / id 对不上时跳过，一个坏链接不该拖住整份目录
      if (heading) entries.push({ heading: heading, link: link });
    });
    if (!entries.length) return;

    var header = document.querySelector('.site-header');
    var article = document.querySelector('.post-content .markdown');
    var progress = card.querySelector('.toc-progress');
    var current = null;
    var ticking = false;

    // 直接子列表（不含更深层），用来切换当前项的展开态
    function directSubList(item) {
      var el = item.firstElementChild;
      while (el) {
        if (el.classList.contains('toc-sub-list')) return el;
        el = el.nextElementSibling;
      }
      return null;
    }

    function setExpanded(item, expanded) {
      var list = directSubList(item);
      if (!list) return;
      // 焦点还在子列表里时不收起：inert 会把正在聚焦的链接直接踢掉
      if (!expanded && list.contains(document.activeElement)) return;

      list.classList.toggle('expanded', expanded);
      // 折叠时一并移出可访问性树与 Tab 序，别让键盘 / 读屏进到看不见的条目
      if (expanded) {
        list.removeAttribute('inert');
      } else {
        list.setAttribute('inert', '');
      }

      var btn = item.querySelector('.toc-item-toggle');
      if (btn) {
        btn.classList.toggle('collapsed', !expanded);
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        btn.setAttribute('aria-label', expanded ? '折叠子目录' : '展开子目录');
      }
    }

    // 展开某链接所在项及其所有祖先
    function expandBranch(link) {
      var item = link.closest('.toc-item');
      while (item) {
        setExpanded(item, true);
        item = item.parentElement ? item.parentElement.closest('.toc-item') : null;
      }
    }

    // 只保留当前分支展开，其余父项收起（参考站的自动折叠逻辑）
    function syncBranches(link) {
      if (!link) return;

      var keep = [];
      var item = link.closest('.toc-item');
      while (item) {
        keep.push(item);
        item = item.parentElement ? item.parentElement.closest('.toc-item') : null;
      }

      var parents = nav.querySelectorAll('.toc-item.has-children');
      Array.prototype.forEach.call(parents, function (parent) {
        setExpanded(parent, keep.indexOf(parent) !== -1);
      });
    }

    // 目录列表比可视区高时，把当前项滚到列表中间
    function centerInToc(link) {
      if (nav.scrollHeight <= nav.clientHeight) return;

      var navRect = nav.getBoundingClientRect();
      var linkRect = link.getBoundingClientRect();
      var target = nav.scrollTop + (linkRect.top - navRect.top) -
                   (navRect.height / 2) + (linkRect.height / 2);

      if (!reducedMotion && nav.scrollTo) {
        nav.scrollTo({ top: target, behavior: 'smooth' });
      } else {
        nav.scrollTop = target;
      }
    }

    function setActive(entry) {
      if (entry === current) return;

      if (current) {
        current.link.classList.remove('is-active');
        current.link.removeAttribute('aria-current');
      }

      current = entry;
      if (entry) {
        entry.link.classList.add('is-active');
        entry.link.setAttribute('aria-current', 'location');
        syncBranches(entry.link);
        centerInToc(entry.link);
      }
    }

    // 阅读进度：视口中线走过的正文比例（与参考站一致）
    function updateProgress() {
      if (!progress || !article) return;

      var rect = article.getBoundingClientRect();
      var top = rect.top + window.scrollY;
      var height = rect.height;
      if (height <= 0) return;

      var read = Math.max(0, Math.min(window.scrollY + window.innerHeight / 2 - top, height));
      progress.textContent = Math.round((read / height) * 100) + '%';
    }

    function activationLine() {
      return (header ? header.offsetHeight : 56) + ACTIVATION_OFFSET;
    }

    function update() {
      ticking = false;

      var line = activationLine();
      var active = null;
      var i;
      for (i = 0; i < entries.length; i++) {
        if (entries[i].heading.getBoundingClientRect().top > line) break;
        active = entries[i];
      }

      // 滚到底时最后一个短章节可能还没越过激活线，但读者确实已经在看它了。
      // 页面本来就装得下、无需滚动时不适用——那会把最后一项误点亮
      var doc = document.documentElement;
      if (doc.scrollHeight > window.innerHeight &&
          window.innerHeight + window.scrollY >= doc.scrollHeight - 2) {
        active = entries[entries.length - 1];
      }

      setActive(active);
      updateProgress();
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    // 折叠按钮：手动开合；后续滚动时若它不在当前分支，会被自动收起
    var toggles = card.querySelectorAll('.toc-item-toggle');
    Array.prototype.forEach.call(toggles, function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.toc-item');
        var list = item ? directSubList(item) : null;
        if (!list) return;
        setExpanded(item, !list.classList.contains('expanded'));
      });
    });

    // 点击目录项：展开目标所在分支并立即点亮；
    // 跳转仍走原生锚点，落点由标题上的 scroll-margin-top 让开 fixed Header
    Array.prototype.forEach.call(entries, function (entry) {
      entry.link.addEventListener('click', function () {
        expandBranch(entry.link);
        setActive(entry);
      });
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('load', update);

    update(); // 带 #hash 打开 / 刷新后可能已经在文中
  }

  function init() {
    initToc();
  }

  init();

  // 与 main.js 的约定一致：暴露给后续 Swup 的 page:view 生命周期复用
  window.inalinePageInit = init;
})();
