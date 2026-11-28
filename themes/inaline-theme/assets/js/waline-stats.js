/**
 * Waline 数据回填（DESIGN.md §7.11）
 *
 * 全站加载（baseof 在 params.waline 可用时输出 data-waline-server），负责：
 *  1. 埋点：当前页阅读量、站点累计 / 今日访问、累计 / 今日访客
 *  2. 文章卡片：阅读量与评论量
 *  3. 侧栏：博主卡评论总数、近期评论
 *  4. 页脚：今日访客 / 今日访问 / 累计访客 / 累计访问
 *
 * 站点统计复用 Waline 的 Counter 表，但它的 SQLite 模型只持久化
 * time / reactionN，自定义字段不会落库，所以访客数也走 time，用路径区分：
 *   __site__                         累计访问
 *   __site__/visitors                累计访客（每个浏览器只 +1 一次）
 *   __site__/<YYYY-MM-DD>            今日访问
 *   __site__/<YYYY-MM-DD>/visitors   今日访客（每个浏览器每天 +1 一次）
 * 访客数只能靠 localStorage 近似去重；存储不可用时只统计访问量，不写访客数。
 *
 * 无 JS 时模板里的占位符（— / --）保持原样；请求失败只告警，不打扰阅读。
 */
(function () {
  'use strict';

  var body = document.body;
  var server = body && body.getAttribute('data-waline-server');
  if (!server || !window.InalineWaline) return;

  var client;
  try {
    client = window.InalineWaline.create({ server: server });
  } catch (error) {
    console.error('[waline-stats]', error);
    return;
  }

  var SITE_PATH = '__site__';
  var TOTAL_VISITOR_PATH = SITE_PATH + '/visitors';
  var TOTAL_VISITOR_KEY = 'inaline-visitor';
  var TODAY_VISITOR_KEY = 'inaline-visitor-day';
  var clock = null;

  // localStorage 在隐私模式下可能直接抛错：探测一次，后续只用这一份引用
  var storage = (function () {
    try {
      var key = '__inaline_test__';
      window.localStorage.setItem(key, '1');
      window.localStorage.removeItem(key);
      return window.localStorage;
    } catch (e) {
      return null;
    }
  })();

  function storeGet(key) {
    if (!storage) return null;
    try {
      return storage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storeSet(key, value) {
    if (!storage) return;
    try {
      storage.setItem(key, value);
    } catch (e) {
      /* 隐私模式下忽略：下次载入重新计数即好 */
    }
  }

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  /** 本地日期，用作"今日"统计的路径键 */
  function dateKey() {
    var date = new Date();
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function todayViewPath() {
    return SITE_PATH + '/' + dateKey();
  }

  function todayVisitorPath() {
    return todayViewPath() + '/visitors';
  }

  /** 千分位逗号：123 / 1,451 / 9,998（文章列表、页脚等局部数字） */
  function formatCount(value) {
    var number = Math.max(0, Math.floor(Number(value) || 0));
    return String(number).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * 侧栏汇总数字：< 10000 千分位逗号，更大用截断两位小数的 k / M。
   * 与 Hugo 的 format-number.html 同规则：15,340–15,349 都显示 15.34k。
   */
  function formatCompact(value) {
    var number = Math.max(0, Math.floor(Number(value) || 0));
    if (number < 10000) return formatCount(number);

    var base = number < 1000000 ? 1000 : 1000000;
    var hundredths = Math.floor(number / (base / 100));
    var whole = Math.floor(hundredths / 100);
    var fraction = hundredths % 100;
    return whole + '.' + (fraction < 10 ? '0' + fraction : String(fraction)) +
      (base === 1000 ? 'k' : 'M');
  }

  // -------------------------------------------------------------------------
  // 埋点：当前页 + 站点访问量；访客数按浏览器 / 天去重
  // -------------------------------------------------------------------------

  function track() {
    if (body.dataset.walineTracked === 'true') return Promise.resolve();
    body.dataset.walineTracked = 'true';

    var today = dateKey();
    var tasks = [
      client.increment(window.location.pathname, 'time'),
      client.increment(SITE_PATH, 'time'),
      client.increment(todayViewPath(), 'time')
    ];

    // 累计访客：一个浏览器只记一次。先 +1 再写标记，请求失败下次载入还会重试
    if (storage && !storeGet(TOTAL_VISITOR_KEY)) {
      tasks.push(client.increment(TOTAL_VISITOR_PATH, 'time').then(function () {
        storeSet(TOTAL_VISITOR_KEY, String(Date.now()));
      }));
    }

    // 今日访客：同一浏览器每天只记一次
    if (storage && storeGet(TODAY_VISITOR_KEY) !== today) {
      tasks.push(client.increment(todayVisitorPath(), 'time').then(function () {
        storeSet(TODAY_VISITOR_KEY, today);
      }));
    }

    return Promise.all(tasks.map(function (task) {
      return task.catch(function (error) {
        console.warn('[waline-stats] 埋点失败', error);
      });
    }));
  }

  // -------------------------------------------------------------------------
  // 页脚：四个站点数字
  // -------------------------------------------------------------------------

  function fillFooter() {
    var nodes = document.querySelectorAll('[data-footer-stat]');
    if (!nodes.length) return Promise.resolve();

    var paths = [SITE_PATH, TOTAL_VISITOR_PATH, todayViewPath(), todayVisitorPath()];
    return client.counters(paths, 'time').then(function (rows) {
      setFooter('today-visitors', rows[3].time);
      setFooter('today-views', rows[2].time);
      setFooter('total-visitors', rows[1].time);
      setFooter('total-views', rows[0].time);
    }, function (error) {
      console.warn('[waline-stats] 页脚统计加载失败', error);
    });
  }

  function setFooter(name, value) {
    var el = document.querySelector('[data-footer-stat="' + name + '"]');
    if (el) el.textContent = formatCount(value);
  }

  // -------------------------------------------------------------------------
  // 侧栏博主卡：全站评论总数
  // -------------------------------------------------------------------------

  function fillProfile() {
    var nodes = document.querySelectorAll('[data-sidebar-stat]');
    if (!nodes.length) return Promise.resolve();

    return client.count().then(function (total) {
      Array.prototype.forEach.call(nodes, function (el) {
        if (el.getAttribute('data-sidebar-stat') === 'comments') {
          el.textContent = formatCompact(total);
        }
      });
    }, function (error) {
      console.warn('[waline-stats] 评论总数加载失败', error);
    });
  }

  // -------------------------------------------------------------------------
  // 文章卡片：阅读量 + 评论量（同页所有卡片各发一次批量请求）
  // -------------------------------------------------------------------------

  function fillPostCards() {
    var cards = document.querySelectorAll('[data-post-card][data-post-path]');
    if (!cards.length) return Promise.resolve();

    var byPath = {};
    var paths = [];
    Array.prototype.forEach.call(cards, function (card) {
      var path = card.getAttribute('data-post-path');
      if (!path) return;
      if (!byPath[path]) {
        byPath[path] = [];
        paths.push(path);
      }
      byPath[path].push(card);
    });
    if (!paths.length) return Promise.resolve();

    function apply(stat, values) {
      paths.forEach(function (path, index) {
        byPath[path].forEach(function (card) {
          var el = card.querySelector('[data-post-stat="' + stat + '"]');
          if (el) el.textContent = formatCount(values[index]);
        });
      });
    }

    return Promise.all([
      client.count(paths).then(function (values) {
        apply('comments', values);
      }, function (error) {
        console.warn('[waline-stats] 卡片评论量加载失败', error);
      }),
      client.views(paths).then(function (values) {
        apply('views', values);
      }, function (error) {
        console.warn('[waline-stats] 卡片阅读量加载失败', error);
      })
    ]);
  }

  // -------------------------------------------------------------------------
  // 侧栏近期评论
  // -------------------------------------------------------------------------

  function initRecentComments() {
    var cards = document.querySelectorAll('[data-sidebar-comments]');
    Array.prototype.forEach.call(cards, function (card) {
      if (card.dataset.walineCommentsBound === 'true') return;
      card.dataset.walineCommentsBound = 'true';

      var list = card.querySelector('[data-sidebar-comment-list]');
      if (!list) return;

      var limit = parseInt(card.getAttribute('data-sidebar-comments-count'), 10);
      if (!isFinite(limit) || limit < 1) limit = 5;

      client.recent(limit).then(function (comments) {
        renderRecentComments(list, comments);
      }, function (error) {
        console.warn('[waline-stats] 近期评论加载失败', error);
        showListState(list, '评论加载失败');
      });
    });
  }

  function renderRecentComments(list, comments) {
    list.textContent = '';

    if (!comments.length) {
      showListState(list, '还没有评论，来抢沙发吧。');
      return;
    }

    comments.forEach(function (comment) {
      list.appendChild(renderRecentComment(comment));
    });
  }

  function renderRecentComment(comment) {
    var href = commentHref(comment);
    var item = document.createElement('li');
    var row = document.createElement(href ? 'a' : 'div');
    row.className = 'comment-item';
    if (href) row.href = href;

    row.appendChild(renderRecentAvatar(comment));

    var bodyEl = create('span', 'comment-body');
    var meta = create('span', 'comment-meta');
    meta.appendChild(create('span', 'comment-name', comment.nick || '匿名'));

    var ms = Number(comment.time);
    if (!isFinite(ms) || ms <= 0) ms = Date.now();

    var time = create('time', 'comment-time');
    time.dateTime = new Date(ms).toISOString();
    time.title = fullDate(ms);
    time.textContent = relativeTime(ms);
    time.setAttribute('data-waline-time', '');
    meta.appendChild(time);
    bodyEl.appendChild(meta);

    bodyEl.appendChild(create('span', 'comment-text', commentText(comment.comment)));
    row.appendChild(bodyEl);
    item.appendChild(row);
    return item;
  }

  /**
   * 评论所在文章 + 锚点。回复挂到顶层评论的锚点上，
   * 这样打开文章页时能落在整串对话的开头；Falsy / 非站内地址不生成链接。
   */
  function commentHref(comment) {
    var url = String(comment.url || '').split('#')[0];
    if (!url || !/^(https?:\/\/|\/)/i.test(url)) return '';
    var id = comment.rid || comment.objectId;
    return url + (id ? '#comment-' + id : '');
  }

  function renderRecentAvatar(comment) {
    var box = create('span', 'comment-avatar');
    box.setAttribute('aria-hidden', 'true');

    function fallback() {
      var name = String(comment.nick || '').trim();
      // Array.from 按码点取首字，昵称是 emoji 时不会截成半个代理对
      var first = Array.from ? Array.from(name)[0] : name.charAt(0);
      box.textContent = first || '?';
    }

    if (comment.avatar) {
      var img = document.createElement('img');
      img.src = comment.avatar;
      img.alt = '';
      img.loading = 'lazy';
      img.width = 32;
      img.height = 32;
      img.addEventListener('error', fallback, { once: true });
      box.appendChild(img);
    } else {
      fallback();
    }

    return box;
  }

  /** 评论正文是服务端渲染好的 HTML，这里只取纯文本放进两行摘要 */
  function commentText(html) {
    var holder = null;
    try {
      holder = new DOMParser().parseFromString(String(html || ''), 'text/html').body;
    } catch (e) {
      holder = null;
    }

    if (!holder) {
      return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    var text = (holder.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text && holder.querySelector('img')) text = '[表情]';
    return text;
  }

  function showListState(list, text) {
    list.textContent = '';
    var item = document.createElement('li');
    item.className = 'sidebar-comments-state';
    item.textContent = text;
    list.appendChild(item);
  }

  function refreshRecentTimes() {
    var times = document.querySelectorAll('[data-sidebar-comments] time[data-waline-time]');
    Array.prototype.forEach.call(times, function (time) {
      var ms = Date.parse(time.getAttribute('datetime'));
      if (!isNaN(ms)) time.textContent = relativeTime(ms);
    });
  }

  // -------------------------------------------------------------------------
  // 小工具（相对时间规则与 comment.js 一致）
  // -------------------------------------------------------------------------

  function create(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function relativeTime(ms) {
    var seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));

    if (seconds < 60) return '刚刚';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' 分钟前';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' 小时前';
    if (seconds < 604800) return Math.floor(seconds / 86400) + ' 天前';
    return formatDate(ms);
  }

  function formatDate(ms) {
    var date = new Date(ms);
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
  }

  function fullDate(ms) {
    var date = new Date(ms);
    return formatDate(ms) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  // -------------------------------------------------------------------------
  // 启动
  // -------------------------------------------------------------------------

  function init() {
    // 页脚数字依赖刚写进去的本次访问，等埋点完成再取
    track().then(fillFooter);
    fillProfile();
    fillPostCards();
    initRecentComments();

    // 页面停留时相对时间继续走；重复 init 不叠加定时器
    if (!clock) clock = setInterval(refreshRecentTimes, 60000);
  }

  init();

  // 与 main.js / comment.js 的约定一致：后续接入 Swup 时由页面生命周期再次调用
  window.inalineWalineStatsInit = init;
})();
