/**
 * 评论区表情包（DESIGN.md §8.8）
 *
 * 负责：
 *  1. 解析 hugo.yaml 的 params.waline.emoji
 *  2. 拉取 @waline/emojis 预设的 info.json，生成选项卡数据
 *  3. 渲染表情选择面板，把表情插入 textarea
 *  4. 提交 / 预览前把 :key: 转成 <img class="wl-emoji">，把颜文字包进
 *     <span class="wl-kaomoji">，避免 Markdown 把 * / _ 当成强调符号
 *
 * 配置项（每一项是一个选项卡）：
 *   preset   @waline/emojis 的预设名（qq / alus / bilibili …）或完整目录 URL
 *   name     显示名，可覆盖 info.json 里的 name
 *   type     "text" 表示文本表情；图片表情的类型由 info.json 决定
 *   items    type: "text" 时是字面文本；自定义图片包时是文件名列表
 *   folder / prefix / type  自定义图片包，语义同 WalineEmojiInfo
 */
(function (global) {
  'use strict';

  var PRESET_BASE = 'https://unpkg.com/@waline/emojis@1.4.0';
  var EMOJI_PATTERN = /:(.+?):/g;
  var TOKEN_OPEN = '\uE000';
  var TOKEN_CLOSE = '\uE001';
  var infoCache = {};

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

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** preset 简写展开成目录 URL；完整 URL / 协议相对 URL 原样使用 */
  function presetUrl(value) {
    var url = String(value || '').trim();
    if (!url) return '';
    if (/^(https?:)?\/\//i.test(url)) return url.replace(/\/+$/, '');
    return PRESET_BASE + '/' + url.replace(/^\/+|\/+$/g, '');
  }

  function fetchInfo(folder) {
    if (infoCache[folder]) return Promise.resolve(infoCache[folder]);

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 6000) : null;
    var init = { headers: { Accept: 'application/json' } };
    if (controller) init.signal = controller.signal;

    return fetch(folder + '/info.json', init).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function (info) {
      infoCache[folder] = info;
      if (timer) clearTimeout(timer);
      return info;
    }, function (error) {
      if (timer) clearTimeout(timer);
      throw error;
    });
  }

  /** 把一个配置项归一成 { name, kind: 'image' | 'text', items } */
  function normalizeTab(tab) {
    if (!tab || typeof tab !== 'object') return Promise.resolve(null);

    if (tab.type === 'text') {
      var texts = (Array.isArray(tab.items) ? tab.items : []).map(function (item) {
        var text = String(item);
        return { text: text, html: escapeHtml(text) };
      });
      return Promise.resolve({
        name: tab.name || '文本表情',
        kind: 'text',
        items: texts
      });
    }

    if (tab.preset) {
      var folder = presetUrl(tab.preset);
      return fetchInfo(folder).then(function (info) {
        var prefix = info.prefix || '';
        var type = info.type || '';
        var items = (Array.isArray(info.items) ? info.items : []).map(function (name) {
          var key = prefix + name;
          return {
            key: key,
            text: key,
            url: folder + '/' + key + (type ? '.' + type : '')
          };
        });
        return {
          name: tab.name || info.name || '表情',
          kind: 'image',
          items: items
        };
      });
    }

    // 自定义图片包：folder + items，与 WalineEmojiInfo 同义
    if (tab.folder && Array.isArray(tab.items)) {
      var folderUrl = String(tab.folder).replace(/\/+$/, '');
      var customPrefix = tab.prefix || '';
      var customType = tab.type || '';
      var customItems = tab.items.map(function (name) {
        var key = customPrefix + name;
        return {
          key: key,
          text: key,
          url: folderUrl + '/' + key + (customType ? '.' + customType : '')
        };
      });
      return Promise.resolve({
        name: tab.name || '表情',
        kind: 'image',
        items: customItems
      });
    }

    return Promise.resolve(null);
  }

  function create(options) {
    var config = Array.isArray(options.config) ? options.config : [];
    var textarea = options.textarea;
    var toggle = options.toggle;
    var popup = options.popup;
    var tabsEl = options.tabs;
    var panelEl = options.panel;
    var statusEl = options.status;

    if (!textarea || !toggle || !popup || !tabsEl || !panelEl) return null;
    if (!config.length) return null;

    var tabs = null;
    var loading = null;
    var activeIndex = 0;
    var failed = [];
    var map = {};
    var kaomoji = [];
    var kaomojiMap = {};
    var kaomojiPattern = null;

    function setStatus(text) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.hidden = !text;
    }

    function buildKaomoji() {
      if (!kaomoji.length) return;
      kaomoji.sort(function (a, b) { return b.text.length - a.text.length; });
      kaomoji.forEach(function (item) { kaomojiMap[item.text] = item; });
      kaomojiPattern = new RegExp(
        kaomoji.map(function (item) { return escapeRegExp(item.text); }).join('|'),
        'g'
      );
    }

    function load() {
      if (tabs) return Promise.resolve(tabs);
      if (loading) return loading;

      loading = Promise.all(config.map(function (tab) {
        return normalizeTab(tab).catch(function (error) {
          failed.push(tab.name || tab.preset || tab.folder || '未命名表情包');
          if (global.console) console.warn('[emoji] 加载失败', tab, error);
          return null;
        });
      })).then(function (result) {
        tabs = result.filter(Boolean);
        tabs.forEach(function (tab) {
          if (tab.kind === 'image') {
            tab.items.forEach(function (item) { map[item.key] = item.url; });
          } else {
            tab.items.forEach(function (item) { kaomoji.push(item); });
          }
        });
        buildKaomoji();
        return tabs;
      });

      return loading;
    }

    function emojiHtml(key, url) {
      return '<img class="wl-emoji" src="' + escapeHtml(url) +
        '" alt="' + escapeHtml(key) + '" loading="lazy">';
    }

    function tokenize(html, tokens) {
      var token = TOKEN_OPEN + tokens.length + TOKEN_CLOSE;
      tokens.push(html);
      return token;
    }

    /**
     * 预览用：把颜文字 / 表情换成私有区占位符，让 Markdown 渲染器跳过它们。
     * 返回 { text, tokens }，渲染完再把 tokens 换回来。
     */
    function protect(text) {
      var tokens = [];
      if (!tabs) return { text: text, tokens: tokens };

      if (kaomojiPattern) {
        text = text.replace(kaomojiPattern, function (match) {
          var item = kaomojiMap[match];
          if (!item) return match;
          return tokenize('<span class="wl-kaomoji">' + item.html + '</span>', tokens);
        });
      }

      text = text.replace(EMOJI_PATTERN, function (match, key) {
        var url = map[key];
        return url ? tokenize(emojiHtml(key, url), tokens) : match;
      });

      return { text: text, tokens: tokens };
    }

    function restore(html, tokens) {
      return String(html).replace(/\uE000(\d+)\uE001/g, function (match, index) {
        return tokens[Number(index)] || '';
      });
    }

    /** 提交用：直接换成服务端能保存的 HTML，其他 Markdown 原样交给 Waline */
    function toHtml(text) {
      if (!tabs) return text;

      if (kaomojiPattern) {
        text = text.replace(kaomojiPattern, function (match) {
          var item = kaomojiMap[match];
          return item ? '<span class="wl-kaomoji">' + item.html + '</span>' : match;
        });
      }

      return text.replace(EMOJI_PATTERN, function (match, key) {
        var url = map[key];
        return url ? emojiHtml(key, url) : match;
      });
    }

    function insert(value) {
      var start = typeof textarea.selectionStart === 'number'
        ? textarea.selectionStart
        : textarea.value.length;
      var end = typeof textarea.selectionEnd === 'number'
        ? textarea.selectionEnd
        : start;

      // 程序写入不受 maxlength 约束；放不下就整枚不插，避免留下半截短码
      if (textarea.maxLength > 0) {
        var remaining = textarea.maxLength - (textarea.value.length - (end - start));
        if (remaining <= 0 || value.length > remaining) return;
      }

      if (textarea.setRangeText) {
        textarea.setRangeText(value, start, end, 'end');
      } else {
        textarea.value = textarea.value.slice(0, start) + value + textarea.value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + value.length;
      }

      // 复用 comment.js 的输入监听：字数、预览会跟着更新
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      try {
        textarea.focus({ preventScroll: true });
      } catch (e) {
        textarea.focus();
      }
    }

    function renderTabs() {
      tabsEl.textContent = '';
      tabs.forEach(function (tab, index) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'post-comment-emoji-tab' + (index === activeIndex ? ' is-active' : '');
        button.textContent = tab.name;
        button.setAttribute('aria-pressed', String(index === activeIndex));
        button.addEventListener('click', function () {
          if (activeIndex !== index) activateTab(index);
        });
        tabsEl.appendChild(button);
      });
    }

    // 只切 class，不重建选项卡按钮，键盘焦点不会因为切换而丢失
    function activateTab(index) {
      activeIndex = index;
      Array.prototype.forEach.call(tabsEl.children, function (button, i) {
        button.classList.toggle('is-active', i === index);
        button.setAttribute('aria-pressed', String(i === index));
      });
      renderPanel();
    }

    function renderPanel() {
      panelEl.textContent = '';
      var tab = tabs[activeIndex];
      if (!tab) return;

      var box = document.createElement('div');
      box.className = tab.kind === 'text'
        ? 'post-comment-emoji-text'
        : 'post-comment-emoji-grid';

      tab.items.forEach(function (item) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'post-comment-emoji-item';

        if (tab.kind === 'image') {
          var img = document.createElement('img');
          img.src = item.url;
          img.alt = item.text;
          img.loading = 'lazy';
          img.width = 24;
          img.height = 24;
          button.title = item.text;
          button.appendChild(img);
        } else {
          button.textContent = item.text;
          button.title = item.text;
          button.setAttribute('aria-label', '插入颜文字 ' + item.text);
        }

        button.addEventListener('click', function () {
          insert(tab.kind === 'image' ? ':' + item.text + ':' : item.text);
          // 选完一枚就收起面板；焦点已由 insert 交给 textarea
          close();
        });
        box.appendChild(button);
      });

      panelEl.appendChild(box);
    }

    function render() {
      if (!tabs.length) {
        tabsEl.textContent = '';
        panelEl.textContent = '';
        setStatus('没有可用的表情包。');
        return;
      }

      setStatus(failed.length ? '部分表情包加载失败：' + failed.join('、') : '');
      if (activeIndex >= tabs.length) activeIndex = 0;
      renderTabs();
      renderPanel();
    }

    function open() {
      popup.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      if (popup.focus) popup.focus();

      if (tabs) {
        render();
        return;
      }

      setStatus('表情加载中…');
      tabsEl.textContent = '';
      panelEl.textContent = '';
      load().then(function () {
        if (!popup.hidden) render();
      });
    }

    function close() {
      popup.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () {
      if (popup.hidden) open();
      else close();
    });

    // 关闭面板用 pointerdown / mousedown 而不是 click：
    // click 冒泡到 document 时，选项卡可能已经重绘，target 不在 popup 里，
    // 会被误判成“点击外部”而收起。pointerdown 发生在任何 DOM 变更之前。
    var outsideEvent = global.PointerEvent ? 'pointerdown' : 'mousedown';
    document.addEventListener(outsideEvent, function (event) {
      if (popup.hidden) return;
      if (popup.contains(event.target) || toggle.contains(event.target)) return;
      close();
    }, true);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !popup.hidden) {
        close();
        toggle.focus();
      }
    });

    // 页面加载后就预取，第一次点开时通常已经就绪；失败也不影响正文
    load().catch(function () { /* 单个包的失败已在 load 内消化 */ });

    return {
      load: load,
      protect: protect,
      restore: restore,
      toHtml: toHtml
    };
  }

  global.InalineEmoji = { create: create };
})(window);
