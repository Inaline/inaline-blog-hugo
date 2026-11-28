/**
 * Waline API 薄封装（DESIGN.md §8.8 / §7.11）
 *
 * 只负责与服务端通信：拼地址、解析统一的 { errno, errmsg, data } 响应、
 * 把失败归一成 WalineError。渲染与交互在 comment.js / waline-stats.js。
 *
 * 用法：
 *   var client = InalineWaline.create({ server: 'http://localhost:8360' });
 *   client.list({ path: '/posts/hello/', page: 1, pageSize: 10, sort: 'newest' });
 *   client.add({ nick, mail, link, comment, url, ua, pid, rid });
 *   client.count(['/posts/a/', '/posts/b/']);   // → [评论数, 评论数]
 *   client.count();                             // → 全站评论总数
 *   client.recent(5);                           // → 近期评论数组
 *   client.views(['/posts/a/']);                // → [阅读量]
 *   client.increment('/posts/a/', 'time');      // 阅读量 +1
 *   InalineWaline.avatarUrl('a@b.com', 'https://seccdn.libravatar.org/avatar/', '123456');
 */
(function (global) {
  'use strict';

  var SORT_BY = {
    newest: 'insertedAt_desc',
    oldest: 'insertedAt_asc'
  };
  var DEFAULT_AVATAR_PREFIX = 'https://seccdn.libravatar.org/avatar/';

  /** 服务端返回的非 0 errno、HTTP 错误与断网，都收成这一种错误 */
  function WalineError(message, code, status) {
    this.name = 'WalineError';
    this.message = message || 'Waline 请求失败';
    this.code = code;
    this.status = status;
    if (Error.captureStackTrace) Error.captureStackTrace(this, WalineError);
  }
  WalineError.prototype = Object.create(Error.prototype);
  WalineError.prototype.constructor = WalineError;

  function trimSlash(value) {
    return String(value || '').replace(/\/+$/, '');
  }

  function create(options) {
    var server = trimSlash(options && options.server);
    if (!server) throw new Error('InalineWaline: 缺少 server 地址');

    function request(path, init) {
      return fetch(server + path, init).then(function (response) {
        return response.text().then(function (text) {
          var body = null;
          if (text) {
            // 网关 / 代理出错时可能返回 HTML，按 HTTP 错误处理即可
            try { body = JSON.parse(text); } catch (e) { /* ignore */ }
          }

          if (!response.ok || !body || body.errno !== 0) {
            var message = body && body.errmsg;
            // 参数校验失败时 Waline 返回 { field, rule }，没有 errmsg
            if (!message && body && body.field) message = '参数错误：' + body.field;
            throw new WalineError(
              message || ('请求失败（HTTP ' + response.status + '）'),
              body && body.errno,
              response.status
            );
          }

          return body.data;
        });
      }, function () {
        // fetch 本身失败（断网 / CORS / 服务未启动）才会走到这里
        throw new WalineError('网络连接失败，请稍后重试。', -1, 0);
      });
    }

    /**
     * 顶层评论分页列表。回复挂在各自的父评论 children 里，不单独分页。
     * 返回 { comments, page, pageSize, totalPages, count }：
     * totalPages 按顶层评论数算，count 是含回复的总条数。
     */
    function list(options) {
      var params = new URLSearchParams();
      params.set('path', options.path);
      params.set('page', String(options.page || 1));
      params.set('pageSize', String(options.pageSize || 10));
      params.set('sortBy', SORT_BY[options.sort] || SORT_BY.newest);

      return request('/api/comment?' + params.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' }
      }).then(function (data) {
        return {
          comments: Array.isArray(data && data.data) ? data.data : [],
          page: Number(data && data.page) || 1,
          pageSize: Number(data && data.pageSize) || options.pageSize || 10,
          totalPages: Number(data && data.totalPages) || 0,
          count: Number(data && data.count) || 0
        };
      });
    }

    /** 发表评论。payload 含 nick / mail / link / comment / url / ua，回复再加 pid / rid */
    function add(payload) {
      return request('/api/comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });
    }

    /**
     * 评论数。传路径数组 → 与数组等长的评论数数组；
     * 不传 → 全站已通过评论总数（首页博主卡用）。
     */
    function count(paths) {
      var urls = Array.isArray(paths) ? paths : [];
      var params = new URLSearchParams();
      params.set('type', 'count');
      if (urls.length) params.set('url', urls.join(','));

      return request('/api/comment?' + params.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' }
      }).then(function (data) {
        if (!urls.length) return Number(data) || 0;
        return urls.map(function (path, index) {
          return Array.isArray(data) ? Number(data[index]) || 0 : 0;
        });
      });
    }

    /** 近期评论：每条带 url / objectId / nick / avatar / comment / time，服务端最多 50 条 */
    function recent(limit) {
      var params = new URLSearchParams();
      params.set('type', 'recent');
      params.set('count', String(limit || 5));

      return request('/api/comment?' + params.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' }
      }).then(function (data) {
        return Array.isArray(data) ? data : [];
      });
    }

    /** 阅读量：Waline Counter 以路径为行、time 为累计值，返回与路径数组等长的数字数组 */
    function views(paths) {
      return counters(paths, 'time').then(function (rows) {
        return rows.map(function (row) { return row.time; });
      });
    }

    /**
     * 读计数器。paths 数组 + 类型（字符串或数组），
     * 返回与 paths 等长的 [{ type: value }]，缺失的行按 0 处理。
     * Waline 的 SQLite 模型只持久化 time / reactionN，自定义类型不会落库，
     * 所以访客数也走 time（见 waline-stats.js 的路径约定）。
     */
    function counters(paths, types) {
      var urls = Array.isArray(paths) ? paths : [];
      var keys = Array.isArray(types) ? types : [types || 'time'];
      var params = new URLSearchParams();
      params.set('path', urls.join(','));
      params.set('type', keys.join(','));

      return request('/api/article?' + params.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' }
      }).then(function (data) {
        return urls.map(function (path, index) {
          var row = Array.isArray(data) ? data[index] : null;
          var values = {};
          keys.forEach(function (key) {
            values[key] = Number(row && row[key]) || 0;
          });
          return values;
        });
      });
    }

    /** 计数器 +1（默认 time）。用于文章阅读量与站点访问统计 */
    function increment(path, type) {
      return request('/api/article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ path: path, type: type || 'time' })
      });
    }

    return {
      list: list,
      add: add,
      count: count,
      recent: recent,
      views: views,
      counters: counters,
      increment: increment
    };
  }

  /**
   * 按昵称 / 邮箱生成头像地址，规则与 Waline 服务端默认的 avatarUrl 一致：
   *  1. nick 是纯数字          → QQ 头像（nk=nick）
   *  2. mail 是 <数字>@qq.com  → QQ 头像（nk=数字）
   *  3. 其他                   → avatar_prefix + MD5(trim + lowercase mail)
   * 表单头像因此能和列表里服务端返回的头像保持一致。
   */
  function avatarUrl(mail, prefix, nick) {
    var normalizedMail = String(mail || '').trim().toLowerCase();
    var normalizedNick = String(nick || '').trim();

    if (/^[0-9]+$/.test(normalizedNick)) return qqAvatar(normalizedNick);

    var qq = normalizedMail.match(/^([0-9]+)@qq\.com$/);
    if (qq) return qqAvatar(qq[1]);

    if (!normalizedMail) return '';

    var base = String(prefix || DEFAULT_AVATAR_PREFIX);
    if (!/\/$/.test(base)) base += '/';
    return base + md5(normalizedMail);
  }

  function qqAvatar(number) {
    return 'https://q1.qlogo.cn/g?b=qq&nk=' + number + '&s=100';
  }

  // -------------------------------------------------------------------------
  // MD5（RFC 1321），只用于按邮箱拼 Gravatar / Libravatar 地址。
  // 核心算法取自 blueimp-md5（MIT）；输入先转 UTF-8 再按二进制字符串计算。
  // -------------------------------------------------------------------------
  function md5(input) {
    function safeAdd(x, y) {
      var lsw = (x & 0xffff) + (y & 0xffff);
      var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
      return (msw << 16) | (lsw & 0xffff);
    }

    function bitRotateLeft(num, cnt) {
      return (num << cnt) | (num >>> (32 - cnt));
    }

    function md5cmn(q, a, b, x, s, t) {
      return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
    }

    function md5ff(a, b, c, d, x, s, t) {
      return md5cmn((b & c) | (~b & d), a, b, x, s, t);
    }

    function md5gg(a, b, c, d, x, s, t) {
      return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
    }

    function md5hh(a, b, c, d, x, s, t) {
      return md5cmn(b ^ c ^ d, a, b, x, s, t);
    }

    function md5ii(a, b, c, d, x, s, t) {
      return md5cmn(c ^ (b | ~d), a, b, x, s, t);
    }

    function binlMD5(x, len) {
      x[len >> 5] |= 0x80 << (len % 32);
      x[(((len + 64) >>> 9) << 4) + 14] = len;

      var i;
      var olda;
      var oldb;
      var oldc;
      var oldd;
      var a = 1732584193;
      var b = -271733879;
      var c = -1732584194;
      var d = 271733878;

      for (i = 0; i < x.length; i += 16) {
        olda = a;
        oldb = b;
        oldc = c;
        oldd = d;

        a = md5ff(a, b, c, d, x[i], 7, -680876936);
        d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
        c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
        b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
        a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
        d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
        c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
        b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
        a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
        d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
        c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
        b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
        a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
        d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
        c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
        b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);

        a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
        d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
        c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
        b = md5gg(b, c, d, a, x[i], 20, -373897302);
        a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
        d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
        c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
        b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
        a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
        d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
        c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
        b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
        a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
        d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
        c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
        b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);

        a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
        d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
        c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
        b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
        a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
        d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
        c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
        b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
        a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
        d = md5hh(d, a, b, c, x[i], 11, -358537222);
        c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
        b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
        a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
        d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
        c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
        b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);

        a = md5ii(a, b, c, d, x[i], 6, -198630844);
        d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
        c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
        b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
        a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
        d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
        c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
        b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
        a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
        d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
        c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
        b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
        a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
        d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
        c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
        b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);

        a = safeAdd(a, olda);
        b = safeAdd(b, oldb);
        c = safeAdd(c, oldc);
        d = safeAdd(d, oldd);
      }

      return [a, b, c, d];
    }

    function binl2rstr(input) {
      var i;
      var output = '';
      var length32 = input.length * 32;
      for (i = 0; i < length32; i += 8) {
        output += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xff);
      }
      return output;
    }

    function rstr2binl(input) {
      var i;
      var output = [];
      output[(input.length >> 2) - 1] = undefined;
      for (i = 0; i < output.length; i += 1) output[i] = 0;

      var length8 = input.length * 8;
      for (i = 0; i < length8; i += 8) {
        output[i >> 5] |= (input.charCodeAt(i / 8) & 0xff) << (i % 32);
      }
      return output;
    }

    function rstrMD5(s) {
      return binl2rstr(binlMD5(rstr2binl(s), s.length * 8));
    }

    function rstr2hex(input) {
      var hexTab = '0123456789abcdef';
      var output = '';
      var x;
      var i;
      for (i = 0; i < input.length; i += 1) {
        x = input.charCodeAt(i);
        output += hexTab.charAt((x >>> 4) & 0x0f) + hexTab.charAt(x & 0x0f);
      }
      return output;
    }

    // UTF-8 → 二进制字符串（每字符一个字节）
    var utf8 = unescape(encodeURIComponent(String(input)));
    return rstr2hex(rstrMD5(utf8));
  }

  global.InalineWaline = {
    create: create,
    avatarUrl: avatarUrl,
    md5: md5,
    WalineError: WalineError
  };
})(window);
