# inaline-theme 设计规范

个人技术博客的 Hugo 主题设计文档。本文只记录**当前目标状态**与**后续计划**：
已实现的部分按现状写规范，未实现的部分写方向与待定项；变更过程交给 Git，历史方案不在这里保留。

状态标记：✅ 已实现 · ⏳ 待实现 / 待细化

---

## 1. 项目概述

| 项 | 值 |
| --- | --- |
| 站点语言 | 简体中文 |
| 主题色 | `#FA5D19` |
| 布局基调 | 列表页两栏（文章列表 + 右侧栏）；文章页为顶部大图（标题区叠在图上）+ 两栏正文卡片；首页为整页封面背景 + 通栏 Hero |
| 响应式 | ⏳ 统一在后续阶段实现；当前只有两栏 → 单栏的断点降级 |
| 技术形态 | Hugo 静态生成（SSR），无前端框架 |

---

## 2. 技术栈与约束

| 项 | 决定 | 说明 |
| --- | --- | --- |
| 模板 | Hugo Go Template | v0.165 extended，输出静态 HTML |
| 样式 | SCSS（LibSass 编译） | 分文件编写，Hugo 资产管道编译为单个 `main.min.<hash>.css` |
| 脚本 | 原生 JavaScript（ES6+） | 无框架、无构建工具链 |
| 图标 | Font Awesome 6 Free 6.7.2 | BootCDN 全量引入；主题自绘 SVG 走 `icon.html` |
| 字体 | 汉仪唐美人 `HYTangMeiRen55W` | 本地自托管 woff2，默认全站启用 |
| SPA | Swup.js | ⏳ 后续接入，当前不引入 |

禁止引入 Bootstrap、jQuery 等大型框架。

### 2.1 SCSS 编译器约束

Hugo extended 内置 LibSass，环境暂无 Dart Sass：

- 使用 `@import` 组织文件，不使用 `@use` / `@forward` / `math.div()`。
- 可用变量、嵌套、`&`、mixins、`rgba()` / `mix()` 等。
- ⏳ 待决策：LibSass 自 Hugo v0.153.0 起弃用。切换 Dart Sass 时把 `css.Sass` 的 `transpiler` 改为 `dartsass`，并把 `@import` 迁移为 `@use`；决策落定前保持现状。

### 2.2 全局样式约束

- 所有颜色、尺寸、阴影、动效参数只从 `_tokens.scss` 的 CSS 自定义属性取值，组件里不写死。
- 全站 `a:hover` 的特异度是 `(0,1,1)`。凡是把 `<a>` 当按钮或装饰用、且不希望它变主题色的地方，必须显式写一条 `:hover` 覆盖（如 `.hero-arrow:hover`）。
- `prefers-reduced-motion` 的覆写块必须放在对应文件末尾，并显式列出 `:hover` 变体：媒体查询不提升特异度，只能靠源顺序压过组件规则。
- 不允许 `<a>` 嵌套 `<a>`；文章卡片整卡可点，用 `data-card-href` + 点击监听实现，不铺覆盖层（见 §7.7）。

---

## 3. 设计令牌（Design Tokens）

全部以 CSS 自定义属性定义在 `_tokens.scss`。暗色模式通过 `dark-tokens` mixin 覆写同名变量，组件样式不感知主题。

### 3.1 品牌色与照片上的固定色

以下令牌**不随主题翻色**，只在 `:root` 定义：

```scss
--color-primary:        #FA5D19;                  // 主题色
--color-primary-hover:  #E14E0E;                  // 悬停加深
--color-primary-soft:   rgba(250, 93, 25, .10);   // 弱强调底色（Markdown mark 高亮等）
--color-on-primary:     #FFFFFF;                  // 主题色实心填充上的前景色
--color-over-hero:      #FFFFFF;                  // 封面图之上的前景色
--color-over-hero-soft: rgba(255, 255, 255, .85); // 略灰一档的前景（顶部态 Header、页脚）
--post-hero-scrim-top:   rgba(0, 0, 0, .45);      // 文章页大图顶部压暗（Header 白字兜底）
--post-hero-scrim-bottom: rgba(0, 0, 0, .72);     // 文章页大图底部深底（标题区）
--footer-scrim:         rgba(26, 26, 26, .48);    // 页脚深色毛玻璃底
--footer-blur:          3px;
--badge-bg:             #FFFFFF;                  // 置顶角标底色
--badge-fg:             #1F2328;                  // 置顶角标字色
```

社交图标品牌色（同样只在 `:root` 定义）：

```scss
--brand-rss: #F26522;  --brand-email: #3B82F6;  --brand-wechat: #07C160;
--brand-bilibili: #00AEEC; --brand-github: #181717; --brand-qq: #12B7F5;
```

> `--brand-github` 是唯一例外：近黑色在暗色卡片上会消失，暗色下翻为 `#FFFFFF`。
> 压在照片 / 深色上的色块（`--color-over-hero*`、`--post-hero-*`、`--footer-scrim`、`--badge-*`、`--glow-name`）
> 不跟主题翻色——它们坐在图片上，与页面底色无关。

### 3.2 中性色

| 变量 | 亮色 | 暗色 | 用途 |
| --- | --- | --- | --- |
| `--color-bg` | `#F5F5F5` | `#16181D` | 页面底色 / 画布兜底 |
| `--color-surface` | `#EBEBEB` | `#1E2127` | 贴身底板（行内代码等） |
| `--color-elevated` | `#FFFFFF` | `#1E2127` | 抬升层（卡片、浮层） |
| `--color-text` | `#1F2328` | `#E6E7E9` | 正文 |
| `--color-text-muted` | `#6B7280` | `#9AA1AC` | 次要文字 |
| `--color-border` | `#E5E7EB` | `#2C313A` | 描边 / 分割 |
| `--header-bg` | `rgba(255,255,255,.6)` | `rgba(22,24,29,.6)` | Header 与下拉面板 |
| `--hero-card-bg` | `transparent` | `rgba(16,18,22,.4)` | Hero 玻璃卡底色 |
| `--page-scrim` | `transparent` | `rgba(0,0,0,.35)` | 首页整页背景压暗 |

**层级语义**：`--color-surface` 是同级内容里的贴身底板，必须比页面底色和抬升层都深一档；
`--color-elevated` 是离地的一层，亮色下为纯白，靠底色差与阴影分层。暗色下两者同值。

### 3.3 字体

```scss
--font-system: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
               "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
--font-handwriting: "HYTangMeiRen", var(--font-system);
--font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

--font-body:    var(--font-handwriting);
--font-heading: var(--font-handwriting);
--font-ui:      var(--font-handwriting);
```

- 默认全站启用手写体；代码块 / 行内代码始终使用 `--font-mono`。
- ⏳ 预留 `:root[data-font="system"]` 切换回系统字体，设置面板后续实现。
- 字体文件约 3.6 MB（全字集 CJK），已用 `preload` 提前下载。
- ⏳ 根本优化是子集化（`pyftsubset`），未做前 3.6 MB 是首屏固定成本。
- 发布路径：`head.html` 用 `resources.Get` 发布，`_fonts.scss` 以 `../fonts/...` 相对引用，改一处需同步另一处。

### 3.4 尺寸、层级与动效

```scss
// 间距（4 的倍数）
--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 24px; --space-6: 32px; --space-7: 40px; --space-8: 48px;

// 圆角
--radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 24px;

// 阴影
--shadow-sm: 0 1px 2px rgba(0,0,0,.03), 0 2px 6px rgba(0,0,0,.04);
--shadow-md: 0 6px 18px rgba(0,0,0,.08);
--shadow-header: 0 2px 8px rgba(0,0,0,.06);
--shadow-dropdown: 0 2px 8px rgba(0,0,0,.06), 0 10px 28px rgba(0,0,0,.10);

// 发光（压在照片上，两种主题同值）
--glow-halo:  0 0 12px rgba(250,93,25,.45);         // 外围光晕（当前无引用，预留）
--glow-name:  0 0 16px rgba(255,255,255,.45), 0 0 42px rgba(255,255,255,.18); // Hero 名称

// Hero / 侧栏
--hero-card-blur: 24px;
--hero-avatar-size: 72px;
--profile-avatar-size: 96px;

// 布局
--container-width: 1200px;  // Header 与两栏页面容器
--content-width: 42rem;     // 单栏内容宽度（文章详情等）
--sidebar-width: 280px;
--carousel-height: 270px;   // 首页轮播图，与侧栏 profile 卡等高
--post-hero-height: clamp(240px, 30vw, 380px); // 文章页顶部大图：按视口宽度伸缩，不随窗口高度变化
--toc-body-max-height: min(500px, 55vh); // 侧栏目录列表滚动区上限（§8.5）
--toc-sub-max-height: 500px;             // 子目录展开动画的 max-height 上限（§8.5）
--header-height: 56px;
--header-blur: 20px;

// 层级
--z-header: 100; --z-dropdown: 110;

// 动效
--ease: cubic-bezier(.4, 0, .2, 1);
--ease-out: cubic-bezier(.22, 1, .36, 1); // 慢起快收：轮播缩放 / 文字落位
--duration-fast: 150ms;   // 颜色、图标
--duration-base: 250ms;   // 位移、下拉面板
--duration-slow: 600ms;   // 轮播淡入淡出、指示器
--duration-slower: 900ms; // 轮播图片缩放、文字落位
--duration-reveal: 800ms; // 页面进场 / 滚动进场
```

---

## 4. 工程规范

### 4.1 目录结构

```text
themes/inaline-theme/
├── assets/
│   ├── css/
│   │   ├── main.scss              # 入口：@import 汇总
│   │   ├── _tokens.scss           # 设计令牌（§3）
│   │   ├── _fonts.scss            # @font-face
│   │   ├── _base.scss             # reset + 基础排版 + 容器
│   │   ├── _page-bg.scss          # 首页整页背景（§7.1）
│   │   ├── _header.scss           # Header（§6）
│   │   ├── _hero.scss             # Hero（§7.2–§7.6）
│   │   ├── _post.scss             # 文章卡片 / 分页 / 标签（§7.7）
│   │   ├── _markdown.scss         # Markdown 正文排版（§9）
│   │   ├── _article.scss          # 文章页：顶部大图 / 标题区 / 正文两栏 / 信息卡（§8）
│   │   ├── _carousel.scss         # 首页轮播图（§7.10）
│   │   ├── _sidebar.scss          # 两栏骨架 + 侧栏（§7.8 / §8.5）
│   │   ├── _footer.scss           # 页脚（§7.9）
│   │   └── _motion.scss           # 进入 / 滚动进场动效（§5.3）
│   ├── js/
│   │   ├── main.js                # 全局：主题、Header 滚动态、页脚运行时长、整卡跳转、复制、进场动效
│   │   ├── pages/home.js          # 首页：一言打字机 + 背景切换 + 轮播图
│   │   └── pages/post.js          # 文章页：目录高亮 / 折叠 / 阅读进度（§8.5）
│   ├── images/cover/              # cover1–3.jpg，Hero 背景与卡片兜底同池
│   └── fonts/HYTangMeiRen55W.woff2
└── layouts/
    ├── baseof.html
    ├── home.html / page.html / section.html / taxonomy.html / term.html
    ├── posts/page.html            # 文章页（§8，覆盖通用 page.html）
    └── partials/
        ├── head.html              # meta、主题内联脚本、字体、CSS
        ├── header.html            # Header 外壳
        ├── nav-item.html          # 菜单项递归渲染（§6.5）
        ├── icon.html              # 主题自绘 SVG 图标（引号 + 社交品牌）
        ├── page-background.html   # 首页整页背景（§7.1）
        ├── hero.html              # Hero 内容（§7.2–§7.6）
        ├── carousel.html          # 首页轮播图容器与条目解析（§7.10）
        ├── carousel-body.html     # 轮播卡片文字区（§7.10）
        ├── cover-pool.html        # 封面图池（§7.1 / §7.7）
        ├── post-cover.html        # 单篇文章封面解析（§7.7 / §7.8）
        ├── post-card.html         # 文章卡片（§7.7）
        ├── article-meta.html      # 文章末尾信息卡（§8.6）
        ├── pager.html             # 分页（§7.7）
        ├── sidebar.html           # 右侧栏容器（§7.8）
        ├── sidebar-toc.html       # 侧栏目录卡片（仅文章页，§8.5）
        ├── toc-flat.html          # 标题树压平为 h2–h3 线性列表（§8.5）
        ├── toc-list.html          # 目录嵌套列表递归渲染（§8.5）
        ├── sidebar-profile.html   # 侧栏博主信息卡（§7.8）
        ├── sidebar-latest.html    # 侧栏最新文章（§7.8）
        ├── sidebar-comments.html  # 侧栏近期评论（§7.8）
        ├── sidebar-categories.html # 侧栏分类（§7.8）
        ├── sidebar-tags.html      # 侧栏标签云（§7.8）
        ├── relative-time.html     # 相对时间文案（§7.8）
        ├── footer.html            # 页脚六行（§7.9）
        └── footer-link.html       # 页脚链接生成
```

### 4.2 样式构建

```go-html-template
{{ $opts := dict "outputStyle" "compressed" "transpiler" "libsass" }}
{{ $css := resources.Get "css/main.scss" | css.Sass $opts | minify | fingerprint }}
<link rel="stylesheet" href="{{ $css.RelPermalink }}" integrity="{{ $css.Data.Integrity }}">
```

产物为单文件 `/css/main.min.<hash>.css`；源文件只按模块拆分，不产生多个 CSS 请求。

### 4.3 脚本组织

- `main.js`：全局逻辑，随每个页面加载（主题切换、Header 滚动态、页脚运行时长、整卡跳转（点击监听）、剪贴板复制、页面进入 / 滚动进场动效）。
- `js/pages/*.js`：页面级逻辑，由模板的 `page-scripts` block 按需引入（当前有 `home.js`、`post.js`）。
- 每个模块写成幂等 `init()`，事件用 `dataset.bound` 防重复绑定；后续接入 Swup 时在 `page:view` 再次调用同一 `init()` 即可。
- 全局入口暴露为 `window.inalineInit`，首页入口暴露为 `window.inalinePageInit`。
- 防闪烁的主题初始化脚本单独内联在 `head.html`，不进 `main.js`。

---

## 5. 全局机制

### 5.1 暗色模式 ✅

**策略**：跟随系统 → 用户手动覆盖 → `localStorage` 记忆。

- 存储键：`inaline-theme`（`light` / `dark`）
- 状态载体：`<html data-theme="light|dark">`
- 防闪烁：`<head>` 中、样式表之前内联同步脚本，读取存储或 `prefers-color-scheme` 后立即写 `data-theme`。
- CSS 三级兜底：`:root` 亮色 → `@media (prefers-color-scheme: dark)` 的 `:root:not([data-theme="light"])` → `:root[data-theme="dark"]`。
- `color-scheme` 同步声明，让滚动条与原生控件跟随。
- ⏳ 后续可扩展「自动 / 亮 / 暗」三态；当前为二态切换。

### 5.2 字体开关 ⏳

架构已预留 `data-font="system"`，设置面板后续实现。

### 5.3 页面进入与滚动动效 ✅

动效只是增强，不承担可见性：无 JS、`IntersectionObserver` 不可用或用户开启 `prefers-reduced-motion` 时**不加任何动画类**，内容按原样显示。

**入场（CSS）**

| 组件 | 行为 |
| --- | --- |
| Header | `.header-inner` 从上方 8px 淡入落位，`--duration-reveal`；动内层，避免占用 `.site-header` 的 `transform`（滚动显隐要用） |
| Hero 徽章 | `.hero-profile` 淡入 + 上移 24px，`--duration-reveal`，延迟 60ms |
| Hero 一言卡片 | `.hero-quote` 同款，`--duration-reveal`，延迟 140ms；`home.js` 的打字机顺延到 1100ms 后才开打 |
| Hero 下滚箭头 | 图标淡入 `--duration-reveal`，延迟 260ms；外层跳动动画不变 |

**滚动进场（JS + CSS）**

| 项 | 规格 |
| --- | --- |
| 入口 | `main.js` 的 `initReveal()`，幂等；在 `window.inalineInit` 中一并复用 |
| 目标 | `.page-header`、`.page-content`、`.term-list`、`.carousel`、`.post-list > .post-card`、`.sidebar > .sidebar-card`、`.pager`、`.post-header`、`.post-content`、`.site-footer` |
| 样式 | `.reveal` → `opacity: 0`；`.is-visible` 播放 `reveal-in`：`--duration-reveal`、`--ease-out`、`opacity 0 → 1`、`translate 24px → 0`，`animation-fill-mode: both` |
| 首屏 | `getBoundingClientRect()` 判断已在视口内的元素，按 DOM 顺序每项 +50ms（上限 300ms）直接进场 |
| 滚动 | 其余元素交给 `IntersectionObserver`：`rootMargin: 0 0 -8% 0`、`threshold: 0`，进场后立即 `unobserve`；同一批进场的元素按 40ms 依次错开（上限 200ms） |
| 冲突规避 | 用 `animation` 而非 `transition`，不覆盖卡片自身的悬停过渡；位移走独立 `translate` 属性，与 `.post-card:hover` 的 `transform` 叠加而非互相覆盖 |
| 兜底 | 观察器创建失败时立即显示全部待进场元素；键盘焦点进入未进场容器时先亮起；打印样式强制显示 |

---

## 6. Header 设计规格 ✅

### 6.1 整体布局

- 固定顶部：`position: fixed`，高度 `--header-height`（56px），`z-index: var(--z-header)`。
  用 `fixed` 而非 `sticky`，首页整页背景和 Hero 才能从 `y=0` 铺满并钻到 Header 底下。
- 背景 `--header-bg` + `backdrop-filter: blur(--header-blur)`；用 `--shadow-header` 分层，不用分割线。
- 内部三栏 Grid：`grid-template-columns: 1fr auto 1fr`，容器 `--container-width`，左右内边距 `--space-5`。中间导航绝对居中，不因左右宽度不等而偏移。
- 进场：`.header-inner` 从上方 8px 淡入落位，`--duration-reveal`（§5.3）；`prefers-reduced-motion` 下直接显示。
- 滚动态：滚动超过 8px 加 `.is-scrolled`，阴影升为 `--shadow-md`。
- 显隐：向下滚动且离开顶部安全区（Header 高度 + 24px）后加 `.is-hidden`（`translateY(-100%)`）收起；向上滚动立即展开；顶部安全区内恒展开；键盘焦点进入 Header 时强制展开。位移小于 8px 不判定方向。

### 6.2 左侧 Logo

- 纯文字 `site.Title`，链接首页，`--font-heading`，`1.5rem`。
- 常驻态无悬停变化（必须写 `.site-logo:hover` 压回 `--header-fg`，理由见 §2.2）。
- 首页顶部态例外：静止 `--color-over-hero-soft`，悬停 `--color-over-hero`。

### 6.3 中部导航

结构：`<ul class="nav-list">` → `.nav-item` → `.nav-link` → `.nav-label`（图标 + 文字 + 可选箭头）。

| 项 | 规格 |
| --- | --- |
| 默认态 | 图标与文字均为 `--header-fg`，无下划线 |
| 悬停 | 图标与文字变 `--color-primary` |
| 下划线 | 3px 圆角胶囊，挂在 `.nav-label` 上，从左向右以 `width` 生长，`--duration-base` |
| 下划线位置 | 文字下方 6px（`bottom: -6px`），宽度恒等于内容宽度（含箭头，不含内边距） |
| 选中态 | 与未选中完全一致，不做高亮 |
| 图标 | 顶级与下拉图标 0.875rem；顶级展开箭头 0.875rem；下拉内箭头 0.5625rem（FA 字形比 MDI 满，整体小一档） |

### 6.4 二级与多级菜单

| 项 | 规格 |
| --- | --- |
| 触发 | 鼠标悬停展开 / 移出收起；`:focus-within` 支持键盘操作 |
| 定位 | 二级相对 `.nav-item` 顶部居中（`top: 100%`）；三级及以下挂父项右侧（`left: 100%`） |
| 面板 | `--header-bg` + `blur(--header-blur)`，`--radius-md`，`--shadow-dropdown`，无描边，最小宽度 112px，内边距 `--space-1` |
| 动画 | 二级：`opacity` + `translateY(8px → 0)`；三级：`translateX(8px → 0)`；`--duration-base` |
| 子项 | 内边距 `--space-2 --space-3`；悬停实心填充 `--color-primary` + `--color-on-primary`，填充由 `::before` 从 `scale(.3)` 生长到 `scale(1)` |
| 子项发光 | 无。不加内高光 / 文字辉光 / 外光晕，避免溢出面板 |
| 展开指示 | 二级箭头旋转 180°，三级箭头旋转 90° |

### 6.5 导航配置

导航全部来自 `hugo.yaml` 的标准菜单 `menu.main`，模板不硬编码：`header.html` 遍历 `site.Menus.main`，`nav-item.html` 递归渲染 `.Children`。

```yaml
menu:
  main:
    - name: "首页"
      pageRef: "/"
      weight: 10
      params:
        icon: "fa-solid fa-house"
    - name: "更多"              # 有子项、无 pageRef → 渲染为 <button>
      identifier: "more"
      weight: 50
      params:
        icon: "fa-solid fa-ellipsis"
    - name: "归档"
      pageRef: "/archives/"
      parent: "more"
      weight: 10
      params:
        icon: "fa-solid fa-box-archive"
```

- 同级按 `weight` 升序，`weight` 相同再按名称；渲染顺序由 Hugo 的标准菜单排序决定。
- 层级用 `parent` 指向父项的 `identifier`；`site.Menus.main` 只返回顶级项，子项通过 `.Children` 递归展开。
- `pageRef` 由 Hugo 解析为真实链接（`MenuEntry.URL`）；外链直接写 `url`。
- 图标放在 `params.icon`，模板通过 `.Params.icon` 读取；填 Font Awesome 类名。
- 有子项且无 URL 的节点渲染为纯触发按钮；有 URL 的渲染为链接。
- 顶级项用 `.nav-item` + `.nav-dropdown`；更深层级用 `.nav-dropdown-item--has-children` + `.nav-submenu`。

### 6.6 右侧操作区

两个纯图标按钮（`.action-btn`，36×36，`--radius-sm`）：

| 按钮 | 图标 | 行为 |
| --- | --- | --- |
| 主题切换 | 亮色 `fa-moon` / 暗色 `fa-sun` | 切换 `data-theme` 并写入 `localStorage` |
| 搜索 | `fa-magnifying-glass` | 当前仅 UI，点击无反应（⏳ 面板后续实现） |

- 按钮内图标 `0.875rem`（FA 字形比 MDI 满，整体收一档）。
- 主题图标纯 CSS 切换：`.icon-when-light` / `.icon-when-dark` 按 `data-theme` 显隐。
- 悬停：`::before` 由中心生长出主题色实心填充，图标转白；不加发光、内高光与外光晕。
- `prefers-reduced-motion` 下取消生长过渡，填充直接显示。

### 6.7 首页 / 文章页顶部态

首页与带顶部大图的文章页未滚动时，Header 完全让位给封面图；滚动后自动恢复常驻样式。

| 属性 | 顶部态（未滚动） | 滚动后 / 无封面内页 |
| --- | --- | --- |
| 背景 | `transparent` | `--header-bg` |
| 毛玻璃 | 关闭 | `blur(--header-blur)` |
| 阴影 | 无 | `--shadow-header`（滚动后 `--shadow-md`） |
| 前景 | `--color-over-hero-soft` | `--color-text` |
| Logo 悬停 | `--color-over-hero` | 无变化 |
| 导航项悬停 | `--color-over-hero`，下划线仍为主题色 | `--color-primary` |
| 图标按钮悬停 | 主题色填充 + 白图标 + 辉光 | 同左 |

由 `body.has-hero`（首页）与 `body.has-post-hero`（文章页）限定，两者均由 `baseof.html` 添加；滚动后 `.is-scrolled` 生效，`:not()` 失配即还原。

### 6.8 Header JS

`main.js` 中两个模块，均幂等：

1. `initThemeToggle()`：点击 `.theme-toggle` 切换 `data-theme` 并持久化。
2. `initHeaderScroll()`：`scroll > 8px` 时加 `.is-scrolled`；按滚动方向切换 `.is-hidden`；焦点在 Header 内时不收起。

---

## 7. 首页

首页自上而下：整页固定背景 → Hero（作者徽章 + 一言卡片 + 下滚箭头）→ 两栏内容（文章列表顶部的轮播图 + 文章列表 + 右侧栏）→ 页脚。轮播图只在第一页渲染（§7.10）。
`params.description` 不在页面渲染，只作为 `<meta name="description">` 的来源。

### 7.1 整页背景 ✅

首页背景不是 Hero 的背景，而是**整个首页**的固定背景：从首屏一直铺到页脚，滚动时图像不动。

| 项 | 规格 |
| --- | --- |
| 容器 | `.page-bg`：`position: fixed`，`top/left/right: 0`，`height: 100vh` + `100lvh`，`z-index: -1`，`pointer-events: none`，底色 `--color-bg` |
| 图层 | 每张封面一个 `.page-bg-layer`（`position: absolute; inset: 0`），`background-size: cover`、`center`、`no-repeat`；`opacity: 0`，`.is-active` 时 `1` |
| 切换 | JS 挪 `.is-active`，`opacity` 600ms 交叉淡入；`prefers-reduced-motion` 下直接换 |
| 遮罩 | `.page-bg::after` 铺满，背景 `--page-scrim`；亮色透明，暗色 35% 黑 |
| 配置 | `params.hero.covers`：assets 路径列表；未配置 / 全部解析失败回退内置 `images/cover/cover1.jpg` |
| 初始图 | `params.hero.initial_cover`：封面路径 → 固定从它开始；`random` → 每次随机；留空 → 第一张 |
| 兜底 | `random` 时模板先做一次构建期随机（无 JS 兜底），`home.js` 在每次载入时重摇 |
| 切换按钮 | 卡片左下角左右箭头，仅当封面多于一张时渲染 |

**硬约束**：

- `.page-bg` 必须是 `<body>` 的第一个子元素。它靠负 `z-index` 落在画布之上、内容之下，中间不能隔带 `transform` / `filter` / `opacity` 的祖先。
- 首页 `body.has-hero` 必须透明，否则常规流背景会把负层级图层整块盖掉。
- 背景图 URL 由模板写进内联 `style`，不写进 SCSS：Hugo 不改写 SCSS 的 `url()`，而样式表会被指纹化。
- `height` 取 `100lvh` 而非 `inset: 0`：避免 iOS 地址栏收放时盒子重排、`cover` 重新取景导致图片跳动。

### 7.2 底部跳动箭头 ✅

| 项 | 规格 |
| --- | --- |
| 位置 | `left: 50%; bottom: --space-6`，48×48，图标 `fa-chevron-down` @ `1.75rem` |
| 颜色 | `--color-over-hero`，静态填充 |
| 动画 | `hero-arrow-bounce` 2s 无限循环，`translateY(0 → 12px)` 与 `opacity` 同步 |
| 进场 | 图标 `hero-arrow-in` 淡入 `--duration-reveal`，延迟 260ms；不打断跳动 |
| 缓动 | 逐帧声明：下行 `cubic-bezier(.55,.55,.75,1)`，回程 `cubic-bezier(.25,0,.45,.45)`（下行的镜像） |
| 透明度 | 最高点 `1`，最低点 `.7` |
| 层级 | `z-index: 1`，在压暗遮罩之上 |
| 可读性 | `filter: drop-shadow(0 2px 6px rgba(0,0,0,.35))` |
| 悬停 | 无反馈，`:hover` / `:focus` 显式锁回白色 |
| 行为 | `<a href="#home-content">`，CSS 平滑滚动到文章列表 |

- `@keyframes` 每帧都必须带 `translateX(-50%)`，否则动画接管 `transform` 后箭头会丢掉居中。
- 页面锚点统一由 `html { scroll-behavior: smooth }` 接管，`reduced-motion` 下回退 `auto`。
- `#home-content` 设 `scroll-margin-top: calc(--header-height + --space-4)`，避免落点被 fixed Header 盖住。

### 7.3 Header 顶部态 ✅

见 §6.7。

### 7.4 首页布局 ✅

- `.main` 补 `padding-top: calc(--header-height + --space-6)`，因为 Header 是 fixed。
- 首页 `<main>` 加 `.main--home`，`padding-top: 0`，Hero 铺满首屏。
- Hero 之后的内容由 `.hero + .container` 补回 `--space-6` 间距。
- 首屏内容锚点 `#home-content` 指向文章列表容器。

### 7.5 Hero 中央一言卡片 ✅

结构：`.hero-stage`（`position: absolute; inset: 0` 的 flex 列）同时承载作者徽章与一言卡片，整组垂直居中。

| 项 | 规格 |
| --- | --- |
| 配置 | `params.hero.hitokoto`：字符串列表；不配置则整张卡片不渲染 |
| 进场 | 淡入 + 上移 24px，`--duration-reveal`，延迟 140ms；打字机顺延到 1100ms 后开打（§5.3） |
| 尺寸 | `width: max-content`，`min-width: 680px`，`max-width: 75vw`；`min-height: 140px`；内边距 `--space-8` 上下、`--space-8 + --space-4` 左右 |
| 外观 | `background: --hero-card-bg` + `backdrop-filter: blur(--hero-card-blur)`；`--radius-xl`；无描边、无投影 |
| 引号 | 左上 / 右下各一个，同一 SVG 旋转 180°，`2rem`，`--color-over-hero` @ `opacity: .35`，内缩 `--space-5` |
| 文字 | `--color-over-hero`，`1.25rem / 1.9`，居中，带暗色投影兜底 |
| 光标 | 2px 竖条，`1.1em` 高，`steps(2, jump-none)` 方波闪烁；打字 / 删除期间常亮 |
| 时序 | 打字 110ms/字（中文标点后 +260ms）→ 停留 2800ms → 删除 45ms/字 → 500ms 后下一条 |
| 随机 | 首条固定为配置第一条；之后随机且不与当前条重复；只有一条时打完停住 |
| 暂停 | 鼠标悬停或键盘焦点（`:focus-visible`）在卡片内时暂停；移开 / 失焦按剩余时间续上 |
| 降级 | 无 JS：静态渲染第一条；`reduced-motion`：静态展示随机一条，光标隐藏 |
| 切换按钮 | 卡片左下角左右箭头（24×24，`opacity: .55` → 悬停 1），仅多于一张封面时渲染 |

- 卡片尺寸完全跟随可见文字，不预留整句宽高：打字时宽度增长，到 `75vw` 封顶后折行，高度由内容撑高。
- 卡片内的角落引号、切换按钮均为绝对定位，不进 flex 流，不参与卡片尺寸计算。

### 7.6 博主头像与名称 ✅

| 项 | 规格 |
| --- | --- |
| 位置 | `.hero-profile` 是 `.hero-stage` 的第一个子项，与卡片间距 `--space-5`；整组（徽章 + 卡片）垂直居中 |
| 进场 | 淡入 + 上移 24px，`--duration-reveal`，延迟 60ms，比卡片早半步落位（§5.3） |
| 块高 | `height: --hero-avatar-size`（72px），钉住外接框，避免名称行盒的留白把整组压低 |
| 配置 | `params.hero.avatar`：网络 URL 原样引用；本地 assets 路径走 `resources.Get`；留空则整块不渲染（名称也不渲染） |
| 头像 | `--hero-avatar-size` 圆形，`object-fit: cover`，2px 半透明白圈；悬停顺时针转一圈，移出逆时针转回（`transition` 500ms，`reduced-motion` 下不转） |
| 名称 | `params.author`，`3.5rem`，字重 500，字距 `.02em`，`--color-over-hero` |
| 名称发光 | 暗色投影兜底 + `--glow-name` 双层白色辉光（近层收边、远层弥散） |

### 7.7 文章卡片与分页 ✅

首页、分区页、标签词条页共用一套卡片。

| 项 | 规格 |
| --- | --- |
| 模板 | `post-card.html`（`page` + `index`）、`pager.html`（`paginator`）、`cover-pool.html` |
| 布局 | 左图右文；奇数条图在左、偶数条图在右（`.post-card--flip` → `row-reverse`）；图文间距 `--space-5` |
| 卡面 | `--color-elevated` + `--shadow-sm` + `--radius-lg`，`overflow: hidden`，无整卡内边距 |
| 悬停 | 卡片 `--shadow-md` + `translateY(-2px) scale(1.01)`；封面只在封面自身悬停时 `scale(1.04)`；`reduced-motion` 下撤掉位移 / 缩放，保留颜色与阴影 |
| 封面 | 宽 300px，`aspect-ratio: 3 / 2` 作为下限，`align-self: stretch` 撑满卡片全高，`object-fit: cover`；外层 `clip-path` 斜切一角 |
| 斜切 | 非交替卡切右上（`polygon(0 0, 92% 0, 100% 100%, 0 100%)`），交替卡镜像切左上；斜切挂在封面层而非 `<img>`，悬停放大时斜边不动 |
| 元信息 | 四项一排、排在标题上方：发布时间 / 阅读时长 / 阅读量 / 评论量；文字 `0.875rem`、图标 `0.8125rem`，`--color-text-muted`，项间距 `--space-4` |
| 阅读时长 | `countrunes(replaceRE "\s+" "" (plainify .Content)) ÷ 400`，向上取整，下限 1 分钟；不用 Hugo 的 `.ReadingTime`（按空格切词，中文失真） |
| 统计占位 | 阅读量 / 评论量输出 `—`，挂 `.post-card-stat`，待 Waline 回填 |
| 标题 | `1.5rem`；悬停变 `--color-primary` |
| 摘要 | `or .Description .Summary` → `plainify` + `truncate 120`，CSS `line-clamp: 2` |
| 封面配置 | front matter `cover`：网络 URL 或 assets 路径；未配置则从封面池按 `index` 轮换 |
| 可点区 | 整卡可点：标题与封面仍是真链接（封面链接 `tabindex="-1"` + `aria-hidden="true"`，标题链接的视觉重复）；卡片其余区域由 `data-card-href` + 点击监听跳转 |
| 整卡点击 | 不铺覆盖层：覆盖层会接走全部指针事件，标题与摘要无法选中 / 复制。点击监听放过拖选文字后的那次 click，卡片文字保持可选中；带修饰键的点击不接管，新标签页走标题链接 |
| 置顶角标 | `pinned: true` → 白底圆角标签 + `fa-thumbs-up` + "置顶"；贴封面外侧上角（交替卡镜像），`pointer-events: none`；`--badge-*` 两主题同值 |
| 分页 | 按 `pagination.pagerSize`（10）；左右箭头 + `1 2 3` 页码；页数多时只显示首尾页与当前页前后各一页，中间用 `…` 收拢；总数不超过一页时不渲染 |
| 分页边界 | 首页不渲染上一页箭头，末页不渲染下一页箭头（不做置灰态） |
| 分页悬停 | 仅可点链接改变文字颜色，不改变背景色；当前页无悬停反馈 |

### 7.8 两栏布局与右侧栏 ✅

| 项 | 规格 |
| --- | --- |
| 骨架 | `.container.container--wide.layout`：容器定宽居中，`.layout` 提供栅格；主栏 `.layout-main`，侧栏 `.sidebar` 平级 |
| 栅格 | `grid-template-columns: minmax(0, 1fr) var(--sidebar-width)`，间距 `--space-5`，`align-items: start` |
| 宽度 | 容器 1200（含左右内边距各 24）→ 内容 1152；侧栏 280，主栏 848 |
| 断点 | `max-width: 1080px`：转单列并 `display: none` 侧栏，不做"侧栏变窄"的中间态 |
| 侧栏 | 纵向 flex，间距 `--space-5`；占位卡 `.sidebar-card` 与文章卡片同语言（`--color-elevated` + `--shadow-sm` + `--radius-lg`，`min-height: 120px`） |
| 已实现组件 | 博主信息卡 `sidebar-profile.html`、目录 `sidebar-toc.html`（仅文章页，排在博主卡之后，见 §8.5）、最新文章 `sidebar-latest.html`、近期评论 `sidebar-comments.html`、分类 `sidebar-categories.html`、标签 `sidebar-tags.html`；文章页侧栏只渲染博主卡与目录 |
| 待实现组件 | 公告（占一张 `.sidebar-card`，带独立 `enable` 开关） |

**博主信息卡**：

- 配置 `params.sidebar.profile`：`enable`、`avatar`（留空沿用 `hero.avatar`）、`name`（留空取 `params.author`）、`socials`。
- 头像 96px 圆形居中；名称 `1.125rem`、字重 500；整卡文字居中。
- 三项数据等宽排列：文章数（`posts` 分区常规页数量）、字数（各篇 `.WordCount` 求和，五位数以上折为"万"）、评论数（占位 `--`，`data-sidebar-stat="comments"`）。
- 联系方式按配置顺序渲染：`rss / email / wechat / bilibili / github / qq`，32px 圆形按钮，默认品牌色图标，悬停品牌色铺满 + 图标转白 + 上浮 2px，按下回压。
- 有 `url` 的生成链接（站内路径过 `relURL`，外链新标签页）；有 `copy` 的生成复制按钮，复制成功弹"已复制"气泡；两者都没有的条目跳过。
- GitHub 品牌色在暗色下翻白，图标前景取 `--color-elevated` 保证可见。

**最新文章卡**：

- 配置 `params.sidebar.latest`：`enable`、`title`（默认"最新文章"）、`count`（默认 5）。
- 数据取 `posts` 分区常规页，按发布日期倒序取前 `count` 篇；无文章时整卡不渲染。
- 标题行：`fa-regular fa-clock` 图标（与标题同色，`1.0625rem`）+ 文案，`1rem / 500`。
- 列表每条整行一个链接：左侧 60×60（1:1 居中裁切）缩略图，右侧标题（最多两行）与日期；图与文字块在行内垂直居中，列表项间距 `--space-4`。
- 缩略图与文章卡片共用 `post-cover.html`：优先 front matter 的 `cover`，未配置则从封面池按序号轮换。
- 悬停：整行标题转主题色，缩略图 `scale(1.04)`（外层圆角裁切）；`reduced-motion` 下取消缩放。

**近期评论卡**：

- 配置 `params.sidebar.comments`：`enable`、`title`（默认"近期评论"）、`count`（默认 5）。
- 评论系统（Waline）尚未接入，当前列表由模板内的占位数据渲染；卡片带 `data-sidebar-comments` 锚点，接入后由前端回填。
- 标题行：`fa-regular fa-comment` 图标（与标题同色，`1.0625rem`）+ 文案，规格同最新文章卡。
- 列表每条间距 `--space-4`。每条为整行链接（没有文章可指时退化为静态条目）：左侧 32px 圆形头像，图片 `object-fit: cover` 裁圆，缺省以名字首字作占位。
- 右侧上排：用户名（`0.8125rem / 500`，靠左，超长省略）与相对时间（`0.75rem`，`--color-text-muted`，靠右）；下排正文 `0.75rem`、最多两行。
- 相对时间由 `relative-time.html` 在构建时计算：1 分钟内"刚刚"，之后依次"N 分钟前 / N 小时前 / N 天前"，超过 7 天显示 `2006年1月2日`。`<time datetime>` 同时输出绝对时间。
- 悬停整行链接时用户名转主题色，时间与正文保持弱化。

**分类卡**：

- 配置 `params.sidebar.categories`：`enable`、`title`（默认"分类"）、`count`（默认 8）。
- 数据取 `site.Taxonomies.categories`，按文章数降序取前 `count` 项；没有分类时整卡不渲染。
- 标题行：`fa-regular fa-folder-open` 图标 + 文案，规格同最新文章卡。
- 列表每条为整行链接：分类名（`0.875rem`，超长省略）靠左，文章数（`0.75rem`，`--color-text-muted`，等宽数字）靠右。
- 行内边距 `--space-1 --space-2`、圆角 `--radius-sm`；列表左右各外扩 `--space-2`，悬停的 `--color-bg` 浅底能贴到卡片内边距边缘，文字仍与标题对齐。
- 悬停：行底铺 `--color-bg`，分类名转主题色；`reduced-motion` 下取消过渡。

**标签卡**：

- 配置 `params.sidebar.tags`：`enable`、`title`（默认"标签"）、`count`（默认 20）。
- 数据取 `site.Taxonomies.tags`，按文章数降序取前 `count` 项；没有标签时整卡不渲染。
- 标题行：`fa-solid fa-tags` 图标 + 文案，规格同最新文章卡。
- 标签为可换行的胶囊：`flex-wrap`、间距 `--space-2`，圆角 `999px`，底色 `--color-bg`，标签名 `0.75rem` `--color-text-muted`，文章数 `0.6875rem`、`opacity: .7`。
- 悬停：整颗胶囊铺主题色 `--color-primary`，文字转 `--color-on-primary`；`reduced-motion` 下取消过渡。
- 超长标签名在胶囊内省略，不撑破卡片。

### 7.9 页脚 ✅

深色毛玻璃条：`--footer-scrim` + `backdrop-filter: blur(--footer-blur) saturate(1.08)`，白字 `--color-over-hero-soft`，`0.875rem / 1.6`，居中，上下 `--space-6`。除文章页外，全站唯一不随主题翻色的深色块。

文章页（`body.has-post-hero`）的页脚下方没有整页背景图，因此不铺遮罩：透明底、取消毛玻璃，文字改用 `--color-text-muted`，链接悬停改为 `--color-primary-hover`。

六行自上而下全部可选，任一行留空 / 关闭即不渲染：

1. **备案号**：`footer.filings[]`，`text` 为空跳过；有 `url` 自动生成链接。
2. **Powered by**：`footer.powered_by` 开关，链接 Hugo 与主题仓库。
3. **访客统计**：`footer.stats` 开关，今日访客 / 今日访问 / 累计访客 / 累计访问，当前输出 `--`，挂 `data-footer-stat` 待回填。
4. **运行时长**：`footer.since`（RFC 3339），模板构建时先算初值，`main.js` 之后每秒按 `Date.now()` 重算（后台节流也不会走慢）。
5. **底部链接**：`footer.links[]`，默认 RSS 与 Sitemap；站内路径过 `relURL`，外链新标签页 + `rel="noopener"`。
6. **版权**：`Copyright {copyright_since}-{今年} {site.Title}. All Rights Reserved.`；起始年与今年相同或未配置时只显示今年。

分隔符 `|` 使用 `.footer-sep`（`opacity: .45`），链接与数字取主题色，悬停转纯白。

### 7.10 首页轮播图 ✅

位于首页文章列表顶部，仅 `Paginator.PageNumber == 1` 渲染；分区页 / 标签页不出现。

| 项 | 规格 |
| --- | --- |
| 配置 | `params.carousel`：`enable`、`autoplay`、`interval`、`items` |
| 条目引用 | `slug`：查找 `posts` 下文章，自动取标题 / 摘要 / 日期 / 封面 / 链接 |
| 条目手动 | `title` / `summary` / `date` / `image` / `url`，可与 `slug` 混排 |
| 图片 | `image` 支持网络 URL 与 assets 路径；未配 / 解析失败回退封面池（与文章卡片同池） |
| 卡片 | 统一为整图背景：图片铺满，底部线性渐变压暗，日期 / 标题 / 摘要压在底部；标题为链接时悬停加下划线 |
| 点击 | 有 `url` 的条目整卡可点（`data-card-href` + 点击监听）；指示器与标题链接保留原生行为，拖选文字不跳转 |
| 尺寸 | 与主栏同宽；桌面高度取 `--carousel-height`（270px，与侧栏 profile 卡等高，首行底边对齐）；≤1080px 侧栏隐藏后恢复 `aspect-ratio: 3 / 1` + `min-height: 220px`；`--radius-lg` + `--shadow-sm` |
| 切换 | 右侧竖向圆形指示器；未选中 12px 白色圆点（无阴影 / 描边），选中拉长为 32px（两个圆点 + 间距），高度 / 颜色过渡 `--duration-slow` |
| 过渡 | 幻灯片交叉淡入淡出 `--duration-slow`；图片从 `scale(1.1)` 缓落到 1（`--duration-slower`），文字延迟 100ms 向上落位 |
| 悬停 | 鼠标移入 / 键盘焦点进入（`:focus-visible`）时，当前图片放大到 `1.04` 并加 `blur(2px)`，`--duration-base`；与文章封面同一档缩放。鼠标点击指示器留下的焦点不算，移开鼠标即复原 |
| 悬停分层 | 缩放 / 模糊挂在外层 `.carousel-bg-wrap`，换片的 `scale(1.1 → 1)` 挂在 `.carousel-bg`，两段 `transform` 互不覆盖 |
| 自动轮播 | `autoplay: true` 时按 `interval`（默认 6000ms）切换；悬停 / 键盘焦点进入 / 页面隐藏时暂停（鼠标点击指示器留下的焦点不算） |
| 降级 | `prefers-reduced-motion` 下不自动播放，取消淡入 / 缩放 / 位移 / 悬停反馈与指示器过渡 |
| 可访问性 | 非当前幻灯片 `inert` + `aria-hidden="true"`；指示器为 `button`，当前项 `aria-current="true"` |

---

## 8. 文章页 ✅

文章页模板为 `layouts/posts/page.html`，覆盖通用 `page.html`；关于页等其他普通页面不受影响。

自上而下：顶部通栏大图（居中标题区叠在图上）→ 两栏正文（左侧正文卡片 + 右侧栏）；正文卡片末尾附文章信息卡（§8.6）。文章页侧栏只保留博主信息卡与目录：博主卡在前，目录在后；目录滚到 Header 下沿后吸顶并伴随整篇文章（§8.5）。

### 8.1 顶部大图

| 项 | 规格 |
| --- | --- |
| 容器 | `.post-hero`：`position: relative`，flex 列、`justify-content: flex-end`；`min-height: --post-hero-height`（`clamp(240px, 30vw, 380px)`），按视口宽度伸缩、不随窗口高度变化；窄屏标题区变高时允许大图一起撑高 |
| 图片 | 复用 `post-cover.html`：front matter 的 `cover` 优先，未配置 / 解析失败回退封面池；绝对定位铺满，`object-fit: cover`，`fetchpriority="high"` |
| 压暗 | `::after` 双层渐变：顶部 `--post-hero-scrim-top` → 28% 处透明（Header 白字兜底）；底部 `--post-hero-scrim-bottom` → 58% 处过渡到 `--post-hero-scrim-top` → 顶部透明，为标题区铺深底 |
| 起点 | 大图从 y=0 起铺。`baseof.html` 给文章页 `<main>` 加 `.main--post`（`padding-top: 0`） |

### 8.2 标题区（叠在大图上）

- `.post-header` 仍用 `.container`（`--content-width`）居中；顶部内边距 `calc(--header-height + --space-2)` 给 fixed Header 让位，底部 `calc(--space-8 + --space-4)`，整体比贴底时上提一档。
- 标题 `clamp(1.75rem, 4vw, 2.5rem)`，白色、`text-wrap: balance`；不再加文字投影，靠大图遮罩保证可读。
- 基本信息：图标 + 文案「发布于：…」「阅读时长：…」「字数：…」，横排、居中换行，颜色 `--color-over-hero-soft`；相邻信息之间用独立的 `.post-meta-sep` 竖线元素（1px 宽，颜色 / 高度与文字一致，左右间距由 `.post-meta` 的 `--space-2` gap 提供，`aria-hidden`）。阅读时长沿用文章卡片算法（正文去空白字符数 ÷ 400，向上取整、下限 1 分钟），字数取同一字符数。
- 分类与标签同排居中，均为纯文字链接：每组前放一枚组图标（分类 `fa-folder-open`、标签 `fa-tags`，`aria-hidden`，不写文字标签）；链接颜色 `--color-over-hero-soft`，标签保留 `#` 前缀，悬停提亮并加下划线；无对应术语时整组不渲染。

### 8.3 正文两栏

- 容器复用 `.container--wide` + `.layout.layout--post`（与首页文章列表同一套宽度），上方留 `--space-6`；主栏桌面宽度与首页文章列表一致（1200 − 48 内边距 − 24 栏间距 − 280 侧栏 = 848）。
- 正文 `.post-content` 本身就是一张卡片：`--color-elevated` + `--shadow-sm` + `--radius-lg`，内边距 `--space-6`，视觉语言与侧栏 `.sidebar-card` 一致；卡片宽度对齐首页文章列表的 848px，窄屏时居中收窄。卡片内部由 `.markdown` 承载正文，末尾追加 `.article-meta` 信息卡（§8.6）。
- 复用 `.layout` / `.layout-main` / `partial "sidebar.html"`；`.layout--post` 把侧栏拉满主栏高度（给目录 sticky 留行程，§8.5）；`≤1080px` 时随 `.layout` 一起撤掉侧栏，正文卡片居中。
- 正文元素的基础排版统一在 `_markdown.scss`，容器加 `.markdown` 类；图片统一 `max-width: 100%`，避免原图撑破内容列。

### 8.4 Header 顶部态

文章页带 `body.has-post-hero`，顶部 Header 与首页一致：透明、无毛玻璃、无阴影、白字；滚动超过 8px 加 `.is-scrolled` 后恢复常驻样式（§6.7）。

### 8.5 侧栏目录 ✅

文章页侧栏的第二张卡是目录（博主信息卡之后）：正文的 h2 / h3 两级，标题 id 由 Hugo 构建时生成。

| 项 | 规格 |
| --- | --- |
| 模板 | `sidebar-toc.html` 组装卡片；`toc-flat.html` 把 `.Fragments.Headings` 递归压平并过滤为 h2–h3；`toc-list.html` 把线性列表递归渲染成嵌套 `<ul>`。`sidebar.html` 在 `.IsPage` 且 `.Type == "posts"` 时只渲染博主卡 + 目录（目录在后），其他页面不渲染目录 |
| 数据 | `.Fragments.Headings`（页面全部标题树，id 由 Hugo 生成）；只取 Level 2–3，不依赖 `markup.tableOfContents` 配置 |
| 配置 | `params.sidebar.toc`：`enable`、`title`（默认"文章目录"）、`min_headings`（默认 2） |
| 渲染门槛 | 压平后的标题少于 `min_headings` 时整卡不渲染 |
| 卡片 | `position: sticky`，`top: calc(--header-height + --space-4)`，`z-index: 1`；文章页 `.layout--post` 让 `.sidebar` 拉满主栏高度，sticky 才有行程伴随整篇文章；标题行沿用 `.sidebar-title`，右侧 `.toc-progress` 显示阅读进度（主题色、等宽数字） |
| Header 联动 | Header 向下滚动收起（`.site-header.is-hidden`）时，`body:has(...) .sidebar-toc` 把 `top` 改为 `--space-4`，目录同步上移一个 `--header-height`；Header 展开即回到原位。`top` 过渡 `--duration-base`，与 Header 的位移同拍；`prefers-reduced-motion` 下取消过渡。 |
| 列表 | `.article-toc` 独立滚动：`max-height: --toc-body-max-height`（`min(500px, 55vh)`）、`overscroll-behavior: contain`，标题与进度不随列表滚走 |
| 条目 | 内边距 `--space-1 --space-2`、`--radius-sm`，`0.875rem / 500`，默认 `--color-text`；长标题任意位置折行；悬停浅底 `--color-bg` + 主题色 |
| 当前项 | 主题色实心块 + `--color-on-primary` 文字；由 `post.js` 维护 `.is-active` 与 `aria-current="location"` |
| 折叠 | 有子项的条目在链接之后、行尾最右侧渲染 `<button class="toc-item-toggle">`（chevron 0.625rem，按钮外框 24px）；条目用 flex 排布，链接 `flex: 1`，子列表 `flex-basis: 100%` 独占下一行。子列表默认 `.expanded`，折叠时移除该类并加 `inert`，`max-height: 0 → --toc-sub-max-height`、`opacity: 0 → 1`，`--duration-base`；按钮同步 `.collapsed` 旋转 -90°，并更新 `aria-expanded` / `aria-label` |
| 自动折叠 | 滚动时只展开当前项所在分支（含祖先），其余父项自动收起；点击目录项会先展开目标分支再跳转 |
| 目录内滚动 | 列表溢出时把当前项滚到列表中线；`prefers-reduced-motion` 下改为瞬时定位 |
| 落点 | `.markdown` 的 h1–h6 统一 `scroll-margin-top: calc(--header-height + --space-4)`，跳转后标题不被 fixed Header 盖住 |
| 高亮算法 | 自上而下找最后一个 `top <= Header 高度 + 24px` 的标题；滚到页面底部时强制点亮最后一项；滚动用 `requestAnimationFrame` 节流 |
| 阅读进度 | 视口中线走过的 `.post-content .markdown` 高度占比，四舍五入为整数百分比；与滚动高亮共用同一 rAF 节流 |
| 脚本入口 | `assets/js/pages/post.js`，由 `layouts/posts/page.html` 的 `page-scripts` block 引入；幂等 `init()`，暴露 `window.inalinePageInit` |
| 降级 | 无 JS 时目录仍可点击跳转、子列表默认全部展开，只是没有高亮、进度与自动折叠；`prefers-reduced-motion` 下取消折叠 / 颜色 / 目录内滚动的过渡 |

### 8.6 文章末尾信息卡 ✅

正文卡片末尾的内嵌浅色面板，参考 inaline.net 的 `.article-meta-info`。由 `partials/article-meta.html` 渲染，只在文章页出现；外层仍是 `.post-content` 卡片，面板自身不套阴影。

| 项 | 规格 |
| --- | --- |
| 结构 | `.post-content` 内：`.markdown` 正文 → `aside.article-meta` |
| 标题 | 文章标题，`1rem / 600` |
| 固定链接 | `.Permalink`，14px / 1.6；长 URL 任意位置折行 |
| 链接样式 | 固定链接与许可协议链接复用 Markdown 链接样式（§9.3）：前置 `fa-link`、行尾外链图标、点状下划线、悬停主题色胶囊 |
| 统计项 | `<dl>` 四列：作者 / 发布于 / 更新于 / 许可协议；`dt` 12px muted，`dd` 14px 正文色，`gap: --space-4`（16px） |
| 作者 | front matter `author` → `params.author` → `—` |
| 日期 | 发布于 `.Date`、更新于 `.Lastmod`，格式 `2006-01-02`；零值显示 `—` |
| 许可 | `params.article_meta.license.name/url`；有 url 时新标签打开，只有 name 时纯文本，均未配置时显示"保留所有权利" |
| 面板 | `--color-bg` 底 + `--radius-md`；外边距 `--space-4`（16px）、内边距 `calc(--space-4 + --space-1)`（20px）；URL 行下留 `--space-3`（12px）；无分割线 |
| 响应式 | 统计四列；`≤768px` 折为两列 |
| 动效 | 链接颜色 `--duration-fast`；`prefers-reduced-motion` 下取消 |

### 8.7 待补充 ⏳

- 代码块工具栏：语言标签 / 复制按钮。
- 上一篇 / 下一篇。
- 移动端断点与顶部大图高度微调。

---

## 9. Markdown 正文排版 ✅

所有 Markdown 内容的排版集中在 `assets/css/_markdown.scss`，由内容容器上的 `.markdown` 类启用：
文章正文（`layouts/posts/page.html`）、普通页面（`layouts/page.html`）、分区页内容（`layouts/section.html`）。
容器自身的卡片、宽度与栅格仍归 `_article.scss` / `_post.scss`，本文件只处理内容元素。

### 9.1 作用域与基础

| 项 | 规格 |
| --- | --- |
| 作用域 | `.markdown`；首尾直接子元素的外边距归零，容器内边距负责留白 |
| 基础字号 | `1rem / 1.9`；`overflow-wrap: break-word` |
| 段落 | `margin: 0 0 1.1em`，`text-wrap: pretty` |
| 过渡 | 链接与 `summary` 的颜色 `--duration-fast`；`prefers-reduced-motion` 下取消 |

### 9.2 标题

| 层级 | 规格 |
| --- | --- |
| h1–h6 公共 | 字重 500、`line-height: 1.35`、`text-wrap: balance`、`scroll-margin-top: calc(--header-height + --space-4)`；标题内的链接跟随标题色、无下划线 |
| h1 | `1.875rem`，底部 1px 分割线 |
| h2 | `1.5rem`，左侧 3px 主题色短竖条（`::before`），上间距 `--space-8` |
| h3 | `1.25rem`，上间距 `--space-6` |
| h4 / h5 / h6 | `1.125rem` / `1rem` / `.9375rem`；h6 用 `--color-text-muted` |

### 9.3 行内元素

| 元素 | 规格 |
| --- | --- |
| 链接 | 文字色 + 点状下划线（链接背景图：1px 圆点 / 4px 间距）+ 前置 `fa-link` + 行尾外链图标（FA `arrow-up-right-from-square`）；悬停整颗铺主题色、文字与图标转白、点状线被实心背景覆盖；标题内链接、图片链接、脚注引用不套用该样式；文章信息卡内的链接复用同一 mixin（§8.6）；`:focus-visible` 主题色描边 |
| strong / em | 字重 600 / 斜体 |
| del | `--color-text-muted` |
| mark | `--color-primary-soft` 底 + 小圆角 |
| kbd | `--color-surface` 底、1px 描边（下边 2px）、等宽字体、`--radius-sm` |
| sup / sub | `.75em`，`line-height: 0`，相对定位 |
| abbr | 虚线下划线 + `cursor: help` |

### 9.4 块级元素

| 元素 | 规格 |
| --- | --- |
| 列表 | `padding-left: 1.6em`；条目间 `.25em`；`::marker` 主题色，序号等宽 |
| 任务列表 | `li:has(> input[type="checkbox"])` 去圆点；checkbox `accent-color: --color-primary` |
| 引用 | 左侧 3px 主题色、`--color-surface` 底、右侧 `--radius-sm`；嵌套引用改灰边 + 透明底 |
| 行内代码 | `--font-mono`、`--color-surface` 底、1px 描边、`--radius-sm` |
| 代码块 | `.highlight` 留外距；`pre` 内边距 `--space-4 --space-5`、`--radius-md`、`--shadow-sm`、横向滚动；深色底与 token 配色来自 Chroma 内联样式（`noClasses: true`） |
| 表格 | `display: block` + `overflow-x: auto`，宽表在自身区域滚动；单元格下边框、表头 `--color-surface` + 加粗、偶数行 `--color-bg`、悬停 `--color-surface` |
| 图片 / 图注 | 图片 `max-width: 100%` + `--radius-md`；独占段落的图片居中成块，与文字同段时保持行内；`figure` 居中，`figcaption` muted 小字 |
| 分隔线 | 两端淡出的 1px 渐变线（`--color-border`） |
| 脚注 | `.footnotes` 顶部细线 + muted 小字；隐藏 Goldmark 自带 `<hr>`；`.footnote-ref` 主题色、无下划线；序号 marker 弱化 |
| 定义列表 | `dt` 加粗，`dd` 左缩进 `--space-5`、muted |
| 折叠块 | `details` 描边 + `--color-surface` 底 + `--radius-md`；`summary` 悬停转主题色，展开时下方补分割线 |

### 9.5 打印与降级

- 打印时链接保留下划线；代码块 / 引用 / 表格 / 图 / details `break-inside: avoid`，h1–h3 `break-after: avoid`。
- `prefers-reduced-motion` 下取消链接与 `summary` 的颜色过渡。
