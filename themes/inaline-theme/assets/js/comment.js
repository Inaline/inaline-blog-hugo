/**
 * 文章评论区（DESIGN.md §8.8）
 *
 * 数据来自 Waline，HTTP 细节在 waline.js。这里负责：
 *  1. 把 Waline 返回的评论树渲染成 post-comments.html 里的结构
 *  2. 顶层评论分页、最新 / 最早排序、刷新
 *  3. 发布表单：邮箱头像、字数、回复上下文、提交与反馈
 *  4. 评论点赞（可取消）与注册用户的 label 标签
 *
 * 配置全部写在 section 的 data-* 上（由模板按 hugo.yaml 的 params.waline 输出），
 * 脚本不读 Hugo 变量，模板与 JS 只靠这组锚点连接。
 */
(function () {
  'use strict';

  var USER_KEY = 'inaline-comment-user';
  var LIKES_KEY = 'inaline-comment-likes';

  var section = document.querySelector('[data-post-comments]');
  if (!section || !window.InalineWaline) return;

  var data = section.dataset;
  var client;
  try {
    client = window.InalineWaline.create({ server: data.walineServer });
  } catch (error) {
    console.error('[comments]', error);
    return;
  }

  var path = data.commentPath || window.location.pathname;
  var pageSize = parseInt(data.commentPageSize, 10) || 10;
  var avatarPrefix = data.commentAvatarPrefix || '';
  var avatarParams = data.commentAvatarParams || '';
  var reducedMotion = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var els = {
    form: section.querySelector('[data-comment-form]'),
    list: section.querySelector('[data-comment-list]'),
    count: section.querySelector('[data-comment-count]'),
    pager: section.querySelector('[data-comment-pager]'),
    refresh: section.querySelector('[data-comment-refresh]'),
    sorts: section.querySelectorAll('[data-comment-sort]'),
    status: section.querySelector('[data-comment-status]'),
    avatar: section.querySelector('[data-comment-avatar]'),
    counter: section.querySelector('[data-comment-counter]'),
    replyHint: section.querySelector('[data-comment-reply]'),
    replyNick: section.querySelector('[data-comment-reply-nick]'),
    replyCancel: section.querySelector('[data-comment-reply-cancel]'),
    submit: section.querySelector('[data-comment-submit]'),
    editor: section.querySelector('[data-comment-editor]'),
    preview: section.querySelector('[data-comment-preview]'),
    previewBody: section.querySelector('[data-comment-preview-body]'),
    previewToggle: section.querySelector('[data-comment-preview-toggle]'),
    emojiPicker: section.querySelector('[data-comment-emoji-picker]'),
    emojiConfig: section.querySelector('[data-comment-emoji-config]'),
    emojiToggle: section.querySelector('[data-comment-emoji-toggle]'),
    emojiPopup: section.querySelector('[data-comment-emoji-popup]'),
    emojiTabs: section.querySelector('[data-comment-emoji-tabs]'),
    emojiPanel: section.querySelector('[data-comment-emoji-panel]'),
    emojiStatus: section.querySelector('[data-comment-emoji-status]')
  };

  if (!els.form || !els.list) return;

  var fields = {
    mail: els.form.elements.mail,
    nick: els.form.elements.nick,
    link: els.form.elements.link,
    comment: els.form.elements.comment
  };
  if (!fields.mail || !fields.nick || !fields.link || !fields.comment) return;

  var state = {
    page: 1,
    sort: 'newest',
    count: 0,
    totalPages: 0,
    comments: [],
    loading: false,
    sending: false,
    previewing: false,
    reply: null
  };

  var requestSeq = 0;
  var avatarTimer = null;
  var emoji = null;

  // -------------------------------------------------------------------------
  // 加载与渲染
  // -------------------------------------------------------------------------

  function load(options) {
    options = options || {};
    var seq = ++requestSeq;
    setLoading(true);

    if (options.initial) {
      if (els.count) els.count.textContent = '评论加载中…';
      showState('评论加载中…');
    }

    client.list({
      path: path,
      page: state.page,
      pageSize: pageSize,
      sort: state.sort
    }).then(function (result) {
      if (seq !== requestSeq) return;

      // 评论增减后当前页可能越界：回到最后一页重新取
      if (result.totalPages > 0 && state.page > result.totalPages) {
        state.page = result.totalPages;
        load(options);
        return;
      }

      state.page = result.page;
      state.count = result.count;
      state.totalPages = result.totalPages;
      state.comments = result.comments;
      render();

      // 从侧栏近期评论等外部链接进入时，页面地址带 #comment-<id>：
      // 评论是异步插入的，浏览器不会自己滚过去，渲染后补一次定位
      if (options.initial && window.location.hash) {
        var match = window.location.hash.match(/^#comment-([0-9]+)$/);
        if (match) focusComment(match[1]);
      }

      if (options.scroll) scrollToComments();
      if (options.focusId) focusComment(options.focusId);
    }, function (error) {
      if (seq !== requestSeq) return;

      console.error('[comments] 加载失败', error);
      state.comments = [];
      state.totalPages = 0;
      if (els.count) els.count.textContent = '评论加载失败';
      showState('评论加载失败，点击右上角刷新重试。');
      if (els.pager) els.pager.hidden = true;
    }).then(function () {
      // 被新的请求接管时不复位，避免后到的旧请求把 loading 关掉
      if (seq === requestSeq) setLoading(false);
    });
  }

  function render() {
    els.list.textContent = '';

    if (!state.comments.length) {
      els.list.appendChild(create('p', 'post-comments-state', '还没有评论，来抢沙发吧。'));
    } else {
      state.comments.forEach(function (comment) {
        els.list.appendChild(renderComment(comment, false, comment.objectId));
      });
    }

    // 文章内页的数字只加千分位逗号，不折成 k / M（DESIGN.md §8.8）
    if (els.count) els.count.textContent = formatCount(state.count) + ' 条评论';
    renderPager();
  }

  /** 单条评论。顶层评论渲染 children，二级回复不再向下嵌套 */
  function renderComment(comment, isReply, rootId) {
    var article = create(
      'article',
      'post-comment ' + (isReply ? 'post-comment--reply' : 'post-comment--thread')
    );
    article.id = 'comment-' + comment.objectId;
    article.appendChild(renderAvatar(comment, isReply));

    var main = create('div', 'post-comment-main');

    var head = create('header', 'post-comment-head');
    var identity = create('span', 'post-comment-identity');
    identity.appendChild(create('span', 'post-comment-author', comment.nick || '匿名'));

    // 用户标签由 Waline 后台按注册用户设置，只有关联账号的评论才带 label
    var label = String(comment.label || '').trim();
    if (label) identity.appendChild(create('span', 'post-comment-label', label));

    head.appendChild(identity);
    head.appendChild(renderTime(comment.time));
    main.appendChild(head);

    var bubble = create('div', 'post-comment-bubble');
    bubble.appendChild(renderContent(comment, isReply));

    var foot = create('div', 'post-comment-bubble-foot');
    var meta = renderMeta(comment);
    if (meta) foot.appendChild(meta);

    var actions = create('div', 'post-comment-actions');
    actions.appendChild(renderLikeButton(comment));
    actions.appendChild(renderReplyButton(comment, isReply ? rootId : comment.objectId));
    foot.appendChild(actions);
    bubble.appendChild(foot);
    main.appendChild(bubble);

    if (!isReply) {
      // 回复始终按时间正序，读起来是对话；顶层顺序才跟排序按钮走
      var replies = (comment.children || []).slice().sort(function (a, b) {
        return (Number(a.time) || 0) - (Number(b.time) || 0);
      });
      if (replies.length) {
        var repliesBox = create('div', 'post-comment-replies');
        replies.forEach(function (reply) {
          repliesBox.appendChild(renderComment(reply, true, comment.objectId));
        });
        main.appendChild(repliesBox);
      }
    }

    article.appendChild(main);
    return article;
  }

  function renderAvatar(comment, isReply) {
    var size = isReply ? 32 : 40;
    var box = create('span', 'post-comment-avatar');
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
      img.width = size;
      img.height = size;
      img.addEventListener('error', fallback, { once: true });
      box.appendChild(img);
    } else {
      fallback();
    }

    return box;
  }

  function renderContent(comment, isReply) {
    var content = create('div', 'post-comment-content');
    content.setAttribute('data-lightbox-group', '');

    // Waline 服务端已用 markdown-it + DOMPurify 渲染并清洗正文，可直接插入
    var holder = document.createElement('div');
    holder.innerHTML = comment.comment || '';

    // 回复的 @ 提及由 reply_user 提供，拼进第一段正文，保持与演示稿一致的行内形态
    if (isReply && comment.reply_user && comment.reply_user.nick) {
      var mention = create('span', 'post-comment-mention', '@' + comment.reply_user.nick);
      var first = holder.firstElementChild;
      var target = first && (first.tagName === 'P' || first.tagName === 'DIV') ? first : holder;
      target.insertBefore(document.createTextNode(' '), target.firstChild);
      target.insertBefore(mention, target.firstChild);
    }

    while (holder.firstChild) content.appendChild(holder.firstChild);
    return content;
  }

  function renderTime(value) {
    var ms = Number(value);
    if (!isFinite(ms) || ms <= 0) ms = Date.now();

    var time = create('time', 'post-comment-time');
    time.dateTime = new Date(ms).toISOString();
    time.title = fullDate(ms);
    time.textContent = relativeTime(ms);
    return time;
  }

  function renderMeta(comment) {
    var items = [];

    // 本地 Waline 通常没有 IP 归属地，空值不占位
    if (comment.addr) {
      items.push(metaItem('fa-solid fa-location-dot', 'IP 归属地', comment.addr));
    }
    if (comment.os) {
      items.push(metaItem(osIcon(comment.os), '操作系统', comment.os));
    }
    if (comment.browser) {
      items.push(metaItem(browserIcon(comment.browser), '浏览器', normalizeBrowser(comment.browser)));
    }
    if (!items.length) return null;

    var list = create('ul', 'post-comment-meta');
    items.forEach(function (item) { list.appendChild(item); });
    return list;
  }

  function metaItem(iconClass, title, text) {
    var item = create('li', 'post-comment-meta-item');
    item.title = title;

    var icon = create('i', iconClass);
    icon.setAttribute('aria-hidden', 'true');
    item.appendChild(icon);
    item.appendChild(create('span', '', text));
    return item;
  }

  /**
   * 点赞按钮。Waline 的匿名点赞没有「谁点过」的记录，本机用 localStorage
   * 记住自己的点赞状态：点击在点赞 / 取消之间切换，刷新 / 翻页后保持。
   * 计数始终显示（含 0）；请求期间禁用，失败回滚到点击前的状态。
   */
  function renderLikeButton(comment) {
    var id = comment.objectId;
    var count = Math.max(0, Math.floor(Number(comment.like) || 0));

    var button = create('button', 'post-comment-like');
    button.type = 'button';

    var icon = document.createElement('i');
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);

    var counter = create('span', 'post-comment-like-count');
    button.appendChild(counter);

    function paint(value, liked) {
      count = Math.max(0, Math.floor(Number(value) || 0));
      icon.className = liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
      counter.textContent = formatCount(count);
      button.classList.toggle('is-liked', liked);
      button.setAttribute('aria-pressed', String(liked));
      button.setAttribute('aria-label', (liked ? '已点赞，点击取消' : '点赞') + '（' + formatCount(count) + '）');
      button.title = liked ? '取消点赞' : '点赞';
    }

    var liked = isLiked(id);
    paint(count, liked);

    button.addEventListener('click', function () {
      if (button.disabled) return;

      var previous = count;
      var previousLiked = liked;
      var nextLiked = !previousLiked;
      var next = Math.max(0, previous + (nextLiked ? 1 : -1));

      button.disabled = true;
      paint(next, nextLiked);

      client.like(id, nextLiked).then(function (updated) {
        // 以服务端计数为准：LIKE_INC_MAX 大于 1 时一次可能加不止 1
        liked = nextLiked;
        saveLike(id, nextLiked);
        paint(updated && updated.like !== undefined ? updated.like : next, nextLiked);
        button.disabled = false;
      }, function (error) {
        console.error('[comments] 点赞失败', error);
        paint(previous, previousLiked);
        button.disabled = false;
        // 失败提示挂在 tooltip 上，不打断评论区阅读
        button.title = previousLiked ? '取消点赞失败，请稍后重试' : '点赞失败，请稍后重试';
      });
    });

    return button;
  }

  function renderReplyButton(comment, rootId) {
    var button = create('button', 'post-comment-reply');
    button.type = 'button';
    button.setAttribute('aria-label', '回复 ' + (comment.nick || ''));
    button.innerHTML = '<i class="fa-solid fa-reply" aria-hidden="true"></i><span>回复</span>';
    button.addEventListener('click', function () {
      startReply(comment, rootId);
    });
    return button;
  }

  // -------------------------------------------------------------------------
  // 分页
  // -------------------------------------------------------------------------

  function renderPager() {
    if (!els.pager) return;
    els.pager.textContent = '';

    if (state.totalPages <= 1) {
      els.pager.hidden = true;
      return;
    }
    els.pager.hidden = false;

    if (state.page > 1) {
      els.pager.appendChild(stepButton(state.page - 1, '上一页', 'fa-chevron-left'));
    }

    pageNumbers(state.page, state.totalPages).forEach(function (page) {
      if (page === '…') {
        var ellipsis = create('span', 'post-comments-page-ellipsis', '…');
        ellipsis.setAttribute('aria-hidden', 'true');
        els.pager.appendChild(ellipsis);
        return;
      }

      if (page === state.page) {
        var current = create('span', 'post-comments-page is-current', String(page));
        current.setAttribute('aria-current', 'page');
        els.pager.appendChild(current);
        return;
      }

      var button = create('button', 'post-comments-page', String(page));
      button.type = 'button';
      button.addEventListener('click', function () {
        goToPage(page);
      });
      els.pager.appendChild(button);
    });

    if (state.page < state.totalPages) {
      els.pager.appendChild(stepButton(state.page + 1, '下一页', 'fa-chevron-right'));
    }
  }

  function stepButton(page, label, iconClass) {
    var button = create('button', 'post-comments-page post-comments-page--step');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.innerHTML = '<i class="fa-solid ' + iconClass + '" aria-hidden="true"></i>';
    button.addEventListener('click', function () {
      goToPage(page);
    });
    return button;
  }

  function goToPage(page) {
    if (page === state.page) return;
    state.page = page;
    load({ scroll: true });
  }

  /** 首尾页固定，当前页左右各一页，跳过的页码用省略号收拢（同 §7.7 分页） */
  function pageNumbers(current, total) {
    var pages = [1];
    var start = Math.max(2, current - 1);
    var end = Math.min(total - 1, current + 1);

    if (start > 2) pages.push('…');
    for (var i = start; i <= end; i += 1) pages.push(i);
    if (end < total - 1) pages.push('…');
    if (total > 1) pages.push(total);
    return pages;
  }

  // -------------------------------------------------------------------------
  // 排序 / 刷新 / 滚动
  // -------------------------------------------------------------------------

  function bindSort() {
    Array.prototype.forEach.call(els.sorts, function (button) {
      button.addEventListener('click', function () {
        var sort = button.getAttribute('data-comment-sort');
        if (!sort || sort === state.sort) return;

        state.sort = sort;
        state.page = 1;
        syncSortButtons();
        load({ scroll: true });
      });
    });
  }

  function syncSortButtons() {
    Array.prototype.forEach.call(els.sorts, function (button) {
      var active = button.getAttribute('data-comment-sort') === state.sort;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function bindRefresh() {
    if (!els.refresh) return;
    els.refresh.addEventListener('click', function () {
      if (state.loading) return;
      load();
    });
  }

  function setLoading(loading) {
    state.loading = loading;
    if (els.refresh) {
      els.refresh.disabled = loading;
      els.refresh.classList.toggle('is-loading', loading);
    }
    els.list.setAttribute('aria-busy', String(loading));
  }

  function showState(text) {
    els.list.textContent = '';
    els.list.appendChild(create('p', 'post-comments-state', text));
  }

  function scrollToComments() {
    if (!section.scrollIntoView) return;
    section.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  function focusComment(id) {
    if (!id) return;
    var target = document.getElementById('comment-' + id);
    if (!target || !target.scrollIntoView) return;
    target.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center'
    });
  }

  // -------------------------------------------------------------------------
  // 发布表单
  // -------------------------------------------------------------------------

  function bindForm() {
    els.form.addEventListener('submit', onSubmit);
    fields.comment.addEventListener('input', onEditorInput);
    if (els.previewToggle) els.previewToggle.addEventListener('click', togglePreview);

    // 昵称 / 邮箱都会影响头像（纯数字昵称或 QQ 邮箱取 QQ 头像），一起防抖
    fields.mail.addEventListener('input', scheduleFormAvatar);
    fields.nick.addEventListener('input', scheduleFormAvatar);

    if (els.replyCancel) els.replyCancel.addEventListener('click', cancelReply);
  }

  /** 表情配置来自模板输出的 JSON；没有配置时隐藏整个表情控件 */
  function initEmoji() {
    if (!window.InalineEmoji || !els.emojiPicker || !els.emojiConfig) {
      if (els.emojiPicker) els.emojiPicker.hidden = true;
      return;
    }

    var config = [];
    try {
      var parsed = JSON.parse(els.emojiConfig.textContent || '[]');
      if (Array.isArray(parsed)) config = parsed;
    } catch (error) {
      console.warn('[comments] 表情配置解析失败', error);
    }

    emoji = window.InalineEmoji.create({
      config: config,
      textarea: fields.comment,
      toggle: els.emojiToggle,
      popup: els.emojiPopup,
      tabs: els.emojiTabs,
      panel: els.emojiPanel,
      status: els.emojiStatus
    });

    if (!emoji) {
      els.emojiPicker.hidden = true;
      return;
    }

    // 表情包可能在预览打开后才拉完：就绪时补一次渲染
    emoji.load().then(function () {
      if (state.previewing) renderPreview();
    }, function () { /* 选择器内部已有失败提示 */ });
  }

  /** 提交 / 预览不必死等慢网络：最多等 1.5s，已加载的表情照常转换 */
  function emojiReady() {
    if (!emoji) return Promise.resolve();
    return Promise.race([
      emoji.load(),
      new Promise(function (resolve) { setTimeout(resolve, 1500); })
    ]);
  }

  function onEditorInput() {
    updateCounter();
    if (state.previewing) renderPreview();
  }

  function togglePreview() {
    setPreview(!state.previewing);
    if (!state.previewing) {
      try {
        fields.comment.focus({ preventScroll: true });
      } catch (e) {
        fields.comment.focus();
      }
    }
  }

  /** 预览与编辑共用一块空间：隐藏 textarea，显示渲染结果 */
  function setPreview(on) {
    var showing = !!on;
    // 先量 textarea 的真实高度（用户可能手动拖高过），预览区按同高展示；
    // 内容更长时在预览区内部滚动，避免切换时表单跳动
    var editorHeight = !state.previewing && showing ? fields.comment.offsetHeight : 0;

    state.previewing = showing;
    if (els.editor) els.editor.hidden = showing;
    if (els.preview) {
      els.preview.hidden = !showing;
      if (showing && editorHeight) els.preview.style.height = editorHeight + 'px';
    }

    if (els.previewToggle) {
      els.previewToggle.classList.toggle('is-active', showing);
      els.previewToggle.setAttribute('aria-pressed', String(showing));
      var label = els.previewToggle.querySelector('span');
      if (label) label.textContent = showing ? '编辑' : '预览';
    }

    if (showing) renderPreview();
  }

  function renderPreview() {
    if (!state.previewing || !els.previewBody) return;

    var raw = fields.comment.value;
    var finish = function () {
      var protectedText = emoji ? emoji.protect(raw) : { text: raw, tokens: [] };
      var html = window.InalineFormat && window.InalineFormat.markdown
        ? window.InalineFormat.markdown(protectedText.text)
        : escapeHtml(protectedText.text).replace(/\n/g, '<br>');

      if (emoji) html = emoji.restore(html, protectedText.tokens);
      els.previewBody.innerHTML = html ||
        '<p class="post-comment-preview-empty">还没有可预览的内容。</p>';
    };

    // 表情包信息可能还在路上：最多等 1.5s，失败 / 超时也照常显示纯文本预览
    emojiReady().then(finish, finish);
  }

  function onSubmit(event) {
    event.preventDefault();
    if (state.sending) return;

    var nick = fields.nick.value.trim();
    var mail = fields.mail.value.trim();
    var link = fields.link.value.trim();
    var content = fields.comment.value.trim();

    if (!nick) return showFormError('请填写昵称。', fields.nick);
    if (!mail) return showFormError('请填写邮箱。', fields.mail);
    if (!content) return showFormError('评论内容不能为空。', fields.comment);

    var reply = state.reply;
    var payload = {
      nick: nick,
      mail: mail,
      comment: content,
      url: path,
      ua: navigator.userAgent
    };
    if (link) payload.link = link;
    if (reply) {
      payload.pid = reply.pid;
      payload.rid = reply.rid;
    }

    setSending(true);
    setStatus('', false);

    // 表情包信息可能还没拉完：最多等 1.5s，再转 :key: 和颜文字
    emojiReady().then(function () {
      if (emoji) payload.comment = emoji.toHtml(content);
      return client.add(payload);
    }).then(function (comment) {
      saveUser({ nick: nick, mail: mail, link: link });
      resetEditor();
      setStatus(
        comment && comment.status === 'waiting'
          ? '评论已提交，审核通过后会显示。'
          : '评论已发布。',
        false
      );

      if (reply) {
        // 回复留在当前页，回到父评论位置
        load({ focusId: reply.pid });
      } else {
        // 顶层新评论切到最新第 1 页，并滚到这条评论，保证能立刻看到自己刚发的内容
        state.sort = 'newest';
        state.page = 1;
        syncSortButtons();
        load({ focusId: comment && comment.objectId });
      }
    }, function (error) {
      console.error('[comments] 发送失败', error);
      setStatus(friendlySubmitError(error), true);
    }).then(function () {
      setSending(false);
    });
  }

  function startReply(comment, rootId) {
    if (state.previewing) setPreview(false);

    state.reply = {
      pid: comment.objectId,
      rid: rootId,
      nick: comment.nick || ''
    };

    if (els.replyHint) {
      els.replyHint.hidden = false;
      if (els.replyNick) els.replyNick.textContent = '@' + state.reply.nick;
    }
    fields.comment.placeholder = '回复 @' + state.reply.nick + '…';

    // 表单在列表上方：先把焦点放过去，必要时滚回表单
    try {
      fields.comment.focus({ preventScroll: true });
    } catch (e) {
      fields.comment.focus();
    }

    var header = document.querySelector('.site-header');
    var headerHeight = header ? header.offsetHeight : 0;
    var rect = els.form.getBoundingClientRect();
    if (rect.top < headerHeight || rect.bottom > window.innerHeight) {
      els.form.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'center'
      });
    }
  }

  function cancelReply() {
    state.reply = null;
    if (els.replyHint) els.replyHint.hidden = true;
    if (els.replyNick) els.replyNick.textContent = '';
    fields.comment.placeholder = '说点什么吧…';
  }

  function resetEditor() {
    fields.comment.value = '';
    updateCounter();
    cancelReply();
    setPreview(false);
  }

  function updateCounter() {
    if (!els.counter) return;
    // 服务端不限制评论长度，这里只显示字数：按码点计数，emoji 不会被算成两个字
    els.counter.textContent = Array.from(fields.comment.value).length + ' 字';
  }

  function scheduleFormAvatar() {
    clearTimeout(avatarTimer);
    avatarTimer = setTimeout(updateFormAvatar, 250);
  }

  function updateFormAvatar() {
    if (!els.avatar) return;

    var url = window.InalineWaline.avatarUrl(
      fields.mail.value.trim(),
      avatarPrefix,
      fields.nick.value.trim(),
      avatarParams
    );
    if (!url) {
      resetFormAvatar();
      return;
    }

    var img = document.createElement('img');
    img.alt = '';
    img.addEventListener('error', function () {
      // 已经被下一次输入替换掉的旧图不要回来把新头像清掉
      if (img.parentNode === els.avatar) resetFormAvatar();
    }, { once: true });
    img.src = url;

    els.avatar.textContent = '';
    els.avatar.appendChild(img);
  }

  function resetFormAvatar() {
    if (!els.avatar) return;
    els.avatar.innerHTML = '<i class="fa-solid fa-user"></i>';
  }

  function setSending(sending) {
    state.sending = sending;
    if (!els.submit) return;

    els.submit.disabled = sending;
    els.submit.setAttribute('aria-busy', String(sending));
    var label = els.submit.querySelector('span');
    if (label) label.textContent = sending ? '发送中' : '发送';
  }

  function setStatus(message, isError) {
    if (!els.status) return;
    els.status.textContent = message;
    els.status.hidden = !message;
    els.status.classList.toggle('is-error', !!isError);
  }

  function showFormError(message, field) {
    setStatus(message, true);
    if (field && field.focus) field.focus();
  }

  function friendlySubmitError(error) {
    var message = (error && error.message) || '';

    if (error && error.code === -1) return message;
    if ((error && error.code === 1000) || /too fast/i.test(message)) {
      return '评论太快了，歇一会儿再发吧。';
    }
    if (/duplicate/i.test(message)) return '这条评论已经发过了。';
    if (/forbidden/i.test(message)) return '评论没有通过校验，请修改后再试。';
    return '发送失败，请稍后重试。';
  }

  // 评论者信息留在本机，下次打开文章自动回填；邮箱只用于取头像，不会展示给其他人
  function readUser() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveUser(user) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {
      /* 隐私模式下不可用，忽略 */
    }
  }

  // 点赞状态按「服务地址#评论 id」记在本机，换服务器 / 换评论不会串。
  // localStorage 不可用（隐私模式）时退化成不记住，本次页面内仍能正常点赞。
  function readLikes() {
    try {
      var raw = localStorage.getItem(LIKES_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function likeKey(id) {
    return (data.walineServer || '') + '#' + id;
  }

  function isLiked(id) {
    return readLikes()[likeKey(id)] === true;
  }

  function saveLike(id, liked) {
    var likes = readLikes();
    if (liked) {
      likes[likeKey(id)] = true;
    } else {
      delete likes[likeKey(id)];
    }
    try {
      localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
    } catch (e) {
      /* 隐私模式下不可用，忽略 */
    }
  }

  function prefillUser() {
    var saved = readUser();
    if (saved) {
      if (saved.nick) fields.nick.value = saved.nick;
      if (saved.mail) fields.mail.value = saved.mail;
      if (saved.link) fields.link.value = saved.link;
    }
    updateFormAvatar();
  }

  // -------------------------------------------------------------------------
  // 小工具
  // -------------------------------------------------------------------------

  function create(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

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

  /** 千分位逗号：文章页评论总数等局部数字用，不折成 k / M */
  function formatCount(value) {
    var number = Math.max(0, Math.floor(Number(value) || 0));
    return String(number).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function normalizeBrowser(value) {
    // Waline 输出的浏览器名与版本连在一起（Chrome140.0），补一个空格
    return String(value).replace(/([A-Za-z])(\d+(?:\.\d+)?)$/, '$1 $2');
  }

  function browserIcon(value) {
    var name = String(value).toLowerCase();
    if (name.indexOf('edge') !== -1) return 'fa-brands fa-edge';
    if (name.indexOf('firefox') !== -1) return 'fa-brands fa-firefox-browser';
    if (name.indexOf('safari') !== -1) return 'fa-brands fa-safari';
    if (name.indexOf('chrome') !== -1 || name.indexOf('chromium') !== -1) return 'fa-brands fa-chrome';
    return 'fa-solid fa-globe';
  }

  function osIcon(value) {
    var name = String(value).toLowerCase();
    if (name.indexOf('windows') !== -1) return 'fa-brands fa-windows';
    if (name.indexOf('android') !== -1) return 'fa-brands fa-android';
    if (name.indexOf('ios') !== -1 || name.indexOf('mac') !== -1 || name.indexOf('apple') !== -1) {
      return 'fa-brands fa-apple';
    }
    if (name.indexOf('linux') !== -1) return 'fa-brands fa-linux';
    return 'fa-solid fa-desktop';
  }

  // 评论里的相对时间在页面停留时也要继续走，每分钟重算一次
  function refreshTimes() {
    var times = els.list.querySelectorAll('time[datetime]');
    Array.prototype.forEach.call(times, function (time) {
      var ms = Date.parse(time.getAttribute('datetime'));
      if (!isNaN(ms)) time.textContent = relativeTime(ms);
    });
  }

  // -------------------------------------------------------------------------
  // 启动
  // -------------------------------------------------------------------------

  function init() {
    // 幂等：后续接入 Swup 时在同一页再次调用不会重复绑事件
    if (section.dataset.commentBound === 'true') return;
    section.dataset.commentBound = 'true';

    bindSort();
    bindRefresh();
    bindForm();
    initEmoji();
    prefillUser();
    updateCounter();
    load({ initial: true });
    setInterval(refreshTimes, 60000);
  }

  init();

  // 与 post.js 的约定一致：未来接入 Swup 时由页面生命周期再次调用
  window.inalineCommentInit = init;
})();
