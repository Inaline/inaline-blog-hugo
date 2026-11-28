/**
 * 动态列表页专用脚本（DESIGN.md §7.14）
 *
 * 动态卡不整卡跳转，但评论区仍值得在列表里露一眼：每条动态下只展示
 * 最新 5 条评论（昵称 + 纯文本内容），没有评论的动态保持隐藏。
 *
 * 过程：
 *  1. 收集所有 [data-moment-comments] 的评论路径；
 *  2. 用 count 批量判断哪些动态有评论，没有的不发后续请求；
 *  3. 对有评论的动态各请求一页评论（顶层 + 一层回复），按时间倒序取最新 5 条。
 *
 * 评论正文是服务端渲染的 HTML，这里只取纯文本写进 textContent，
 * 不生成任何 HTML，避免把用户内容当结构注入。
 */
(function () {
  'use strict';

  var PREVIEW_LIMIT = 5;
  // 顶层评论取一页：回复挂在父评论的 children 里，一页足够凑出 5 条预览
  var FETCH_PAGE_SIZE = 10;

  function create(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /** 评论 HTML → 单行纯文本；只有图片时给一个可读占位 */
  function commentText(html) {
    var holder = null;
    try {
      holder = new DOMParser().parseFromString(String(html || ''), 'text/html').body;
    } catch (error) {
      holder = null;
    }

    if (!holder) {
      return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // 评论内容由 Waline 清洗过；这里仍只认文本，脚本 / 样式一并丢掉
    Array.prototype.forEach.call(holder.querySelectorAll('script, style'), function (node) {
      node.remove();
    });

    // textContent 不会在块边界补空格（<p>a</p><p>b</p> 会变成 "ab"），
    // 手动补一补，预览里的多段评论才读得顺
    Array.prototype.forEach.call(holder.querySelectorAll('br'), function (node) {
      node.replaceWith(document.createTextNode(' '));
    });
    Array.prototype.forEach.call(
      holder.querySelectorAll('p, div, li, blockquote, pre, h1, h2, h3, h4, h5, h6, tr'),
      function (node) {
        node.appendChild(document.createTextNode(' '));
      }
    );

    var text = (holder.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text && holder.querySelector('img')) text = '[图片]';
    return text;
  }

  /** 顶层评论 + 一层回复压平；详情页也只展示一层回复 */
  function flatten(comments) {
    var flat = [];
    (comments || []).forEach(function (comment) {
      flat.push(comment);
      if (Array.isArray(comment.children)) {
        comment.children.forEach(function (reply) {
          flat.push(reply);
        });
      }
    });
    return flat;
  }

  function renderPreview(box, comments) {
    var items = flatten(comments)
      .sort(function (a, b) {
        // 最新在前：Waline 的 time 是毫秒时间戳
        return (Number(b && b.time) || 0) - (Number(a && a.time) || 0);
      })
      .slice(0, PREVIEW_LIMIT);

    if (!items.length) return;

    box.textContent = '';
    items.forEach(function (comment) {
      var row = document.createElement('div');
      row.className = 'moment-comment';
      row.appendChild(create('span', 'moment-comment-user', comment.nick || '匿名'));
      row.appendChild(document.createTextNode('：'));
      row.appendChild(create('span', 'moment-comment-text', commentText(comment.comment)));
      box.appendChild(row);
    });

    box.hidden = false;
  }

  function init() {
    var body = document.body;
    var server = body && body.getAttribute('data-waline-server');
    if (!server || !window.InalineWaline) return;

    var boxes = document.querySelectorAll('[data-moment-comments]');
    if (!boxes.length) return;

    var client;
    try {
      client = window.InalineWaline.create({ server: server });
    } catch (error) {
      console.error('[moments]', error);
      return;
    }

    var byPath = {};
    var paths = [];

    Array.prototype.forEach.call(boxes, function (box) {
      if (box.dataset.momentCommentsBound === 'true') return;
      box.dataset.momentCommentsBound = 'true';

      var path = box.getAttribute('data-comment-path');
      if (!path) return;
      if (!byPath[path]) {
        byPath[path] = [];
        paths.push(path);
      }
      byPath[path].push(box);
    });

    if (!paths.length) return;

    client.count(paths).then(function (counts) {
      paths.forEach(function (path, index) {
        if (!(counts[index] > 0)) return;

        client.list({
          path: path,
          page: 1,
          pageSize: FETCH_PAGE_SIZE,
          sort: 'newest'
        }).then(function (result) {
          (byPath[path] || []).forEach(function (box) {
            renderPreview(box, result.comments);
          });
        }, function (error) {
          console.warn('[moments] 评论预览加载失败', error);
        });
      });
    }, function (error) {
      console.warn('[moments] 评论数加载失败', error);
    });
  }

  init();

  // 与 main.js 的约定一致：暴露给后续 Swup 的 page:view 生命周期复用
  window.inalinePageInit = init;
})();
