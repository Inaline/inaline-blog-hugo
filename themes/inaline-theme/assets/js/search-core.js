/**
 * 搜索核心（DESIGN.md §7.15）
 *
 * 数据：Hugo 构建时在 /index.json 输出 posts + moments。
 * 引擎：Fuse.js v7（本地 vendor），多词按 AND 过滤，字段权重见 OPTIONS。
 * 搜索页与全屏浮层共用 load() / search() / createCard()。
 *
 * 索引第一次调用时懒加载，之后缓存；Fuse 实例只建一次。
 * 搜索方案尚未接后端，完全在浏览器内完成。
 */
(function () {
  'use strict';

  var indexPromise = null;
  var fuse = null;
  var docs = [];

  var OPTIONS = {
    includeScore: true,
    includeMatches: true,
    ignoreLocation: true,
    threshold: 0.3,
    minMatchCharLength: 1,
    keys: [
      { name: 'title', weight: 0.45 },
      { name: 'tagsText', weight: 0.2 },
      { name: 'categoriesText', weight: 0.15 },
      { name: 'summary', weight: 0.1 },
      { name: 'content', weight: 0.1 }
    ]
  };

  function indexURL() {
    var link = document.querySelector('link[rel="search"]');
    return link ? link.getAttribute('href') : '/index.json';
  }

  function normalize(value) {
    return (value || '').toString().toLowerCase();
  }

  function load() {
    if (indexPromise) return indexPromise;
    indexPromise = fetch(indexURL(), { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('search index request failed');
        return res.json();
      })
      .then(function (data) {
        if (typeof window.Fuse !== 'function') throw new Error('Fuse.js missing');
        docs = (data && data.docs) || [];
        fuse = new window.Fuse(docs, OPTIONS);
        return docs;
      });
    return indexPromise;
  }

  function search(query) {
    var q = (query || '').trim();
    if (!q) return Promise.resolve([]);

    return load().then(function () {
      var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      // Fuse 的多词默认不保证 AND，这里再按“每个词都出现”过滤一遍；
      // 中文没有空格时就是一个词，直接做子串匹配。
      return fuse.search(q).filter(function (result) {
        var doc = result.item;
        var hay = normalize([
          doc.title,
          doc.summary,
          doc.content,
          doc.tagsText,
          doc.categoriesText
        ].join(' '));
        return terms.every(function (term) {
          return hay.indexOf(term) !== -1;
        });
      });
    });
  }

  // --- 结果卡（首页 .post-card 同款）-------------------------------------

  function rangesFor(result, key) {
    if (!result.matches) return [];
    var match = null;
    for (var i = 0; i < result.matches.length; i++) {
      if (result.matches[i].key === key) {
        match = result.matches[i];
        break;
      }
    }
    if (!match || !match.indices) return [];
    return match.indices.slice().sort(function (a, b) { return a[0] - b[0]; });
  }

  function appendHighlighted(parent, text, ranges) {
    var value = text || '';
    if (!ranges.length) {
      parent.appendChild(document.createTextNode(value));
      return;
    }

    var pos = 0;
    ranges.forEach(function (range) {
      var start = Math.max(0, range[0]);
      var end = Math.min(value.length - 1, range[1]);
      if (end < pos) return;
      if (start < pos) start = pos;
      if (start > pos) parent.appendChild(document.createTextNode(value.slice(pos, start)));
      var mark = document.createElement('mark');
      mark.className = 'search-mark';
      mark.textContent = value.slice(start, end + 1);
      parent.appendChild(mark);
      pos = end + 1;
    });
    if (pos < value.length) parent.appendChild(document.createTextNode(value.slice(pos)));
  }

  function createCard(result, index) {
    var doc = result.item;
    var isMoment = doc.type === 'moment';
    var categories = Array.isArray(doc.categories) ? doc.categories : [];
    var typeLabel = isMoment ? '动态' : (categories[0] || '文章');
    var typeIcon = isMoment ? 'fa-regular fa-comment-dots' : 'fa-regular fa-folder-open';
    var summary = doc.summary || (doc.content || '').slice(0, 120);

    var card = document.createElement('article');
    card.className = 'post-card' + (index % 2 ? ' post-card--flip' : '');
    card.setAttribute('data-card-href', doc.url);

    var cover = document.createElement('a');
    cover.className = 'post-card-cover';
    cover.href = doc.url;
    cover.tabIndex = -1;
    cover.setAttribute('aria-hidden', 'true');
    if (doc.cover) {
      var img = document.createElement('img');
      img.src = doc.cover;
      img.alt = '';
      img.loading = 'lazy';
      img.width = 300;
      img.height = 200;
      cover.appendChild(img);
    }
    card.appendChild(cover);

    var body = document.createElement('div');
    body.className = 'post-card-body';

    var meta = document.createElement('div');
    meta.className = 'post-card-meta';

    function metaItem(icon, node) {
      var span = document.createElement('span');
      span.className = 'post-card-meta-item';
      var i = document.createElement('i');
      i.className = icon;
      i.setAttribute('aria-hidden', 'true');
      span.appendChild(i);
      span.appendChild(node);
      return span;
    }

    var type = document.createElement('span');
    type.className = 'search-result-type';
    type.textContent = typeLabel;
    meta.appendChild(metaItem(typeIcon, type));

    var date = document.createElement('time');
    date.dateTime = doc.date;
    date.textContent = doc.dateText;
    meta.appendChild(metaItem('fa-regular fa-calendar', date));

    var read = document.createElement('span');
    read.textContent = (doc.minutes || 1) + ' 分钟';
    meta.appendChild(metaItem('fa-regular fa-clock', read));

    body.appendChild(meta);

    var title = document.createElement('h2');
    title.className = 'post-card-title';
    var titleLink = document.createElement('a');
    titleLink.href = doc.url;
    appendHighlighted(titleLink, doc.title, rangesFor(result, 'title'));
    title.appendChild(titleLink);
    body.appendChild(title);

    if (summary) {
      var summaryEl = document.createElement('p');
      summaryEl.className = 'post-card-summary';
      appendHighlighted(summaryEl, summary, rangesFor(result, 'summary'));
      body.appendChild(summaryEl);
    }

    card.appendChild(body);
    return card;
  }

  function bindCards() {
    if (typeof window.inalineBindCards === 'function') window.inalineBindCards();
  }

  window.inalineSearchCore = {
    load: load,
    search: search,
    createCard: createCard,
    bindCards: bindCards
  };
})();
