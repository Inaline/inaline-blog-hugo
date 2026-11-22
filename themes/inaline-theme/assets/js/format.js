/**
 * 评论预览的轻量 Markdown（DESIGN.md §8.8）
 *
 * 只用于发布前的本地预览，不参与存储；最终评论仍由 Waline 服务端的
 * markdown-it + DOMPurify 渲染。输入先转义再生成 HTML，链接只允许 http(s) /
 * 相对路径 / 锚点，避免预览执行用户输入。
 *
 * 支持：段落 / 换行、标题、引用、有序 / 无序列表、分隔线、围栏代码、
 * 行内代码、粗体、斜体、删除线、链接、图片。
 * 不支持：表格、脚注、嵌套列表、原始 HTML 等复杂结构——预览是近似效果，
 * 以服务端渲染为准。
 */
(function (global) {
  'use strict';

  var TOKEN_OPEN = '\uE100';
  var TOKEN_CLOSE = '\uE101';

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[ch];
    });
  }

  /** 只放行 http(s)、协议相对、站内绝对路径与普通相对路径；图片不放行锚点 */
  function safeUrl(value, isImage) {
    var url = String(value || '').trim();
    if (!url) return '';

    if (/^(https?:\/\/|\/\/|\/)/i.test(url)) return url;
    if (isImage && /^#/.test(url)) return '';
    if (!isImage && /^(mailto:|#)/i.test(url)) return url;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return url; // 相对路径
    return '';
  }

  function inline(value) {
    return value
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
  }

  function markdown(input) {
    var tokens = [];
    var text = String(input === null || input === undefined ? '' : input);

    function stash(html) {
      var token = TOKEN_OPEN + tokens.length + TOKEN_CLOSE;
      tokens.push(html);
      return token;
    }

    // 1. 围栏代码块（只认 ```，内容单独转义后收进占位符）
    text = text.replace(/```([^\n]*)\n([\s\S]*?)```/g, function (match, info, code) {
      var lang = String(info || '').trim().split(/\s+/)[0]
        .replace(/[^A-Za-z0-9_+#.-]/g, '');
      var cls = lang ? ' class="language-' + escapeHtml(lang) + '"' : '';
      return stash(
        '<pre><code' + cls + '>' + escapeHtml(code.replace(/\n$/, '')) + '</code></pre>'
      );
    });

    // 2. 行内代码
    text = text.replace(/`([^`\n]+)`/g, function (match, code) {
      return stash('<code>' + escapeHtml(code) + '</code>');
    });

    // 3. 图片（先于链接，避免把 ![alt](url) 里的 [alt](url) 当链接）
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (match, alt, url) {
      var src = safeUrl(url, true);
      if (!src) return match;
      return stash(
        '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '" loading="lazy">'
      );
    });

    // 4. 链接
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (match, label, url) {
      var href = safeUrl(url, false);
      if (!href) return match;
      return stash(
        '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(label) +
        '</a>'
      );
    });

    // 5. 其余内容整体转义；代码 / 链接 / 图片已经是占位符
    text = escapeHtml(text);

    var lines = text.split('\n');
    var out = [];
    var paragraph = [];
    var list = null;
    var quote = [];

    function flushParagraph() {
      if (!paragraph.length) return;
      out.push('<p>' + inline(paragraph.join('<br>')) + '</p>');
      paragraph = [];
    }

    function flushList() {
      if (!list) return;
      out.push('<' + list.type + '>' + list.items.map(function (item) {
        return '<li>' + inline(item) + '</li>';
      }).join('') + '</' + list.type + '>');
      list = null;
    }

    function flushQuote() {
      if (!quote.length) return;
      out.push('<blockquote><p>' + inline(quote.join('<br>')) + '</p></blockquote>');
      quote = [];
    }

    function flushAll() {
      flushParagraph();
      flushList();
      flushQuote();
    }

    lines.forEach(function (line) {
      var trimmed = line.trim();
      var codeToken = trimmed.match(/^\uE100(\d+)\uE101$/);

      // 独占一行的围栏代码：直接放回预渲染好的 HTML
      if (codeToken) {
        flushAll();
        out.push(tokens[Number(codeToken[1])] || '');
        return;
      }

      if (!trimmed) {
        flushAll();
        return;
      }

      var heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        flushAll();
        var level = heading[1].length;
        out.push('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>');
        return;
      }

      if (/^([-*_])\1{2,}$/.test(trimmed)) {
        flushAll();
        out.push('<hr>');
        return;
      }

      // ">" 在转义后是 &gt;
      var quoted = trimmed.match(/^&gt;\s?(.*)$/);
      if (quoted) {
        flushParagraph();
        flushList();
        quote.push(quoted[1]);
        return;
      }

      var unordered = trimmed.match(/^[-*+]\s+(.*)$/);
      var ordered = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (unordered || ordered) {
        flushParagraph();
        flushQuote();
        var type = unordered ? 'ul' : 'ol';
        if (!list || list.type !== type) {
          flushList();
          list = { type: type, items: [] };
        }
        list.items.push(unordered ? unordered[1] : ordered[2]);
        return;
      }

      flushList();
      flushQuote();
      paragraph.push(trimmed);
    });

    flushAll();

    // 6. 还原代码 / 链接 / 图片占位符
    return out.join('').replace(/\uE100(\d+)\uE101/g, function (match, index) {
      return tokens[Number(index)] || '';
    });
  }

  global.InalineFormat = { markdown: markdown };
})(window);
