# Hugo inaline-theme 设计文档

> 版本：v2 · 阶段一（基础设施 + Header）
> 状态说明：✅ 已定稿 = 可直接开发；⏳ 待细化 = 后续阶段再补齐规格

---

## 1. 项目概述

个人技术博客，Hugo 静态生成（SSR），自定义主题 `inaline-theme`。

| 项 | 值 |
| --- | --- |
| 站点语言 | 简体中文 |
| 主题色 | `#FA5D19` |
| 布局基调 | 两栏（左文章 + 右侧栏，参考 Butterfly） |
| 响应式 | ⏳ 本期不做，后续阶段统一添加 |

---

## 2. 技术栈与约束

| 项 | 决定 | 说明 |
| --- | --- | --- |
| 模板 | Hugo Go Template | v0.165 extended，SSR 输出静态 HTML |
| 样式 | **SCSS**（LibSass 编译） | 分文件编写，Hugo 资产管道编译为**单个** `main.min.<hash>.css` |
| 脚本 | 原生 JavaScript（ES6+） | 无框架、无构建工具链 |
| 图标 | Material Design Icons 7.4.47 | BootCDN 全量引入（`mdi` + `mdi-<name>`） |
| 字体 | 汉仪唐美人 HYTangMeiRen55W | 本地自托管 woff2 |
| SPA | Swup.js | ⏳ 后置接入，本期不引入 |

**禁止**：Bootstrap、jQuery 等大型框架。

### 2.1 SCSS 编译器约束（重要）

Hugo extended 内置的是 **LibSass 3.6.6**，环境暂无 Dart Sass。因此：

- ❌ 不可使用 `@use` / `@forward`（Sass 模块系统）
- ❌ 不可使用 `math.div()` 等模块函数
- ✅ 使用 `@import` 组织文件
- ✅ 变量、嵌套、`&`、mixins、`rgba()` / `mix()` 等均可用

> ⚠️ **待决策**：Hugo v0.153.0 起 LibSass 已标记弃用，未来版本将移除（当前 `hugo` 构建会输出 deprecation 警告）。
> 环境已具备 node/npm，安装 Dart Sass（`npm i -g sass`）即可切换到官方推荐方案，
> 届时把 `css.Sass` 的 `transpiler` 改为 `dartsass`，并将 `@import` 迁移为 `@use`。
> **在该决策落定前，全部 SCSS 保持 `@import` 写法。**

---

## 3. 设计令牌（Design Tokens）

全部以 **CSS 自定义属性** 定义在 `_tokens.scss`，暗色模式通过覆写变量实现，组件样式不感知主题。

### 3.1 品牌色

```scss
--color-primary:       #FA5D19;   // 主题色
--color-primary-hover: #E14E0E;   // 悬停加深
--color-primary-soft:  rgba(250, 93, 25, 0.10);  // 浅底（当前无引用，预留给导航项 active 等弱强调态）
--color-on-primary:    #FFFFFF;   // 主题色实心填充上的前景色（不随主题变化，故只在 :root 定义）
--color-over-hero:     #FFFFFF;   // Hero 封面图之上的前景色（同上，不随主题变化）
--color-over-hero-soft: rgba(255,255,255,.85);  // 同上略灰一档：顶部态 Header 静止时的前景
--hero-scrim:          rgba(0,0,0,.35);          // 封面图压暗遮罩
```

> `--color-over-hero-soft` 与 `--hero-scrim` 都只服务于首页 Hero，同样不随主题变化，
> 因此只在 `:root` 定义，不进 `dark-tokens`。（一言卡片的玻璃底相反：它随主题变化，见 §3.2。）

> **实心填充的悬停一律用 `--color-primary` + `--color-on-primary`**（二级菜单子项、右侧图标按钮）。
> `--color-primary-soft` 是弱强调，用于"底色不变、只淡淡提亮"的场合，两者不要混用。

### 3.2 中性色

| 变量 | 亮色 | 暗色 |
| --- | --- | --- |
| `--color-bg` | `#F5F5F5` | `#16181D` |
| `--color-surface` | `#EBEBEB` | `#1E2127` |
| `--color-elevated` | `#FFFFFF` | `#1E2127` |（抬升层：文章卡片已用；弹窗 / 搜索面板这类"不透光"浮层同样取它） |
| `--color-text` | `#1F2328` | `#E6E7E9` |
| `--color-text-muted` | `#6B7280` | `#9AA1AC` |
| `--color-border` | `#E5E7EB` | `#2C313A` |
| `--header-bg` | `rgba(255,255,255,0.6)` | `rgba(22,24,29,0.6)` |
| `--hero-card-bg` | `transparent` | `rgba(16,18,22,0.4)` |（§7.5 一言卡片玻璃底：浅色不添底、暗色才加） |

> `--color-surface` 是**贴身底板**（行内代码背景等），`--color-elevated` 是**抬升层**（卡片、浮层）。
> 分界在"谁压着谁"：底板永远贴在**同级层**的内容里，而正文既可能落在页面底色上、
> 也可能落在白卡上，所以它必须比两者都深一档才处处看得见；抬升层则要**离地**——
> 亮色下即纯白，靠阴影与页面分层。
>
> **页面底色 v3.22 起由纯白转浅灰、v3.28 转中性灰（`#F5F5F5`）**：早先底色是纯白，
> 卡片只能用灰面自证存在；改成白卡后关系反过来——白让给卡片，页面自己退一档（§7.7）。
> 起初那档灰带一点蓝调（`#F7F8FA`），后来换成不带色相的中性灰——底色与底板是**两个
> 大面积色块**，挨在一起时哪怕 2% 的蓝都会被眼睛抓出来，干脆一起归零。
> 暗色下三者的相对关系不变（`bg #16181D` < `surface` = `elevated` `#1E2127`），
> 故这两次改动都只影响亮色。
>
> **二级菜单仍不用 `--color-elevated`**：它取 `--header-bg`（见 §6.3），要与 Header
> **连成一体**，是另一种层级语义（同类做法见 `--color-primary-soft`）。

### 3.3 字体

```scss
--font-system: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
               "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
--font-handwriting: "HYTangMeiRen", var(--font-system);
--font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
```

**应用策略**：通过 `--font-body` / `--font-heading` / `--font-ui` 三层变量间接引用手写体，为后续「系统字体 / 手写体」设置项预留开关：

```scss
:root {
  --font-body:    var(--font-handwriting);
  --font-heading: var(--font-handwriting);
  --font-ui:      var(--font-handwriting);
}
:root[data-font="system"] {   // 预留：后续前台设置面板切换此属性
  --font-body:    var(--font-system);
  --font-heading: var(--font-system);
  --font-ui:      var(--font-system);
}
```

- 本期默认**全站启用手写体（含正文）**，符合「先做成完整的」要求
- 代码块 / 行内代码**始终**使用 `--font-mono`，不受切换影响
- ⚠️ 已知代价：装饰手写体用于正文长段落可读性下降；已通过 `data-font="system"` 预留一键回退
- ⚠️ 字体文件 3.6 MB（全字集 CJK）。**已启用 `preload`**（实测结论：字体应用于正文，延迟加载会导致每次访问整页重排，preload 只是提前开始下载，缓存命中后无额外成本）
- ⚠️ 根本优化仍是**字体子集化**（`pyftsubset`），未做前 3.6 MB 是首屏固定成本
- 发布方式：`head.html` 用 `resources.Get` 发布到 `/fonts/`，`_fonts.scss` 以 `../fonts/...` 相对引用，**两者耦合，改一处需同步另一处**

### 3.4 尺寸与层级

```scss
// 间距（4 的倍数）
--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 24px; --space-6: 32px; --space-7: 40px; --space-8: 48px;

// 圆角
--radius-sm: 6px;  --radius-md: 8px;  --radius-lg: 12px;  --radius-xl: 24px; // Hero 一言卡片（§7.5）

// 阴影
--shadow-sm: 0 1px 2px rgba(0, 0, 0, .03), 0 2px 6px rgba(0, 0, 0, .04); // 卡片静置（双层收轻，见 §7.7）
--shadow-md: 0 6px 18px rgba(0, 0, 0, .08);
--shadow-header: 0 2px 8px rgba(0, 0, 0, .06);   // Header 常驻阴影（替代分割线）
--shadow-dropdown: 0 2px 8px rgba(0, 0, 0, .06), 0 10px 28px rgba(0, 0, 0, .10); // 浮层（双层）

// 发光（配合实心主题色填充，见 §6.3 / §6.4）
--glow-inset: inset 0 0 10px rgba(255, 255, 255, .25);  // 内高光，让填充块"亮起来"（仅二级菜单子项，挂在其填充层上）
--glow-text:  0 0 6px rgba(255, 255, 255, .55);         // 文字/图标自身辉光
--glow-halo:  0 0 12px rgba(250, 93, 25, .45);          // 外围光晕（v3.6 起失去引用，保留待用）

// Hero 一言卡片（§7.5；玻璃底见 §3.2）
--hero-card-blur: 24px;

// 布局
--container-width: 1200px;   // 全站内容容器：Header + 两栏页面（§7.8）
--content-width: 42rem;      // 单栏内容宽度：文章详情 / 标签索引 / 页脚
--sidebar-width: 280px;      // 右侧栏定宽，主栏吃剩余宽度（§7.8）
--header-height: 56px;
--header-blur: 20px;         // Header 与下拉面板共用的毛玻璃强度（两者须同档，见 §6.3）

// 层级
--z-header: 100;  --z-dropdown: 110;
```

### 3.5 动效

```scss
--ease: cubic-bezier(.4, 0, .2, 1);
--duration-fast: 150ms;   // 颜色、图标
--duration-base: 250ms;   // 下划线、下拉面板
```

---

## 4. 工程规范

### 4.1 目录结构

```
themes/inaline-theme/
├── assets/
│   ├── css/
│   │   ├── main.scss              # 入口：@import 汇总
│   │   ├── _tokens.scss           # 设计令牌（§3）
│   │   ├── _fonts.scss            # @font-face 声明
│   │   ├── _base.scss             # reset + 基础排版
│   │   ├── _header.scss           # ✅ Header（§6）
│   │   ├── _hero.scss             # ✅ 首页 Hero（§7）
│   │   ├── _post.scss             # ✅ 文章列表卡片与分页（§7.7）/ 文章详情
│   │   ├── _sidebar.scss          # ✅ 两栏骨架 + 右侧栏占位卡（§7.8）
│   │   └── _footer.scss           # ✅ 页脚（⏳ 内容占位）
│   ├── js/
│   │   ├── main.js                # 全局：主题切换、Header 滚动态（阴影 / 显隐）
│   │   └── pages/
│   │       └── home.js            # ✅ 首页：Hero 背景切换 + 一言打字机（§7）
│   ├── images/
│   │   └── cover/
│   │       ├── cover1.jpg         # ✅ 内置回退封面（占位图，未配置 covers 时用）
│   │       ├── cover2.jpg         # ✅ 复制自 company-website 背景图（§7.1）
│   │       └── cover3.jpg         # ✅ 同上
│   └── fonts/
│       └── HYTangMeiRen55W.woff2
└── layouts/
    ├── baseof.html
    ├── home.html / page.html / section.html / taxonomy.html / term.html
    └── partials/
        ├── head.html
        ├── header.html            # ✅ Header
        ├── nav-item.html          # ✅ 导航树递归渲染（§6.5）
        ├── icon.html              # ✅ 主题自绘 SVG 图标（§7.5）
        ├── hero.html              # ✅ 首页 Hero
        ├── cover-pool.html        # ✅ 封面图池：Hero 背景与卡片兜底共用（§7.7）
        ├── post-card.html         # ✅ 文章卡片：左图右文（§7.7）
        ├── pager.html             # ✅ 分页导航（§7.7）
        ├── sidebar.html           # ✅ 右侧栏（§7.8，当前是空白占位卡）
        └── footer.html
```

### 4.2 样式构建

`main.scss` 经 Hugo 资产管道编译：

```go-html-template
{{ $opts := dict "outputStyle" "compressed" "transpiler" "libsass" }}
{{ $css := resources.Get "css/main.scss" | css.Sass $opts | minify | fingerprint }}
<link rel="stylesheet" href="{{ $css.RelPermalink }}" integrity="{{ $css.Data.Integrity }}">
```

产物为单文件 `/css/main.min.<hash>.css`，满足「样式只有一个文件」的要求（源文件按模块拆分）。

### 4.3 脚本组织规范

- `main.js`：**仅全局逻辑**（主题切换、header 滚动态等），随每个页面加载
- `js/pages/*.js`：**页面级逻辑**，由对应模板按需引入，避免全部堆进 `main.js`
- 引入方式（`baseof.html` 预留 `page-scripts` block）：

```go-html-template
{{ define "page-scripts" }}
  {{ $js := resources.Get "js/pages/home.js" | minify | fingerprint }}
  <script src="{{ $js.RelPermalink }}" defer></script>
{{ end }}
```

- **幂等约定**：每个模块写成可重复调用的 `init()` 函数，事件用委托绑定。
  本期直接调用一次；后续接入 Swup 时，在 `page:view` 生命周期再次调用同一 `init()` 即可，无需重写。

---

## 5. 全局机制

### 5.1 暗色模式 ✅

**策略**：跟随系统 → 用户可手动覆盖 → `localStorage` 记忆。

- 存储键：`inaline-theme`（值为 `light` / `dark`）
- 状态载体：`<html data-theme="light|dark">`
- **防闪烁**：在 `<head>` 中、样式表**之前**内联同步脚本（必须内联，外链会 FOUC）：

```html
<script>
  (function () {
    var saved = localStorage.getItem('inaline-theme');
    var dark = saved ? saved === 'dark'
                     : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  })();
</script>
```

- CSS 侧三级兜底（无 JS 时不至于丢失暗色）：

```scss
:root { --color-bg: #F5F5F5; /* …亮色令牌 */ }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* …暗色令牌 */ }
}
:root[data-theme="dark"] { /* …暗色令牌 */ }
```

- 同时设置 `color-scheme: light dark`，让滚动条与原生控件跟随
- ⏳ 后续可扩展「自动 / 亮 / 暗」三态（当前为二态切换）

### 5.2 字体开关 ⏳

架构已预留（§3.3 `data-font`），**本期不实现设置面板**。

---

## 6. Header 设计规格 ✅ ← 本期开发目标

### 6.1 整体布局

- **固定顶部**：`position: fixed; top: 0; left: 0; right: 0; z-index: var(--z-header)`
  - 用 `fixed` 而非 `sticky`：`fixed` 脱离文档流，首页 Hero 才能从 `y=0` 铺满视口并钻到它底下；
    `sticky` 会占据 56px 文档流把 Hero 往下挤，而用负外边距抵消会触发**外边距塌陷**——
    负边距会穿过 `.main` 和 `body` 顶到根元素，把整个文档（含 Header 本身）一起上移。
  - 代价：其他页面的 `.main` 需用 `padding-top: calc(var(--header-height) + var(--space-6))` 补回高度。
- 高度 `--header-height: 56px`，通栏背景 + 毛玻璃（`--header-blur: 20px`，与下拉面板同档）
- **用阴影而非分割线与内容分层**（不使用 `border-bottom`）：

```scss
background: var(--header-bg);
backdrop-filter: blur(var(--header-blur));
box-shadow: var(--shadow-header);
```

- 内部三栏使用 **Grid 保证导航绝对居中**（不因左右宽度不等而偏移）：

```scss
.header-inner {
  max-width: var(--container-width);
  margin: 0 auto;
  height: var(--header-height);
  display: grid;
  grid-template-columns: 1fr auto 1fr;   // 左 / 中 / 右
  align-items: center;
}
.header-actions { justify-self: end; }
```

- **滚动态**：页面滚动 > 8px 时给 `.site-header` 加 `.is-scrolled`，阴影加深为 `--shadow-md`（JS，见 §6.6）
- **显隐（滚动收回 / 展开）**：向下滚动、且已离开「Header 高度 + 24px」顶部安全区后加 `.is-hidden`
  （`translateY(-100%)`，`--duration-base` 过渡）收起；向上滚动立即展开；顶部安全区内恒展开；
  键盘焦点进入 Header 时强制展开（`focusin`），避免焦点元素滑出视口（JS，见 §6.6）

### 6.2 左侧 Logo

- 纯文字，取自 `site.Title`，链接到首页
- 使用 `--font-heading`（手写体），`font-size: 1.5rem`
- **常驻态无悬停效果**（不变色、无过渡），保持克制
- **首页顶部态例外**：静止 `--color-over-hero-soft`，悬停提到 `--color-over-hero`（纯白），
  与同状态下的 `.nav-link` 一致（见 §7.3）

```scss
.site-logo {
  color: var(--header-fg);
  // 全局 a:hover 是 (0,1,1)，.site-logo 只有 (0,1,0) —— 不显式压回去，
  // "无悬停效果"这条根本不生效，鼠标一放上去就变主题色。
  &:hover { color: var(--header-fg); }
}
```

> **这是全局 `a:hover` 的第三次泄漏**（前两次：§6.3 的二级菜单子项、§7.2 的箭头）。
> 根因是 `_base.scss` 里那条 `a:hover { color: var(--color-primary-hover) }` 特异度 `(0,1,1)`，
> 高过任何单类选择器。**凡是将 `<a>` 当作按钮/装饰用、且不想它变主题色的地方，
> 都必须显式写一条 `:hover` 覆盖**（最低 `(0,1,1)`+，通常写成 `.foo:hover` 即 `(0,2,0)`）。

### 6.3 中部导航

**结构**：图标 + 文字，列表项。

```html
<ul class="nav-list">
  <li class="nav-item">
    <a class="nav-link" href="/">
      <span class="nav-label">
        <i class="mdi mdi-home nav-icon" aria-hidden="true"></i>
        <span class="nav-text">首页</span>
      </span>
    </a>
  </li>
  <li class="nav-item nav-item--has-children">   <!-- 「更多」 -->
    <button type="button" class="nav-link nav-link--parent" aria-haspopup="true">
      <span class="nav-label">
        <i class="mdi mdi-dots-horizontal nav-icon" aria-hidden="true"></i>
        <span class="nav-text">更多</span>
        <i class="mdi mdi-chevron-down nav-caret" aria-hidden="true"></i>
      </span>
    </button>
    <ul class="nav-dropdown">
      <li><a class="nav-dropdown-link" href="/archives/">
        <i class="mdi mdi-archive-outline" aria-hidden="true"></i><span>归档</span>
      </a></li>
    </ul>
  </li>
</ul>
```

> 父级用 `<button>` 而非 `<span role="button">`：原生可聚焦，键盘 Tab 即可触发 `:focus-within` 展开二级菜单。
> 下划线挂在 `.nav-label` 而非 `.nav-link` 上，因此**不含内边距**；顶部展开箭头刻意放进 `.nav-label` 内部，
> 使下划线覆盖「图标 + 文字 + 箭头」。
>
> 图标尺寸：顶部导航的左侧图标（`.nav-icon`）与展开箭头（`.nav-caret`）统一 `1rem`；
> 下拉面板内的箭头保持 `0.625rem`（10px）。

**交互规格**

| 项 | 规格 |
| --- | --- |
| 默认态 | 图标 + 文字均为 `--color-text`，无下划线 |
| 悬停 | 图标与文字变 `--color-primary` |
| 下划线 | **3px 圆角胶囊** `--color-primary`，**从左向右生长**（进度条效果） |
| 下划线宽度 | 无箭头项：恒等于「图标 + 文字」宽度；带箭头项（`.nav-link--parent`）：覆盖「图标 + 文字 + 箭头」。均挂在 `.nav-label` 上，随内容自适应 |
| 下划线位置 | 文字下方 6px（`bottom: -6px`），**不在标题栏边缘** |
| 选中态 | **与未选中完全一致**（按需求确认，不做高亮） |

**下划线动画实现**——用 `width` 而非 `transform: scaleX`：

```scss
.nav-link {
  transition: color var(--duration-fast) var(--ease);

  &:hover { color: var(--color-primary); }
}

.nav-label {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);

  &::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -6px;                 // 文字下方 6px，而非标题栏边缘
    width: 0;
    height: 3px;
    border-radius: 999px;         // 圆角胶囊
    background: var(--color-primary);
    transition: width var(--duration-base) var(--ease);
  }
}

.nav-link:hover .nav-label::after { width: 100%; }
```

> **为何不用 `scaleX`**：伪元素为绝对定位，改 `width` 不影响其他元素布局；
> 而 `scaleX` 会把胶囊形的圆角在动画过程中横向压扁（两端变尖角）。
> 圆角是硬需求时，`width` 是更正确的选择。

**二级菜单（「更多」）**

| 项 | 规格 |
| --- | --- |
| 触发 | 鼠标悬停展开 / 移出收起（另支持 `:focus-within` 以便键盘操作） |
| 定位 | `position: absolute; top: 100%`，相对 `.nav-item`，居中对齐 |
| 面板 | 背景 `--header-bg`（与 Header 同档透明度）+ `backdrop-filter: blur(var(--header-blur))`、`--radius-md` 圆角、`--shadow-dropdown` 双层阴影、**无描边**、最小宽度 112px、内边距 `--space-1` |
| 动画 | `opacity` + `translateY(8px → 0)` + `visibility`，`--duration-base` |
| 子项 | 内边距 `--space-2 --space-3`；悬停时整行实心填充：`--color-primary` + `--color-on-primary` 文字 + `--glow-inset` 内高光 + `--glow-text` 文字辉光。填充自 v3.8 起与按钮同款由 `::before` 由小变大（方案 C，见 §6.4）；`--glow-inset` 挂到填充层上——inset 阴影属元素背景绘制层、先于 `z-index:-1` 子层绘制，留在链接上会被填充整块盖住 |
| 展开指示 | 「更多」右侧 `mdi-chevron-down`，展开时旋转 180° |

> **子项为什么只有内发光、没有外光晕？** 子项距面板边缘只有 `--space-1`（4px），
> `--glow-halo` 的 12px 光晕会越过面板边界糊到 header / 页面上，看起来像渲染错误。
> 内高光完全落在填充块内部，不受此限。
> （右侧按钮自 v3.6 起同样去掉了外光晕与内高光，理由不同：小面积上边框发光太"炸"，见 §6.4。）

> **面板为什么用 `--header-bg` 而不是不透光的 `--color-elevated`**：
> 面板从 Header 下沿垂出、与 Header 直接相接，若 Header 是半透明的而面板是实心的白块，
> 展开瞬间就是"半透明条 + 实心块"的割裂观感。改用同一档透明度后两者连成一体。
> `backdrop-filter` 必须一并跟上：**只降背景不模糊**的话，透出来的页面文字是清晰的，
> 叠在菜单项下面非常脏——这和 §7.3 关掉毛玻璃是同一个道理的反向应用。

> **分级全靠阴影，不用描边。** 去掉 `border` 后阴影需独自承担「浮起来」的观感，
> 故 `--shadow-dropdown` 用双层：`0 2px 8px` 贴边勾勒轮廓，`0 10px 28px` 大范围营造抬升。
> 单层阴影在纯白背景上会显得发虚、边界不清。背景转为半透明后阴影更不可省——
> 它现在是面板与页面内容之间唯一的界线。

```scss
.nav-dropdown {
  position: absolute;
  top: 100%;
  left: 50%;
  min-width: 112px;
  background: var(--header-bg);
  backdrop-filter: blur(var(--header-blur));
  -webkit-backdrop-filter: blur(var(--header-blur));
  box-shadow: var(--shadow-dropdown);
  opacity: 0;
  visibility: hidden;
  transform: translate(-50%, 8px);
  transition: opacity var(--duration-base) var(--ease),
              transform var(--duration-base) var(--ease),
              visibility var(--duration-base);
}
.nav-item--has-children:hover .nav-dropdown,
.nav-item--has-children:focus-within .nav-dropdown {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, 0);
}
```

### 6.4 右侧操作区

两个**纯图标按钮**，无文字，样式统一（`.action-btn`）：

| 按钮 | 图标 | 行为 |
| --- | --- | --- |
| 主题切换 | `mdi-brightness-4`（亮色态） / `mdi-brightness-6`（暗色态） | 切换 `data-theme` 并写入 `localStorage` |
| 搜索 | `mdi-magnify` | **本期仅 UI，点击无反应**（⏳ 面板后续实现） |

> MDI 与 FA 的关键差异：MDI **没有 solid/regular 样式类**，描边与实心是**两个独立图标名**
> （`mdi-home` vs `mdi-home-outline`），选型时按名字挑即可。
> 导航图标按参考实现选型，主级取**实心**变体（`mdi-home` / `mdi-message-text` / `mdi-link-variant` /
> `mdi-information` / `mdi-dots-horizontal`），二级菜单子项取**描边**变体（`mdi-archive-outline` /
> `mdi-tag-multiple-outline`），用实心/描边区分层级。
>
> MDI 的字号机制：`.mdi:before` 声明了 `font-size: inherit`，因此**在父元素或图标元素上设 `font-size` 即可控制大小**，
> 不会被库的 24px 默认值覆盖（`.nav-icon` / `.action-btn` / `.nav-caret` 均以此控制）。

**主题图标切换纯 CSS 完成**（无需 JS 换图标）：

```scss
// 类名语义 = 「该主题生效时显示哪一个」
.action-btn .icon-when-dark { display: none; }                                   // 默认态即亮色
:root[data-theme="dark"] .action-btn .icon-when-light { display: none; }
:root[data-theme="dark"] .action-btn .icon-when-dark  { display: inline-block; }
```

约定：**亮色显示 `mdi-brightness-4`（点击去暗色），暗色显示 `mdi-brightness-6`（点击去亮色）**。
类名不描述图标长相（brightness-4 不是「月亮」），而描述**它在哪个主题下出现**——
否则参考实现换图标时类名就会说谎。

按钮样式：`36×36` 圆角 `--radius-sm`，悬停**实心填充 + 图标辉光**。不复用二级菜单子项的内高光、
也不加外光晕——小面积上边框发光会把按钮变成一团光斑，只留图标自身辉光最干净。

**填充由 `::before` 从中心由小变大（方案 C）**：伪元素 `inset: 0` + `border-radius: inherit`，
从 `scale(.3) + opacity 0` 展开到 `scale(1) + opacity 1`，代替背景色直接切换，消除"硬切"感。
进入用 `--duration-base`（生长看得见）、移出用 `--duration-fast`（收得干脆）；
`z-index:-1` 需按钮自身 `position: relative` + `isolation: isolate` 构成层叠上下文。
图标辉光比填充晚 `80ms` 出场（`transition-delay` 只写在 `:hover` 内），移出无延迟；
`prefers-reduced-motion` 下关闭生长过渡，填充直接显示——覆写块须排在文件末尾且显式列出
`:hover::before` 变体：媒体查询不加特异度，同特异度下只能靠源顺序取胜（v3.8 修正）。

> 自 v3.8 起二级菜单子项也套用了同款生长填充（见 §6.3），两处差别只剩发光细节：
> 按钮无内高光、辉光延迟 `80ms`；子项保留内高光（挂在填充层上）、无延迟。
> 这是同一套机制在两种容器条件下的取舍——按钮小且要求"干净"，
> 子项是完整一行、需要整行"亮起来"。

过渡属性：本体 `color` 即时、`text-shadow` 延迟 `80ms`，填充层 `transform` / `opacity`；
时长：进入 `--duration-base`（250ms）、移出 `--duration-fast`（150ms）。

### 6.5 配置规格（完全配置化）✅

导航名称、链接、图标、层级**全部来自 `hugo.yaml` 的 `params.nav`**，模板不硬编码任何一项。结构是**树形**：子菜单直接嵌在 `children` 下，层级即嵌套深度；**书写顺序即渲染顺序**——没有 `weight`，也不需要用 `parent` / `identifier` 指父级：

```yaml
params:
  nav:
    - name: "首页"
      pageRef: "/"
      icon: "mdi mdi-home"

    - name: "动态"
      pageRef: "/moments/"
      icon: "mdi mdi-message-text"

    - name: "友链"
      pageRef: "/links/"
      icon: "mdi mdi-link-variant"

    - name: "关于"
      pageRef: "/about/"
      icon: "mdi mdi-information"

    - name: "更多"                # 无 pageRef：只作下拉触发，渲染为 <button>
      icon: "mdi mdi-dots-horizontal"
      children:
        - name: "归档"
          pageRef: "/archives/"
          icon: "mdi mdi-archive-outline"

        - name: "标签"
          pageRef: "/tags/"
          icon: "mdi mdi-tag-multiple-outline"
```

模板侧由 `partials/nav-item.html` **递归**渲染（`header.html` 只负责遍历顶级项）：

- 顶级项 → `.nav-item` / `.nav-item--has-children` + `.nav-dropdown`；
- 三级及以下 → `.nav-dropdown-item--has-children` + `.nav-submenu`，挂在父项右侧横向展开（样式见 `_header.scss`）；
- 有 `children` 且无 `pageRef` 的节点渲染为 `<button aria-haspopup>`（纯触发），有 `pageRef` 的渲染为 `<a>`；
- 图标一律读节点的 `icon`，填 Material Design Icons 类名。

`pageRef` 解析：partial 用 `site.GetPage` 换成真实 `RelPermalink`（首页 `/`、taxonomy 页 `/tags/` 均支持）；解析不到时构建告警，并退化为字面路径保证链接仍可点击。

> ⚠️ `pageRef` 指向的页面必须存在，否则构建告警。当前占位内容已就位：`content/about.md`、
> `content/moments/_index.md`、`content/links/_index.md`、`content/archives/_index.md`；`/tags/` 来自默认 taxonomy。

### 6.6 本期 JS 规格

`assets/js/main.js`（全局）：

1. **主题切换**：点击 `.theme-toggle` → 切换 `data-theme` → 写入 `localStorage`
2. **Header 滚动态**：`scroll > 8px` 时给 `.site-header` 加 `.is-scrolled`；按滚动方向切换
   `.is-hidden`——向下滚且离开顶部安全区（`Header 高度 + 24px`）收起，向上滚展开；
   位移 < 8px 不判定方向（滤抖动）；焦点在 Header 内时不收起；`prefers-reduced-motion` 下 CSS 关闭过渡

均写成幂等 `init()`，供后续 Swup 生命周期复用（§4.3）。
防闪烁脚本单独内联在 `head.html`（§5.1），**不进** `main.js`。

### 6.7 验收标准

- [ ] Header 固定顶部，滚动时保持可见，滚动后出现阴影
- [ ] 导航项悬停：图标+文字变 `#FA5D19`，下划线从左向右生长
- [ ] 「更多」悬停展开二级菜单，移出收起，带过渡动画；键盘 Tab 可聚焦展开
- [ ] 未选中与选中导航项样式一致
- [ ] 主题按钮可在亮/暗间切换，刷新后保持；首次访问跟随系统偏好且无闪烁
- [ ] 搜索按钮有悬停效果，点击无反应
- [ ] 导航项的名称/链接/图标/嵌套层级全部改配置即可生效，无需改模板
- [ ] 样式产物为单个 `main.min.<hash>.css`，无分散 CSS 文件
- [ ] 控制台无报错

---

## 7. 首页（Home）⏳ 开发中

> 首页自上而下：**Hero** → 文章列表（§7.7）。Hero 封面图上只有中央一言卡片（§7.5）。
> 站点描述（`params.description`）不在页面上渲染——一句话简介压在满屏封面图与列表之间
> 无处安放，它现在只作为 `<meta name="description">` 的来源（`head.html`）。

### 7.1 Hero：背景图（视觉固定）✅

| 项 | 规格 |
| --- | --- |
| 高度 | `100vh`，铺满整个视口，并钻到 fixed Header 底下（Header 不被"挤占"） |
| 背景图 | `params.hero.covers` 列表（assets 路径，可多张）；每张一个 `.hero-bg-layer`，`background-size: cover`；不配置 / 解析不到则回退内置 `images/cover/cover1.jpg` |
| 初始背景 | `params.hero.initial_cover`：填 covers 里的路径（前导 `/` 可有可无；匹配不到构建告警、退回第一张）→ 每次都从它开始；填 `random` → 每次进入 / 刷新随机；留空 → 第一张。模板把选中层静态渲染成 `.is-active`（`random` 时是构建期随机，兼作无 JS 兜底），刷新重摇由 JS 完成 |
| 兜底底色 | `--color-surface`，图片解码完成前不闪白 |
| 压暗遮罩 | `.hero::after` 铺满 + `--hero-scrim`（`rgba(0,0,0,.35)`），压在背景图层之上 |
| 背景定位 | `.hero-bg-layer` 上 `background-attachment: fixed`：图片相对**视口**定位——页面滚动、图片不动，即"视觉固定"。`cover` / `center` 的定位区也随之按视口算（首屏与 Hero 盒重合，取景与改造前一致） |
| 背景切换 | 卡片左下角左右箭头（仅多于一张时渲染）：JS 挪 `.is-active`，`opacity` 600ms 交叉淡入，循环切换；reduced-motion 下直接换 |
| 裁剪 | `overflow: hidden`（图层 `inset: 0` 后已无溢出可裁，保留作兜底：徽章名称过长时裁在视口内） |

**为什么要有压暗遮罩**：`cover1.jpg` 本身偏暗（全图平均亮度 69.5/255），但**满屏铺开**
在夜间仍然刺眼——大面积的中低亮度比小面积的高亮更"压人"。压一层 35% 黑把整体亮度
再降一档，让它退回背景的位置，也顺带抬高了 Header 白字的对比度。

**遮罩为什么走 `.hero::after` 而不是再往模板里塞一层 `div`**：纯装饰、无内容、无交互，
用伪元素可以完全留在样式层，`hero.html` 不必为它多一个节点。伪元素天然排在
各背景图层之后，绘制顺序自动正确（§7.2 的箭头另有 `z-index: 1` 压在上面）。

**`pointer-events: none` 不能省**：遮罩铺满整个 Hero，不关掉指针事件的话，
底部的下滚箭头和下滚链接会被整片吃掉——视觉上看得见，点下去没反应。

**为什么直接用 `background-attachment: fixed`**：定位交给浏览器，滚动与背景绘制
在同一帧内完成，不存在"追赶"。曾试过用 JS 每帧写 `transform` 抵消页面滚动
（`FACTOR = 1`）：主线程晚一帧，背景就比页面慢一拍，**滚动全程持续抖动**——
视差系数 0.4 时位移小还能藏住，改成完全抵消后暴露无遗，遂废弃整段 JS。
代价是每帧重绘整屏位图，但 Hero 只占一屏、重绘只发生在滚动时，实测不是瓶颈。
iOS Safari 不支持该值（当作 `scroll` 处理）：退化为随页面滚动，`cover` / `center`
照常按盒子计算，不糊不裂，接受该降级。
> 顺带：固定定位下图片以视口为定位区域，不存在"位移露边"问题，
> 不需要 `height: 120%; top: -10%` 这类溢出余量。

**背景图 URL 的传递方式**：`hero.html` 用 `resources.Get` 逐张取图，
把每张的 `.RelPermalink` 写进对应图层的内联 `style`（`background-image: url(...)`）。
Hugo **不会**改写 SCSS 里 `url()` 的路径，而样式表本身被指纹化到 `/css/` 下——
写死相对路径迟早对不上（这一点与 §3.3 字体是同一类问题，但字体可以靠
"约定发布到 `/fonts/`" 硬扛，封面图日后要换成 content 里的图，必须走内联）。
> 副作用：当前图片未做处理，因此发布路径不含指纹（`/images/cover/cover1.jpg`）。
> 日后接 Hugo Pipes 的 `.Resize` / `.Process` 时哈希会自动出现，模板无需改动。

**背景为什么要拆成图层**：切换要做交叉淡入，而 `background-image` 不可过渡，
只能两张图同时在、靠 `opacity` 换。于是每张封面一个 `.hero-bg-layer` 直接叠在
`.hero` 上（`inset: 0`），切换 = JS 把 `.is-active` 挪过去。
（曾有一个 `.hero-bg` 父层承载位移 `transform`，改用 fixed 后它的职责消失，已删。）

**切换箭头为什么在卡片左下角**：卡片四角里，左上 / 右下被引号占了，
左下是唯一"没事做"的角；与引号同距边 24px（`--space-5`），视觉上成套。
绝对定位不进卡片的 flex 流——短文案时卡片仍由文字（或 `min-width`）定宽，
不会被按钮撑大。只有一张封面时不渲染：没有可切的目标，不给死按钮。

**"random" 为什么要 JS 在载入时重摇**：构建产物是静态 HTML——模板里的随机在
构建那一刻就固定了，浏览器怎么刷新都是同一张；"刷新换图"只能发生在浏览器里。
`hero.html` 在配置为 `random` 时给 `.hero` 打上 `data-cover-random`，
`home.js` 见到标记就按每次载入重摇一次。模板那次随机不是白做：无 JS 时它就是
首屏结果；固定路径更彻底——由模板直接选中对应图层，完全不依赖 JS。
切换下标同样先从 `.is-active` 反查起始层（不再是写死第 0 层），
重摇与手动切换才能接得上。

### 7.2 底部跳动箭头 ✅

| 项 | 规格 |
| --- | --- |
| 位置 | `left: 50%; bottom: --space-6`，水平居中于 Hero 底部 |
| 尺寸 | `48×48`，图标 `2rem`（`mdi-chevron-down`） |
| 颜色 | `--color-over-hero`（白），**静态填充，不做字形渐变** |
| 动画 | `hero-arrow-bounce` 2s 无限循环，`translateY(0 → 12px)` 与 `opacity` 同步变化 |
| 缓动 | **逐帧声明**，非匀速：下行 `cubic-bezier(.55,.55,.75,1)`（长距匀速 + 收尾渐慢），回程为其镜像 `cubic-bezier(.25,0,.45,.45)` |
| 透明度 | 最高点（动画起点）`opacity: 1`；最低点 `opacity: .7`（即 30% 透明），回程再亮回来 |
| 层级 | `z-index: 1`，压在 `.hero::after` 遮罩之上，不被压暗 |
| 兜底可读性 | `filter: drop-shadow(0 2px 6px rgba(0,0,0,.35))` |
| 悬停 | **无任何反馈**：`:hover` / `:focus` 显式锁回 `--color-over-hero` |
| 行为 | `<a href="#home-content">`，无需 JS，平滑滚动到文章列表 |

**缓动为什么写在关键帧里而不是 `animation` 简写上**：简写上的 `animation-timing-function`
对**所有**区间一视同仁，做不到"下行一个曲线、回程另一个曲线"。
关键帧里的 `animation-timing-function` 管的是**从这一帧到下一帧**这一段，于是可以分开指定：

```scss
@keyframes hero-arrow-bounce {
  0%, 100% { transform: translate(-50%, 0);    opacity: 1;
             animation-timing-function: cubic-bezier(.55, .55, .75, 1); }
  50%      { transform: translate(-50%, 12px); opacity: .7;
             animation-timing-function: cubic-bezier(.25, 0, .45, .45); }
}
```

**下行为什么是 `cubic-bezier(.55,.55,.75,1)`**：把这四个数拆开看就清楚了——
控制点 P1 = `(.55,.55)` 落在对角线 `y = x` 上，所以**起始斜率恰好是 1，即起步就是匀速**
（不是 `ease-out` 那种"一上来先蹿出去"）；P2 = `(.75,1)` 使**终点斜率归零**，
最后才把速度收干净。两者合起来正是"快的那段持续得长，只在收尾渐渐慢下来"。

对照旧值 `ease-out`（`cubic-bezier(0,0,.58,1)`）：它的起点斜率接近无穷，前 1/3 时间就走掉
一半以上路程，**剩下的大半程全在爬**——观感就是"一直在减速"。新曲线把减速压缩到收尾一小段。

| 归一化时间 | `ease-out` 已走 | 新曲线已走 |
| --- | --- | --- |
| 50% | 65% | 71% |
| 67% | 84% | ~79% |
| 85% | ~94% | ~92%（尾段才开始明显收） |
| 100% | 100% | 100% |

> 关键差异不在前半段（两者都跑得比匀速快），**而在尾段的减速起点**：
> `ease-out` 从约 60% 处就开始刹，新曲线把它推到 85% 之后。

**回程为什么改成下行的镜像**（而非沿用 `ease-in`）：镜像指
`(x1,y1,x2,y2) → (1-x2, 1-y2, 1-x1, 1-y1)`，即 `(.55,.55,.75,1) → (.25,0,.45,.45)`。
这样能保证两个接缝都不跳速：回程**起点斜率 0** 接住下行归零的收尾速度，
回程**终点斜率 1** 正好等于下行的起步斜率。若回程沿用 `ease-in`，它是斜着冲进最高点的，
而下行只能以斜率 1 起步 —— 最高点会出现一次肉眼可见的减速，像"顿一下"。

**为什么必须显式写悬停态**：`_base.scss` 的全局 `a:hover` 是 `(0,1,1)` 特异度，
而 `.hero-arrow` 只有 `(0,1,0)` —— 不写的话鼠标一放上去箭头就会变主题色（橙）。
箭头只是个装饰性的下滚入口，不该被当成普通链接对待。下划线不用管，
因为它本来就没有（全局 `a { text-decoration: none }`）。同理见 §6.2 的 Logo。

**点击落点：平滑滚动 + 躲开 fixed Header**

```scss
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

#home-content { scroll-margin-top: calc(var(--header-height) + var(--space-4)); }
```

- `scroll-behavior` 写在 `html` 上而非只挂在箭头：以后所有页内锚点（目录、脚注回跳）
  都该是平滑的，逐处声明只会漏。
- `prefers-reduced-motion` 下必须退回 `auto`。整页滚动动画对前庭敏感人群刺激很强，
  这比箭头那点位移严重得多。
- **`scroll-margin-top` 不能省**：Header 是 `fixed`，会盖住视口顶部 56px。
  不预留的话滚过去的第一行（现在是首张文章卡片）正好压在标题栏底下——视觉上像内容丢了。
- 全程不需要 JS：`<a href="#home-content">` + CSS 就够了。

**透明度的变化是"跟着动画位置走"，不是字形上的空间渐变。**
位移与 `opacity` 写在同一个 `@keyframes` 里，两者天然同步，不需要额外机制。
（曾误做成字形上的 `linear-gradient` + `background-clip: text`，已废弃——
那会让箭头**静态地**上白下透，与"跳到低处才变淡"是两回事。）

> 若日后确实想要字形渐变，`background-clip: text` 的写法可行，但要注意规则必须写在
> `::before` 上——真正生成字形的是伪元素，不是 `<i>` 本身。

**`transform` 的坑**：箭头靠 `translateX(-50%)` 居中，而 `transform` 会被动画整体接管，
所以 `@keyframes` 的每一帧**都必须带上 `-50%`**，否则跳动时箭头会丢掉居中。
同理，`.hero-arrow` 的基准 `transform` 也要显式写——`prefers-reduced-motion` 下
`animation` 被关掉，靠的就是它。

**降级**：`@media (prefers-reduced-motion: reduce)` 关闭跳动动画。
（背景固定不需要降级：它是 CSS 静态定位，图片本身不动，不构成运动。）

### 7.3 Header 顶部态：全透明 ✅

首页的 Header 在**未被滚动**时有第二副面孔，与内页 / 滚动后完全不同：

| 属性 | 顶部态（未滚动） | 滚动后 / 内页 |
| --- | --- | --- |
| 背景 | `transparent` | `--header-bg`（半透明） |
| 毛玻璃 | **关闭** | `blur(var(--header-blur))`（20px） |
| 阴影 | 无 | `--shadow-header`（滚动后加深为 `--shadow-md`） |
| 前景（静止） | `--header-fg` → `--color-over-hero-soft`（略灰的白） | `--header-fg` → `--color-text` |
| Logo 悬停 | → `--color-over-hero`（纯白） | 无变化（§6.2 定：Logo 去悬停） |
| 导航项悬停 | 文字/图标 → `--color-over-hero`（纯白），下划线照常展开（主题色） | 文字 → `--color-primary`，下划线照常展开 |
| 图标按钮悬停 | 不变（`--color-primary` 填充由小变大 + 白图标 + 图标辉光） | 同左 |

```scss
body.has-hero .site-header:not(.is-scrolled) {
  --header-fg: var(--color-over-hero-soft);
  background: transparent;
  backdrop-filter: none;
  box-shadow: none;

  .nav-link:hover  { color: var(--color-over-hero); }
  .site-logo:hover { color: var(--color-over-hero); }
}
```

> `.site-logo`、`.nav-link`、`.action-btn` 都消费 `--header-fg`，改一个变量即可整条 Header 一起降档。
> `.nav-caret` 从 `.nav-link` 继承，一并变白。二级菜单子项不受影响——它显式写着
> `color: var(--color-text)`，压在面板自己的浅色背景上，不参与 Header 的透明态。

**静止时为什么是"略灰的白"而不是纯白**（`--color-over-hero-soft`，85% 白）：
整条 Header 全白会与封面图争抢注意力，"全透明让位给图片"的意图就落空了。
降一档后 Header 退成次要信息，悬停时再提到纯白，反馈也因此更明确。

**Logo 悬停为什么在常驻态无变化、顶部态才转白**：常驻态 Header 是浅色底，
转白等于白底白字，本就不可行；顶部态压在照片上才成立，也才需要与 `.nav-link` 一致的反馈。
Logo 没有下划线可依托，反馈只能靠亮度差——所以静止态特意压到 `--color-over-hero-soft`，
悬停才有可提亮的空间（若静止就是纯白，这里就没有反馈可言了）。

**导航项悬停为什么用白而不是主题色**：橙色压在照片上不够干净，与上述意图相冲。
只保留下划线（细，作为点缀正好，仍是主题色）。
图标按钮保留原有的橙底白字填充——那是块状的实心反馈，压在图上反而精神，两者不冲突。

> 这条例外只作用于**首页顶部态**，内页 / 滚动后仍走 §6.3 的 `--color-primary` 悬停。

**为什么要关掉毛玻璃**：只把背景设成透明是不够的。`backdrop-filter` 会照糊背后的内容，
标题栏位置仍会留下一条模糊带——那就不是"全透明"。

**为什么要去掉阴影**：压在照片上的投影只会变成一道脏印。

**为什么前景要转白**（用户未提出，属必要的补足）：
封面图 `cover1.jpg` 是深色调（实测顶部条带平均亮度 42.8/255，全图 69.5/255）。
亮色模式下正文色是 `#1F2328`，压上去对比度接近 0，Header 等于消失。
白字在明暗两种主题下都成立，故走 `--color-over-hero` 系列固定值
（叠加 `.hero::after` 遮罩后顶部条带亮度仅得 27.8/255，白字对比度进一步拉开）。

**为什么用 `body.has-hero` 限定**：内页顶部没有 Hero，转白会变成白底白字。
`has-hero` 由 `baseof.html` 在 `{{ if .IsHome }}` 时加到 `<body>`。
滚动后 `.is-scrolled` 生效、`:not()` 失配，上表右列自动全部还原。

### 7.4 首页布局改动 ✅

`.main` 补的是 `calc(var(--header-height) + var(--space-6))`，因为 Header 现在是 `fixed` 不占位。
首页由 `baseof.html` 给 `<main>` 加 `main--home`，置 `padding-top: 0` —— Hero 本就要铺满视口。
Hero 之后的内容由 `.hero + .container` 补回间距。

### 7.5 Hero 中央一言卡片 ✅

> 卡片浮在封面图上、与上方的作者徽章合为一个整体居中（见 §7.6）：一层毛玻璃
> （暗色下额外叠一档深色底），左上 / 右下角为引号装饰，中间是一言——逐字打出、
> 停留、删除、换下一条。文案与开关都在 `hugo.yaml`。

| 项 | 规格 |
| --- | --- |
| 配置 | `params.hero.hitokoto`：字符串列表；**不配置则整张卡片不渲染** |
| 位置 | 居中交给 `.hero-stage`（与作者徽章作为整体，见 §7.6）；`.hero-quote` 退为 `position: relative`——只为角落引号与切换按钮当定位基准 |
| 尺寸 | 完全跟随可见文字：宽度 `width: max-content`、`min-width: 680px`、`max-width: 75vw`（长文案先撑宽、到顶才折行）；高度 `min-height: 140px`，折行那一刻由内容撑高（每行 +38px：单行 140px、两行 172px）；内边距 48 / 64px；`--radius-xl`（24px）；本期不做移动端适配 |
| 玻璃 | `backdrop-filter: blur(--hero-card-blur)`；底色 `--hero-card-bg` **仅暗色**（浅色 `transparent`，纯毛玻璃）；**无描边、无投影** |
| 引号 | 左上 `--open` / 右下 `--close`，`--color-over-hero` @ `opacity: .35`，`2rem`；**同一个 SVG 旋转 180°** |
| 一言文字 | `--color-over-hero`，`1.25rem / 1.9` 行高，居中 |
| 光标 | 2px 竖条（`1.1em` 高），`steps(2, jump-none)` 方波闪烁；打字 / 删除期间常亮（`.is-typing`） |
| 时序 | 打字 `110ms`/字（中文标点后 +`260ms`）→ 停留 `2800ms` → 删除 `45ms`/字 → `500ms` 后下一条；首条进场延迟 `600ms` |
| 随机 | 首条固定为配置里的第一条（与模板静态兜底一致），之后每次随机且**不与当前条重复**；只配置一条时打完停住，不循环 |
| 暂停 | 鼠标悬停卡片、或**键盘焦点**（`:focus-visible`）在卡片内时，打字机在当前位置暂停；移开 / 失焦按剩余时间从断点续上。悬停期间文字与光标定格；鼠标点击按钮产生的焦点**不算**（原因见下） |
| 降级 | 无 JS：模板静态渲染第一条；`prefers-reduced-motion`：不打字，直接静态展示随机一条（光标隐藏） |

**为什么浅色不加底、暗色才加**：浅色模式下卡片只是一层毛玻璃——把文字区域从照片里"糊"出来，
不再压一层深色，与 §7.3"Header 让位给图片"的克制一致；暗色模式整体基调更沉，
叠一档深色底（`rgba(16,18,22,.4)`）让白字在照片亮部也立得住，卡片也才有"实体"感。

> 实现走令牌的主题覆盖（§3.2 表）：`--hero-card-bg` 浅色 `transparent`、暗色给值，
> 组件样式不必感知主题——与 `--header-bg` 同一套路。

**为什么无描边、无投影**：卡片只有"玻璃"这一个元素，描边与投影会把简洁变成"组件"；
且浅色下没有底色时，投影会变成一圈悬空的灰晕，比没有更脏。

**宽度为什么到 75vw 才折行**：短句保持 680px 基底；长句不折行，把卡片撑宽
（`max-content`），直到 75vw 封顶——75vw 是"还是卡片"的极限，再宽玻璃的两条边
就贴到视口外，看起来像整幅图上的一条横带；封顶后宁可折行，保住"一块玻璃"的形态。

**尺寸为什么完全跟随可见文字（不预留）**：打字机要演的就是"文字自己长出来"——
每打一个字卡片宽一点；跨过 75vw 后宽度停住，字落到第二行，卡片才顺势长高；
删除时一切严格反着来。若按整句预留宽 / 高，字还没打到、卡片就已经满宽两行，
生长感就没了（曾试过隐藏计量层预留宽度，验收时按"高度要等真折行才加、宽度也不要预留"去掉）。

**折行后高度怎么加**：单行保持 140px（`min-height` 托底）；上下内边距留 48px 后，
每多一行文字就顶高 38px——两行 172px、三行 210px，不写死高度。
左右内边距 48 → 64px 是折行暴露出来的问题：折行后的长行端点会贴到内边距边缘，
而角落引号内缩 24px、自身 2rem，占到距边 56px——48px 时首字会与引号相碰，
64px 让开（单行文案居中，观感不受影响）。

**悬停为什么要暂停打字**：卡片尺寸完全跟随打字（上一条），而切换箭头就压在
卡片左下角——卡片"边打边长"会把按钮从指针底下横移走，点击落空。
暂停 = 记下剩余时间 + 清掉计时器，恢复时按剩余时间重新计时，而不是从头再等
一遍，续上的节奏与从未暂停完全一致。键盘焦点（Tab 到箭头按钮）也纳入暂停条件：
焦点在卡片里时，任何一次文字生长同样会把焦点按钮挪走。两个条件取"或"。

**焦点条件为什么只认键盘焦点（`:focus-visible`）**：鼠标点击按钮同样会产生焦点
（Chrome / Firefox 的行为）——若把这种焦点也计入，点完按钮再移开鼠标，焦点还留
在按钮上，两个条件都不解除，打字机永远不恢复（实测 bug）。`:focus-visible` 是
浏览器"这焦点是键盘给的"判定：鼠标点出来的焦点不算，那种场景本来就由悬停兜着
（指针在卡片上时必定处于暂停）。老浏览器不支持该伪类（`matches` 抛错）时
退回"焦点即暂停"的旧行为。

**引号为什么共用一个 SVG 旋转 180°**：收尾引号正是开头引号的中心对称图形
（路径坐标逐点满足 `(x, y) → (64-x, 64-y)`），存两份 path 既冗余又容易改漏一半。

**为什么要写 `icon.html`**：mdi 字体库没有引号这类图形，主题自绘的 SVG 需要按名字取用，
并由调用点决定尺寸 / 颜色 / 旋转。封装成 partial 后，模板只写语义（哪里要什么图标），
不再复制 path 数据；注册表只存 path、外壳统一生成，改外壳属性不必逐个图标改。
mdi 字体图标（导航，§6.5）继续沿用 `<i class="mdi …">`，两套互不影响。

**光标为什么用 `steps(2, jump-none)`**：闪烁必须是方波（瞬间切换、两段各占一半），
平滑的 `opacity` 过渡会变成"呼吸灯"，那就不再是光标了。

**为什么用 `data-hitokoto` 传 JSON 而不是拆成一堆隐藏节点**：文案只有在 JS 里才消费，
序列化到 data 属性即可；`jsonify` 的输出会被 html/template 按属性上下文正确转义。
打字只对 `textContent` 做切片，不碰 `innerHTML`——文案将来含 `<` 也不会被解析成标签。

**为什么只有一条时不循环**：删除再重打同一句像故障；打完停住、光标常闪，是"展示"而不是"轮播"。

**首条为什么延迟 600ms**：模板里已静态渲染第一条（无 JS 时的兜底），
进场先亮一下整句再清空开打，避免卡片刚出现就空着的突兀感；
重打的仍是第一条而不是随机跳一条——文字与静态兜底完全一致，不会整句跳变。

**打字机写在 `home.js` 而非 `main.js`**：它是首页专属逻辑，符合 §4.3 的分工；
沿用同一套幂等 init 约定（`dataset.bound` + `window.inalinePageInit`）供 Swup 复用。

---

### 7.6 博主头像与名称 ✅

> 浮在卡片上边缘上方居中：圆形头像 + 右侧名称，像一枚"作者徽章"压在卡片头顶。
> 块是 `.hero-stage` 的首个子项（卡片不渲染时它也不出现），与卡片以 `--space-5`
> 相邻——位置在卡片之外，但不靠绝对定位。

| 项 | 规格 |
| --- | --- |
| 位置 | `.hero-profile` 与 `.hero-quote` 同为 `.hero-stage`（`inset: 0` 的 flex 列）的子项：**垂直居中基准 = 徽章 + 卡片合起来的外接框**（`justify-content: center`），不是卡片自己的中心——卡片单独居中时整块重心偏上「徽章 + 间距」的一半（实测 61px）。水平方向由 `align-items: center` 居中：整个徽章（头像 + 名称）的自身中心压在卡片中线上，放大时向两侧等量展开。徽章是并列的兄弟节点，**不进卡片 flex 流**，卡片尺寸（§7.5）不受影响 |
| 块高 | `height: --hero-avatar-size`（= 头像直径 72px）：名称的行盒（`3.5rem × 1.75` = 98px）比头像高，不钉住的话外接框多出一圈看不见的行间留白，组合被压低 13px |
| 配置 | `params.hero.avatar`：网络图片写完整 URL（`http://` / `https://` 原样引用）；本地图片写 assets 路径（走 `resources.Get`，找不到构建告警、只留名称）；**留空 / 删除该行则整块不渲染** |
| 名称 | 取 `params.author`：`3.5rem`、字重 500、字距 `.02em`、`--color-over-hero` + 投影兜底 |
| 头像 | `--hero-avatar-size`（`72×72`，同一令牌也定徽章块高）、`border-radius: 50%`、`object-fit: cover`；2px 半透明白圈（`box-shadow` 外扩——不占布局、不吃圆角） |
| 悬停 | 头像转一圈：悬停顺时针、移出逆时针原路转回，`transition` 500ms `--ease`（中途移出从当前角度直接掉头）；reduced-motion 下不转 |
| 兜底 | `<img>` 带 `width` / `height`（占位属性，防加载完成后布局跳动；真实尺寸走 `--hero-avatar-size`）与 `referrerpolicy="no-referrer"`（不向图源泄露来源）；纯 CSS 实现，无 JS 依赖 |

**为什么头像"架"在卡片上方而不是放进卡片里**：卡片（§7.5）的尺寸完全跟随打字，
放进卡片就成了内容的一部分——会顶高尺寸基线，还和左上角引号抢位置；
做成 stage 里与卡片并列的第一个子项，则两者互不干扰：打字只让卡片自己长大，
徽章始终贴着上边缘（间距 = stage 的 `gap`）。间距取 `--space-5`（24px），
与角落引号的内缩同距，视觉上成套。

**垂直居中基准为什么是"它俩一起的中心"**：徽章全挂在卡片上方，若只把卡片居中
（`top: 50%` + `translate(-50%, -50%)`），组合的可见范围（头像顶边 → 卡片底边）
重心整体偏上——偏差正是「徽章 + 间距」的一半：徽章块 98px 时实测偏 61px，
钉成头像直径后为 48px。一眼看去是"卡片顶着个徽章"，重心却压在下半。
改由 `.hero-stage` 的 flex 列居中后，基准换成两者的外接框：徽章变大、间距调整、
一言折成几行，整块都在视口正中；没有徽章时列里只剩卡片，自动退回"卡片自己居中"。

**徽章的高度为什么钉成头像直径**：名称继承 body 的行高 `1.75`，`3.5rem` 的行盒
就有 98px，比头像（72px）高出 26px——这截留白看不见，却会被 flex 列算进外接框，
把整块压低 13px。钉 `height: --hero-avatar-size` 之后，徽章的外接框就是头像的圆，
与视觉边界一致；名称的行盒溢出这 72px 但随 `align-items: center` 居中，字形位置不受影响。

**水平居中基准为什么也是"它俩的中心"**：stage 的 `align-items: center` 作用于
整个 `.hero-profile` 块——头像 + 名称作为一个整体，其自身中心压在卡片中线上；
不是把头像单独摆在中心线上（那样名称全挂在右侧，整块看起来偏）。头像放大时，
加宽向左右等量展开，中心点不动。

**旋转为什么用 `transition` 而不是 `animation`**：要的是一对完整动作——
悬停顺时针转出去、移出逆时针转回来。`transition` 的终点值决定回程：
悬停到 `rotate(360deg)`，移出时从 360° 平滑转回 0°，正好是反向的一圈；
中途反悔（没转完就移出）也会从当前角度立即掉头。静态时 360° ≡ 0°，
不悬停没有残留状态。`animation` 单程播完即撤，移出无动作——达不到这个效果。

**为什么支持网络图片**：头像这类"个人标识"图通常已在别处托管（如 QQ 头像接口），
强制走 `resources.Get` 等于要求先把图下载进仓库；URL 原样引用让配置直接可用。
本地路径分支保留，两种写法在配置层等价。
⚠️ 站点部署在 https 下时，网络图片必须用 https，http 会被浏览器按混合内容拦截。

---

### 7.7 文章卡片与分页 ✅

> 首页与列表页（`/posts/`、标签词条页）共用一套条目：图文左右交替的卡片，图位 3:2 定死，
> 文字列自上而下是 元信息行（图标 + 文字四项）+ 标题 + 两行摘要。没配封面的文章按序取
> 兜底图（与 Hero 背景同池），所以列表里不会出现"图位留白"的破相。
> front matter 写 `pinned: true` 的文章，封面外侧上角多一块"置顶"角标。

| 项 | 规格 |
| --- | --- |
| 模板 | `post-card.html`（参数 `page` + `index`）、`pager.html`（参数 `paginator`）、`cover-pool.html`（返回封面资源池）；调用方 `home.html` / `section.html` / `term.html` |
| 布局 | **图文交替**：奇数条图在左、偶数条图在右（`.post-card--flip` → `flex-direction: row-reverse`）。封面 300px 宽、撑满卡片全高且**紧贴卡片边缘**（卡片 `overflow: hidden` 按 `--radius-lg` 裁角），文字列吃剩余宽度且 `min-width: 0`；图文间距 `--space-5`，文字列内边距 `--space-4`（贴封面的一侧留 0，否则与 gap 撞成双份） |
| 封面效果 | `.post-card-cover` 上 `clip-path` 斜切一角：非交替卡切右上（`polygon(0 0, 92% 0, 100% 100%, 0 100%)`），交替卡镜像切左上（`polygon(8% 0, 100% 0, 100% 100%, 0 100%)`） |
| 卡面 | `--color-elevated`（白）+ `--shadow-sm` + `--radius-lg`；悬停 `--shadow-md` + `translateY(-2px)` + 封面 `scale(1.04)`（溢出被图位裁掉） |
| 标题 | `1.5rem`；**悬停反馈挂在卡片上**（`.post-card:hover .post-card-title a`，见下"为什么悬停反馈挪到卡片上"） |
| 元信息 | **图标 + 文字，四项一排，排在标题上方**：发布时间（`mdi-calendar-blank-outline`）/ 阅读时长（`mdi-clock-outline`）/ 阅读量（`mdi-eye-outline`）/ 评论量（`mdi-comment-outline`）；`0.875rem` / `--color-text-muted`，项间距 `--space-4`、图标与文字间距 `--space-1`。**标签已从卡片移除**（挪去摘要之后，待分类 / 标签行落地） |
| 统计占位 | 阅读量 / 评论量输出 `—`，是**明确的无数据标记**而非 `0`——硬编码的 `0` 会被当成真值。等 Waline（阶段 9）接上后由前端回填，`.post-card-stat` 是回填挂钩 |
| 摘要 | `or .Description .Summary` → `plainify` + `truncate 120`，CSS `line-clamp: 2` |
| 封面 | front matter `cover`：网络图片（`http://` / `https://` 原样引用）或 assets 路径（`resources.Get`，找不到构建告警）；未配置 → `cover-pool.html` 按 `index` 轮换取一张 |
| 分页 | 走 `hugo.yaml` 的 `pagination.pagerSize`（10）；`上一页 / 1 2 3 / 下一页`，总数不超过一页时整个块不渲染 |
| 整卡点击 | `.post-card-link`：铺满卡片的空 `<a>`（`position: absolute` + `inset: 0` + `z-index: 1` + `border-radius: inherit`），作为卡片**子元素**放在最前，卡片任意位置都能开文章；与封面链接同样 `tabindex="-1"` + `aria-hidden="true"` |
| 置顶角标 | front matter `pinned: true` → `.post-card-badge`：白底圆角矩形 + `mdi-thumb-up-outline` + "置顶"（`0.875rem`），`--badge-bg` / `--badge-fg`（**两主题同值**，不进 dark-tokens）；贴在封面**外侧上角**（非交替卡左上、交替卡镜像到右上），`top: 0` + `left: 0`（交替卡 `right: 0; left: auto`），内边距 `--space-1` `--space-2`、图标与文字间距 `--space-1`；只圆**外露的内侧角**（`border-radius: 0 0 var(--radius-md) 0`，交替卡镜像为 `0 0 0 var(--radius-md)`），贴边的两角与卡片边缘共线、与卡片圆角重合的那角由 `overflow` 裁圆；**故意不设 `z-index`**——压在封面之上、覆盖层之下 |
| 角标模板 | `{{ if $page.Params.pinned }}` 包裹，图标 `aria-hidden="true"`、**"置顶"二字留在可访问性树里**（它是内容不是装饰） |
| 降级 | `<img>` 带 `width` / `height` / `loading="lazy"`；封面链接与覆盖层 `tabindex="-1"` + `aria-hidden="true"`（读屏不念两遍、Tab 不多停一次）；reduced-motion 下撤掉位移与缩放，保住颜色与阴影反馈 |

**为什么卡面取白（`--color-elevated`），页面底色让出白**：白卡能不能立住，取决于它
压在什么底色上，而不是阴影画得多重。页面底色是纯白时，白卡与页面一模一样的明度，
边界只能靠阴影去"描"——轻了糊、重了脏；反过来把白让给卡片、页面退到 `#F5F5F5`（§3.2），
卡片轮廓先由底色画出来，阴影只再补一点"浮起来"的体感，也就不必画得很重。
这是**成对的决定**：只改卡面而不动页面底色，就等于回到"白上画白"。

暗色下 `--color-elevated` 与 `--color-surface` 同为 `#1E2127`，卡面依旧比背景
`#16181D` 高一档，观感与改造前一致——所以这次调整只影响亮色。

**`--shadow-sm` 为什么是两层、又为什么收得这么轻**：两层（贴边 + 弥散）是结构，
轻是分寸。白卡压在浅灰底上，**明度差已经把卡片轮廓画出来了**，阴影只该做微调；
v3.22 一度加重到 `.04 / .06`、弥散 8px，实测层级区分过度——像在灰纸上贴了张纸，
阴影替底色干了它已经干完的活。收回 `.03 / .04`、弥散 6px 后，卡片靠颜色立住、
阴影只剩"离地一点点"的暗示，两者不再重复表达同一件事。

**为什么只收 `--shadow-sm`**：它是卡片专用（`.post-card` + `.sidebar-card`），
而 `--shadow-md` 还兼着 Header 滚动态（§6.1），收它会顺带改掉不在这次范围内的东西。
悬停态仍升 `--shadow-md`（`0 6px 18px .08`）——那是一次**状态反馈**，不是层级区分，
落差明显才好读。

**为什么图位取 3:2**：真封面与兜底图的原始尺寸各不相同（兜底图是 1600×1131），
按原比例排会让每张卡高矮不一，列表立刻散架，所以比例必须定死、图片走
`object-fit: cover`。候选三档在 300px 宽下的表现：

| 比例 | 图位高 | 扣掉内边距可用 | 结论 |
| --- | --- | --- | --- |
| 16:9 | 169px | 137px | 太扁。标题 + 元信息 + 两行摘要约 126px，塞完只剩 11px，分类 / 标签那行进不来 |
| 4:3 | 225px | 193px | 高度够，但横向封面用这个比例偏方，观感接近方图 |
| **3:2** | **200px** | **168px** | 正文 126px 之外还留 42px，够一行标签，横向观感也正 |

3:2 还是 35mm 胶片的经典比例，各站"特色图"最常用的一档。裁切兜底图
（1600×1131 ≈ 1.41:1）方面它和 4:3 其实打平：3:2 切上下、4:3 切左右，
各损失约 5.7%；16:9 要切掉约 20%，是真正吃亏的那一档。

**为什么 4:3 也只是"下限"**：封面挂着 `align-self: stretch`（§7.7 上文），
文字列更高时封面会被拉到卡片全高，实际比 4:3 更瘦长；比例真正管的是**卡片最矮
能多矮**——没有摘要的文章，卡片不会被压成一条。文字块垂直居中 + 摘要
`line-clamp: 2`，摘要多一行少一行都不改变卡片高度，节奏就稳了。

**为什么斜切挂在封面上而不是 `<img>` 上**：悬停时 `img` 放大 1.04 倍。切线挂在
封面这层，放大的是框里的照片、斜边纹丝不动，读起来是"照片在斜框里呼吸"；
挂到 `img` 上则 `clip-path` 的百分比跟着 `transform` 一起缩放，斜边会随悬停滑动。

**为什么交替用 `row-reverse` 而不是在 DOM 里换序**：模板只管按序号挂一个类，
读屏与 Tab 序仍是"先图后文"的固定顺序——视觉左右轮换不该伸手去改文档结构。
同理，斜切边在交替卡上要镜像过来（切左上），否则两条斜边同向，纵向扫下来是歪的。

**交替的代价要认清**：卡片左边缘不再是一条直线，纵向扫读时会"锯齿"。
这是刻意的节奏感，但页面上同时出现两种卡片形态，视觉重量天然不等——
真觉得晃眼，把 `.post-card--flip` 那组规则删掉即可回到单侧，`row-reverse`
之外没有任何结构依赖。

**为什么兜底图与 Hero 同池**：站点已经有一批调过色的封面图（`params.hero.covers`），
再养一套"默认封面"既多余、又容易和 Hero 打架。抽 `cover-pool.html` 是为了让"同池"
成为结构上的事实——改 `hugo.yaml` 一处，Hero 背景与卡片兜底一起变。
代价要认清：文案上不能再说"没配封面就没有图"，这张卡的图位永远是满的。

**为什么封面链接要从 Tab 序里摘掉**：封面是标题链接的视觉重复。留着它，键盘用户
每张卡要多按一次 Tab、读屏要把同一个目标念两遍。`tabindex="-1"` + `aria-hidden="true"`
只影响可访问性树与焦点序，鼠标点击照常跳转。整卡覆盖层同理，用的是同一套处理。

**为什么整卡覆盖层是子元素而不是父元素**：把整张卡套进 `<a>` 是最省事的写法，
但卡片里已经有标题链接（分类 / 标签行的链接也在路上），`<a>` 套 `<a>` 是
**非法 HTML**——浏览器会替你把嵌套的那层拆开，DOM 与你写的就不是一回事了。
所以卡片保持 `<article>`，覆盖层作为它的**子元素**绝对定位铺满（`inset: 0`），
压在封面与文字之上。绝对定位的子元素不是 flex 项，图文布局一点不受影响。

**为什么悬停反馈从标题链接挪到了卡片上**：覆盖层盖住了标题，指针再也碰不到
那个 `<a>`，写在 `.post-card-title a:hover` 上的规则永远不会触发。挪到
`.post-card:hover .post-card-title a` 之后，鼠标停**卡片任意位置**标题都会亮——
整卡可点的时候，"停哪都亮"本来就是"这里整块能点"的提示，比原来只亮标题更贴切。

**整卡点击的两个代价要认清**：
一是**文字不再能选中**（覆盖层把指针全接了），列表页里复制标题 / 摘要会失败——
正文页不受影响；二是**卡片里日后加的可点元素会被覆盖层截胡**（分类 / 标签行），
必须给它 `position: relative` + `z-index: 2` 抬到覆盖层之上。覆盖层用 `z-index: 1`
而非更大的值，就是因为这个 1 是**卡片内部**的局部层级，不参与 Header / 浮层那套
`--z-*`，抬一个组件上来只需 2。

**置顶角标为什么贴在"外侧上角"**：封面被斜切的那一刀切掉的是**靠文字列的内侧角**
（非交替卡切右上、交替卡切左上），外侧上角才是完整的直角——角标要贴卡片边，
就只能贴在这个"没被切过"的角上。交替卡随之镜像到右上：贴边的两侧恒为
"卡片顶边 + 卡片外边"，这是"贴边"这件事本身决定的，与左右无关。

**角标为什么只圆一个角**：贴边的两条边（上、外侧）与卡片边缘共线，那个角要是圆的，
就会在卡片笔直的边缘上凹进去一块；与卡片圆角重合的那一角由 `overflow: hidden` 免费
裁圆，不必自己画。所以自己只需要圆**外露的、朝卡片内部的那个角**——角标于是读起来
像"从卡片角上长出来的一块"，而不是贴上去的方块。

**角标为什么不设 `z-index`**：`z-index` 的默认值（`auto`）让它压在封面之上
（封面是静态元素，必然排在所有定位元素之下）、但仍在覆盖层（`z-index: 1`）之下。
这个次序正是要的：**点角标照样开文章**，不会在卡片角上留出一块点不动的死区。
一旦顺手给它 `z-index: 2`，角标就会变成一块"看着能点、点了没反应"的坏区域。

**角标的白为什么不跟主题翻**：它坐在**照片**上，不是坐在页面底色上。跟着主题在
暗色下翻成深底，就会在深色封面上糊掉——封面图的明暗跟页面主题没有任何关系。
同 `--color-over-hero`、`--glow-*`，故 `--badge-bg` / `--badge-fg` 定义在 `:root`
而不进 `dark-tokens`。图与字都是固定值，`--badge-fg` 不能图省事用 `--color-text`
（暗色下那是浅色，白底浅字直接看不见）。

**置顶只做了角标、还没做排序**：Hugo 没有 `.ByPinned`（本机 v0.165.0 实测没有），
置顶文章排到最前要自己接——要么列表页先 `where .Params.pinned` 再拼剩余，
要么走 `weight`。角标解决的是"看得出哪篇是置顶"，排序解决的是"它得在最上面"，
两件事分开做，别顺手混在一起。

**为什么两篇文章也要接分页**：`pagerSize` 写在 `hugo.yaml` 里就说明要的是分页，
而模板里 `range` 全量列表 = 配了不生效的静默不一致——文章涨到第 11 篇时它会直接
从首页消失，且没有任何提示。`.Paginate` 接上后第 11 篇自己长出第二页；
页码条克制（`上一页 / 1 2 3 / 下一页`，当前页实心主题色），文章数过 10 之前不出现。

**为什么元信息行排在标题上方**：它的四项（时间 / 时长 / 阅读量 / 评论量）都是
**判断要不要读**的依据，排在标题上方等于"先给决策信息，再给主题"；排在标题下方
则会被当成落款，读者扫过标题就已经决定跳过了。一个例外要说清：发布时间严格说是
"落款"性质，但为了四项排成完整一排、不把行拆成两截，它跟其余三项一起上移。

**为什么阅读时长要自己算，不用 Hugo 的 `.ReadingTime`**：后者按**空格**切词，
中文整段没有空格，会被算成区区几个"词"，估出来的分钟数低得离谱。这里改成
`countrunes(replaceRE "\s+" "" (plainify .Content)) ÷ 400`，即"正文非空白字符数
÷ 400 字/分钟"，向上取整、不足 1 分钟按 1 分钟。400 是中文速读的常用估值，
本来就是估算值（图片、代码块未单独折算），不必精确。

**为什么统计占位输出 `—` 而不是 `0`**：`0` 是个会被当成真值的数字，页面在
Waline 接上之前会一直宣称"这篇文章 0 人看过"；破折号则明确是"无数据"。两项都挂
`.post-card-stat`，接 Waline 时只改模板、不动样式（§8 阶段 9）。

**为什么封面宽度按 300px 取**：两栏布局（§7.8）落地后主栏 848px，
扣掉封面（300）、图文间距（24）与文字列右内边距（16），文字列还有 508px 上下
（约 31 个汉字一行，读起来不费劲）。这是按"主栏吃满 `--container-width`
减掉侧栏"反推的值，侧栏宽度与栏间距（§7.8）一改，这里要跟着复核。

（260 → 300 是观感回调：260px 在 3:2 下只有 173px 高，配上收轻后的阴影显得单薄、
封面在卡片里占比过小。放宽到 300px 一度把文字列挤到 460px，后来侧栏收窄
（§7.8，320 → 280）把这 40px 还了回来；栏间距再由 32 收到 24，文字列回到 508px。）

---

### 7.8 两栏布局与右侧栏（骨架）✅

> 列表页（首页 / `/posts/` / 标签词条页）改为两栏：左主栏放文章卡片列表，右侧栏放组件。
> **本期只搭骨架**——侧栏里是空白占位卡，真实组件（个人卡 / 公告 / 标签云 /
> 最新文章）后续逐个填，一个组件一张 `.sidebar-card`。

| 项 | 规格 |
| --- | --- |
| 骨架 | `.container.container--wide.layout`：容器给宽度与居中，`.layout` 给栅格；主栏 `.layout-main` 包住标题 / 列表 / 分页，侧栏 `sidebar.html` 平级 |
| 栅格 | `grid-template-columns: minmax(0, 1fr) var(--sidebar-width)`，间距 `--space-5`（24px）；`align-items: start` 让侧栏不被主栏拉高 |
| 宽度 | 容器 1200px（含左右内边距各 24）→ 内容 1152；侧栏定宽 280，主栏吃剩余 **848px**，与 Header 左右对齐 |
| 侧栏 | `.sidebar` 纵向 flex，间距 `--space-5`；占位卡 `.sidebar-card` 与文章卡片同一套语言（`--color-elevated` + `--shadow-sm` + `--radius-lg`），`min-height: 120px` |
| 断点 | `@media (max-width: 1080px)`：栅格转单列 + `.sidebar { display: none }` |
| 未接入 | 文章详情页（仍是 `--content-width` 单栏，属阶段 4）、标签索引页 `taxonomy.html`（列标签而非文章，不配侧栏）、页脚（单行居中，宽度变化看不出来） |

**为什么主栏是 `1fr`、侧栏才定宽**：侧栏组件（标签云、日历）对宽度敏感，被压窄就散架；
主栏里是文字，让几分不会破相。栅格列默认 `min-width: auto`，主栏必须写
`minmax(0, 1fr)`——否则长标题 / 长英文串会把它顶宽，反过来把定宽的侧栏挤没
（同 `.post-card-body` 的 `min-width: 0`，同一个坑）。

**栏间距为什么由 32px 收到 24px**：两栏的界线其实由 `--color-bg` 的灰底与白卡
画出来了（§7.7），32px 的白缝显得两栏在互相躲；24px 仍宽于卡片自己的内边距
（`--space-4`），不会读成"侧栏贴着主栏"。省下的 8px 归主栏。

**断点为什么是 1080px**：从主栏的最小可用宽度反推，而不是拍一个整百数。
主栏里固定吃掉 340px（封面 300 + 图文间距 24 + 文字列右内边距 16），
再给文字列留 340px（约 21 个汉字一行）→ 主栏最小 680px；
680 + 栏间距 24 + 侧栏 280 = 984 内容宽，加容器左右内边距 48 → 视口 **1032px**。
断点仍**留在 1080px**：主栏最小 680 是钉住的那一头，侧栏收窄（320 → 280）与
栏间距收窄（32 → 24）省下的宽度全归主栏——满宽时主栏 848px、文字列 508px，
断点处主栏 728px、文字列 388px，都比之前更宽松。往下挪断点等于
在更挤的窗口上还要塞下两栏，没必要。

主栏里的固定占用几经调整（316 → 300 → 340），断点始终 1080 不动，
让的一直是文字列的宽窄。理由是主栏里躺的是 `line-clamp: 2` 的摘要，不是连续正文——
窄一点对两行截断的文本够用，真觉得挤，改的是断点这一个数，卡片那边没有连带。

**为什么中间态是整个撤掉，而不是"侧栏变窄"**：280px 是能塞下标签云这类组件的下限，
再窄就是无效宽度；与其让侧栏缩成一条、主栏仍然憋屈，不如把这 280px 全还给文章。
真要做中间态，得先有能自适应窄栏的组件，那是响应式阶段（§8 阶段 11）的事。

**为什么侧栏不用 `position: sticky`**：占位卡只有 120px 高，sticky 看不出效果；
真实组件填进来、侧栏高度稳定后再定（`align-items: start` 已经为此铺好路——
不写它侧栏会被拉成与主栏等高，sticky 就没有可滑动的余量）。

---

## 8. 后续阶段大纲 ⏳

> 以下为占位大纲，进入对应阶段前再补充完整规格。

| 阶段 | 内容 | 关键待定项 |
| --- | --- | --- |
| 2 | 两栏布局骨架 + 右侧栏 ✅ **骨架已落**（§7.8：宽度 280 / 断点 1080 已定） | ⏳ 侧栏卡片组成——个人卡 / 公告 / 标签云 / 最新文章，逐个填 `.sidebar-card` |
| 3 | 首页文章列表 ✅（见 §7.7） | 卡片样式、分页方式、摘要规则——已定 |
| 4 | 文章详情页 | 目录 TOC、代码高亮主题、上一篇/下一篇、版权声明 |
| 5 | 页脚 | 备案号、运行天数、社交图标 |
| 6 | 归档页 / 标签页 | 归档时间线形式、标签云样式 |
| 7 | 动态页 `/moments/` | 内容形式（短文本时间线）、content 类型定义 |
| 8 | 友链页 `/links/` | 数据结构（`data/links.yaml`）、卡片网格样式 |
| 9 | 搜索 | 面板 UI + 搜索引擎（Pagefind / Fuse.js 待选） |
| 10 | Swup.js 接入 | 生命周期钩子、页面切换动画、各模块 `init()` 复用 |
| 11 | 响应式 | 断点、移动端导航（抽屉式）、侧栏折叠 |

---

## 9. 变更记录

| 日期 | 版本 | 内容 |
| --- | --- | --- |
| 2026-10-03 | v1 | 初稿（技术栈 + header 简述） |
| 2026-10-04 | v2 | 补全设计令牌、工程规范、暗色模式、字体策略、Header 完整规格；导航改为配置驱动并支持二级嵌套 |
| 2026-10-04 | v2.1 | 按首轮验收调整 Header：Logo 去悬停、阴影替代分割线、下划线贴合文字且宽度自适应、主题图标改描边样式 |
| 2026-10-04 | v2.2 | 下划线改为 3px 圆角胶囊并下移（改用 width 动画保证圆角不变形）；图标库由 Font Awesome 切换为 Material Design Icons |
| 2026-10-04 | v2.3 | 按参考实现对齐图标（主级务实心、主题图标改 brightness-4/6）；二级菜单改白底浮层——去描边、双层阴影分层、面板内边距收紧（子项内边距不变）；新增 `--color-elevated` 与 `--shadow-dropdown` 令牌 |
| 2026-10-04 | v2.4 | 二级菜单子项与右侧图标按钮的悬停改为实心填充（`--color-primary` 底 + `--color-on-primary` 文字）；新增 `--color-on-primary` 令牌。`nav-link` 悬停样式不变（下划线仍为橙色） |
| 2026-10-04 | v2.5 | 悬停实心填充增加发光：新增 `--glow-inset` / `--glow-text` / `--glow-halo` 令牌；过渡扩展至 `box-shadow` / `text-shadow`。二级菜单子项因面板裁切限制只用内发光，按钮额外带外光晕 |
| 2026-10-04 | v2.6 | 二级菜单最小宽度 `160px → 112px`，贴合两字子项的实际内容宽度 |
| 2026-10-04 | v2.7 | 新增 §7 首页：Hero 视差背景图 + 底部跳动箭头；新增 `_hero.scss` / `hero.html` / `home.js`；`baseof` 增加 `main--home` |
| 2026-10-04 | v2.8 | Hero 改铺满整个视口（`100vh`）；Header 由 `sticky` 改 `fixed` 以让位（`sticky` + 负边距会触发外边距塌陷）；新增首页 Header 顶部态：全透明 + 关毛玻璃 + 去阴影 + 前景转白；箭头渐变改为随动画位置变化的 `opacity`；`--header-height` `64px → 56px` |
| 2026-10-04 | v2.9 | 首页 Hero 加 `--hero-scrim` 压暗遮罩（`::after` + `pointer-events: none`），箭头 `z-index: 1` 置于遮罩之上；二级菜单背景由 `--color-elevated` 改为 `--header-bg` + `backdrop-filter`，与 Header 连成一体；箭头改为逐帧缓动（下行 `ease-out` 由快渐慢、回程 `ease-in`）并禁用悬停反馈（需显式覆盖全局 `a:hover`）；顶部态 Header 前景由纯白降为略灰的 `--color-over-hero-soft`，其下 `nav-link` 悬停改纯白并只保留下划线 |
| 2026-10-04 | v3.0 | Logo 悬停补 `:hover` 覆盖（全局 `a:hover` 泄漏，v2.1 的"无悬停效果"此前一直未生效）；顶部态下 Logo 悬停转纯白。箭头缓动由 `ease-out`/`ease-in` 改为 `cubic-bezier(.55,.55,.75,1)` 及其镜像 `.25,0,.45,.45`——起步即匀速、减速压缩到收尾一小段，并消除最高点的速度突变。新增页内锚点平滑滚动：`html { scroll-behavior: smooth }`（reduced-motion 下回退）+ `#home-content { scroll-margin-top }` 以躲开 fixed Header |
| 2026-10-05 | v3.1 | 配置由 `hugo.toml` 迁移到 `hugo.yaml`；导航改为树形 `params.nav`（`children` 嵌套，书写顺序即渲染顺序，移除 `weight` / `parent` / `identifier`），模板改为递归 partial（`nav-item.html`），三级及以下新增 `.nav-submenu` 横向展开样式；`nav-caret` 旋转选择器收紧为直接子级，避免影响深层箭头 |
| 2026-10-05 | v3.2 | 顶级「有二级菜单」展开箭头由 10px 放大到 12px（`.nav-link--parent .nav-caret`），并移入 `.nav-label` 内，使悬停下划线覆盖箭头；下拉内箭头保持 10px |
| 2026-10-05 | v3.3 | Header 新增滚动显隐：向下滚动收起（`.is-hidden`，`translateY(-100%)`）、向上滚动展开；顶部安全区（Header 高度 + 24px）内恒展开，焦点进入 Header 时强制展开；`prefers-reduced-motion` 下无过渡 |
| 2026-10-05 | v3.4 | 顶部导航图标与展开箭头统一放大到 `1rem`（`.nav-icon` 0.875rem → 1rem，`.nav-link--parent .nav-caret` 0.75rem → 1rem）；下拉内箭头保持 0.625rem |
| 2026-10-05 | v3.5 | 右侧操作区按钮悬停改分阶段到位：填充与图标 150ms 即时，辉光（`box-shadow` / `text-shadow`）延迟 80ms 出现；移出无延迟立即淡出。缓解多层效果同时到位的生硬感 |
| 2026-10-05 | v3.6 | 右侧按钮悬停只保留图标辉光，去掉外光晕与内高光（`--glow-halo` 失去引用，保留待用）；`--header-bg` 透明度 0.82 → 0.6；毛玻璃 12px → 20px 并抽成 `--header-blur` 令牌（Header 与下拉面板共用） |
| 2026-10-05 | v3.7 | 右侧按钮填充改为 `::before` 由小变大（方案 C）：`scale(.3)+opacity 0` → `scale(1)+opacity 1`，进入 `--duration-base`、移出 `--duration-fast`；按钮加 `position: relative` + `isolation: isolate`；`prefers-reduced-motion` 下关闭生长 |
| 2026-10-05 | v3.8 | 二级菜单子项填充对齐按钮的同款 `::before` 由小变大（方案 C），覆盖二级与更深层级全部下拉项；`--glow-inset` 移至填充层（inset 阴影先于负 z-index 子层绘制，留在链接上会被填充盖住）；子项不加 80ms 延迟；修正 `prefers-reduced-motion` 覆写块失效问题——原块位于文件顶部，被同特异度的后置组件规则整段盖掉（v3.7 按钮的覆写同样未生效），现移至文件末尾并显式列出 `:hover::before` 变体，按钮与子项一并生效 |
| 2026-10-05 | v3.9 | Hero 新增中央一言玻璃卡片（§7.5）：文案配置 `params.hero.hitokoto`，随机轮换 + 打字机（含方波闪烁光标）及停留 / 删除时序，单条时不循环；新增 `icon.html` 主题 SVG partial（`name` 取图，支持 `size` / `color` / `rotate` / `class`，首个图标为引号）；新增 `--radius-xl` 与 `--hero-card-*` 令牌；无 JS 与 `prefers-reduced-motion` 均静态兜底 |
| 2026-10-05 | v3.10 | 一言卡片简化：高度 `min 260 → 140px`（上下内边距 40 → 32px，一至两行恰好 140px）；深色底仅暗色模式添加（浅色 `transparent`，纯毛玻璃，走 §3.2 主题覆盖）；去掉描边与投影，`--hero-card-border` / `--hero-card-shadow` 令牌删除 |
| 2026-10-05 | v3.11 | 一言卡片尺寸完全跟随可见文字（不做预留）：宽度 `max-content` + `min-width: 680px` + `max-width: 75vw`（长文案先撑宽、到 75vw 才折行）；高度随折行内容撑高（上下内边距 32 → 48px：单行 140px、两行 172px、三行 210px）；左右内边距 48 → 64px 让开角落引号；轮换首条固定为配置第一条（与静态兜底一致，避免开打整句跳变）；`hugo.yaml` 增加一条长文案演示（可删） |
| 2026-10-05 | v3.12 | Hero 背景图改为 `params.hero.covers` 配置（assets 路径、可多张，未配置 / 解析不到回退内置 `cover1.jpg`）；每张渲染为一个 `.hero-bg-layer`，卡片左下角新增左右箭头循环切换（JS 挪 `.is-active`，`opacity` 600ms 交叉淡入，reduced-motion 下直接换）；`.hero-bg` 退为纯视差层、背景图下沉到图层，内联 `--hero-cover` 变量移除；新增 `cover2.jpg` / `cover3.jpg`（复制自 company-website 背景图，原文件实为 JPEG、已改扩展名） |
| 2026-10-05 | v3.13 | Hero 新增 `params.hero.initial_cover`（§7.1）：填 covers 路径（前导 `/` 可有可无，匹配不到构建告警并退回第一张）或 `random`（每次进入 / 刷新随机），留空取第一张；模板静态选中初始 `.is-active` 层（`random` 为构建期随机，兼作无 JS 兜底），`random` 时 `home.js` 按每次载入重摇——构建产物是静态的，刷新换图只能发生在浏览器里；切换下标改为先从 `.is-active` 反查起始层。一言打字机新增悬停 / 焦点暂停（§7.5）：卡片尺寸随打字变化会把左下角切换按钮从指针下挪走，悬停或键盘焦点进入时暂停，移开 / 失焦按剩余时间从断点续上（余时重计时，非重新计时）；两个条件取"或"，任一未解除都不恢复 |
| 2026-10-05 | v3.14 | Hero 新增博主头像 + 名称（§7.6）：`.hero-profile` 绝对定位浮在卡片上边缘上方居中（不进卡片尺寸计算），名称取 `params.author`；`params.hero.avatar` 支持网络 URL（http/https 原样引用，配 `referrerpolicy="no-referrer"`）与 assets 本地路径（`resources.Get`，找不到构建告警），留空整块不渲染；头像 48px 圆形 + 2px 半透明白圈，悬停 `animation` 500ms 快速转一圈（`transition` 移出会反向回程，不可用），reduced-motion 下不转；`hitokoto` 删除长文案演示 |
| 2026-10-05 | v3.15 | Hero 头像调整（§7.6）：尺寸 `48 → 72px`（名称 `1.125 → 1.25rem`、图文间距 `12 → 16px`），居中基准明确为"头像 + 名称整个组合的自身中心对卡片中线"（放大时向两侧等量展开）；旋转由单程 `animation` 改为 `transition`——悬停顺时针转一圈、移出逆时针原路转回，中途移出从当前角度掉头。修打字机暂停 bug（§7.5）：鼠标点击卡片按钮同样会产生焦点，旧逻辑把这种焦点计入暂停条件，点完按钮移开鼠标后打字机不再恢复；焦点条件改为只认键盘焦点（`:focus-visible`，老浏览器 `matches` 抛错时退回旧行为），新增两条回归用例（假时钟 63 项） |
| 2026-10-05 | v3.16 | §7.6 名称字号 `1.25 → 3.5rem` |
| 2026-10-06 | v3.17 | Hero 徽章与卡片改为整体居中（§7.6）：新增 `.hero-stage`（`inset: 0` 的 flex 列，`justify-content: center` + `gap`）承载两者，取代卡片自己的绝对定位居中——徽章全挂在卡片上方，卡片单独居中会让整块重心偏上 61px；`.hero-quote` 退为 `position: relative`（只当角落引号 / 切换按钮的定位基准），`.hero-profile` 由绝对定位改为 stage 的子项；徽章高度钉为头像直径（新增 `--hero-avatar-size` 令牌）——名称行盒 98px 比头像高，不钉住的话外接框会连那圈看不见的行间留白一起算进去、把整块压低 13px；没有徽章时列里只剩卡片，自动退回"卡片自己居中" |
| 2026-10-06 | v3.18 | 文章列表改为左图右文卡片 + 接上分页（§7.7）：`post-card.html` 重写（参数改为 `page` + `index`，`term.html` 同步更新），封面 16:9 定死、摘要 `line-clamp: 2`，卡面 `--color-surface` + `--shadow-sm`、悬停升 `--shadow-md` + 上浮 2px + 封面 1.04 倍；front matter 新增 `cover`（网络 URL / assets 路径），未配置走兜底图；封面池抽成 `cover-pool.html`，与 Hero 背景同池（改 `hero.covers` 两处一起变）；新增 `pager.html` + 首页 / 列表页 / 标签页 `.Paginate`（此前 `pagerSize: 10` 配了不生效，第 11 篇文章会静默消失）；`_post.scss` 的分页与卡片样式、动效降级块置于文件末尾（沿用 v3.8 的教训）；archetype 补 `cover` / `summary` 占位 |
| 2026-10-06 | v3.19 | 首页删除站点描述（§7.7）：`params.description` 不再渲染成页面上的一行字——满屏 Hero 与卡片列表之间没有它的位置，它此后只作为 `<meta name="description">` 的来源（`head.html`）；`home.html` 去掉该行、`_post.scss` 删掉 `.site-description` 规则 |
| 2026-10-06 | v3.20 | Hero 背景由滞后视差改为**视觉固定**（§7.1）：`home.js` 的 `FACTOR` `0.4 → 1`——位移正好抵消页面滚动，观感等价 `background-attachment: fixed`，但仍走合成器 `transform`（该属性每帧重绘整屏图，且 iOS Safari 不支持）；系数保留为可调项，调小即退回滞后视差（0.4 → 0.6 倍速上移）。顺带修正原先写反的注释（0 / 1 的含义颠倒） |
| 2026-10-06 | v3.21 | 背景固定改用 `background-attachment: fixed` 实现（§7.1），撤销 v3.20 的 JS 方案：`FACTOR = 1` 要求位移精确抵消滚动，主线程晚一帧就是一次错位——**滚动全程持续抖动**（0.4 时位移小、藏得住，1 时暴露无遗），故整段 `initHeroParallax()` 删除（含 scroll / resize / reduced-motion 监听），`.hero-bg` 父层（原只承载 transform）一并删除，图层 `inset: 0` 直铺 `.hero` 并加 `background-attachment: fixed`；代价是每帧重绘整屏图，Hero 只一屏且只在滚动时发生，实测不构成瓶颈；iOS Safari 不支持该值 → 退化为随页面滚动，接受 |
| 2026-10-06 | v3.22 | 文章卡片改**白卡**、页面底色让出白（§3.2 / §7.7）：亮色 `--color-bg` `#FFFFFF → #F7F8FA`、`--color-surface` `#F7F8FA → #EDEFF3`（页面变灰后，行内代码这类贴身底板必须比页面与白卡都深一档才处处看得见），卡面 `--color-surface → --color-elevated`；`--shadow-sm` 单层 `0 1px 2px` → 双层"贴边 + 弥散"（`0 1px 2px .04` + `0 2px 8px .06`；暗色同结构 `.3 / .4`）——卡片与浅灰底只差约 3% 明度，单层 1px 阴影几乎不可见；暗色下 elevated 与 surface 同值、bg 不变，故本次只影响亮色 |
| 2026-10-06 | v3.23 | 两栏布局骨架 + 右侧栏（§7.8，阶段 2 落地）：新增 `_sidebar.scss`（`main.scss` 已引入）与 `partials/sidebar.html`（三张空白占位卡，待填真实组件）；列表页（`home.html` / `section.html` / `term.html`）改为 `.container.container--wide.layout`，主栏 `.layout-main` 包住标题 / 列表 / 分页，侧栏平级；新增 `--sidebar-width: 320px` 与 `.container--wide`（1200px，与 Header 对齐）——容器内容 1152 = 主栏 800 + 间距 32 + 侧栏 320，主栏用 `minmax(0, 1fr)` 而非 `1fr`（栅格列 `min-width: auto` 会被长标题顶宽、反把侧栏挤没）；断点 `max-width: 1080px` 由主栏最小可用宽度 680px 反推（封面 260 + 间距 24 + 内边距 32 固定，再留 364px 文字列），到点侧栏整个撤掉、不做变窄的中间态；`align-items: start` 防侧栏被主栏拉高，为日后 sticky 铺路；文章详情页、标签索引页、页脚仍走 `--content-width` 单栏 |
| 2026-10-06 | v3.24 | 文章卡片去掉整卡内边距、封面贴边（§7.7）：`padding: var(--space-4)` 从 `.post-card` 移到 `.post-card-body`（左留 0，避免与 `gap` 撞成双份），卡片补 `overflow: hidden` 按 `--radius-lg` 裁掉封面伸出的四角；`.post-card-cover` 去掉 `--radius-md`（裁两次没意义）、显式写出 `align-self: stretch` 撑满卡片全高——它会**盖掉** `aspect-ratio` 定出的高度（拉伸后交叉轴尺寸已是确定值），故 16:9 退居"文字列更矮时兜住卡片最小高度"的下限，图片靠 `object-fit: cover` 裁切不变形；连带数字：主栏固定占用 316 → 300、满宽时文字列 484 → 500、断点处文字列 364 → 380，`§7.8` 断点 1080px 不动 |
| 2026-10-06 | v3.25 | 封面比例 16:9 → **4:3**、加斜切、图文左右交替（§7.7）：16:9 在 260px 宽下只有 146px，塞满标题 + 元信息 + 两行摘要（约 126px）后放不下分类 / 标签那一行，4:3 的 195px 留出约 37px 余量；`.post-card-cover` 加 `clip-path: polygon(0 0, 92% 0, 100% 100%, 0 100%)`（含 `-webkit-` 前缀）斜切右上角——挂在封面层而非 `<img>`，悬停放大时斜边才不跟着缩放滑动；图文交替由 `post-card.html` 按 `index` 奇偶挂 `.post-card--flip`，`flex-direction: row-reverse` 实现（DOM 里不换序，读屏与 Tab 序保持"先图后文"），文字列内边距与斜切方向随之镜像（交替卡切左上），两条斜边相向 |
| 2026-10-06 | v3.26 | 封面 260 → **300px 宽**、卡片阴影收轻（§7.7）：4:3 下 260px 只有 195px 高，配上刚收轻的阴影显得单薄、封面在卡片里占比过小，故放宽到 300px（4:3 → 225px 高，文字列可用高度 193px，容得下两行标签）；代价是文字列 500 → 460px。`--shadow-sm` `.04 / .06`（弥散 8px）→ **`.03 / .04`（弥散 6px）**，暗色同比例 `.25 / .3`——白卡压在浅灰底上，明度差已经把轮廓画出来了，原值等于让阴影替底色重复干一遍活，层级区分过度；**只收 `--shadow-sm`**（卡片专用：`.post-card` + `.sidebar-card`），`--shadow-md` 兼着 Header 滚动态（§6.1）故不动，悬停仍升它是状态反馈不是层级区分；`post-card.html` 的 `<img width/height>` 由 `320×180`（16:9）改为 `300×225`（4:3，与图位尺寸对齐）；§7.8 断点 1080px 仍不动，主栏固定占用 300 → 340、断点处文字列 380 → 340px |
| 2026-10-06 | v3.27 | 封面比例 4:3 → **3:2**（§7.7）：4:3 高度够（300px 宽下 225px）但横向封面用这个比例偏方、观感接近方图，换成 35mm 胶片起最常用的横向比例 3:2（300×200）；扣掉内边距可用 168px，正文 126px 之外仍留 42px 够一行标签。裁切兜底图（1600×1131 ≈ 1.41:1）3:2 与 4:3 打平（各约 5.7%，一个切上下一个切左右），16:9 要切约 20%；宽度 300px 与 §7.8 断点推算均不变（断点只吃封面**宽度**，与比例无关），`post-card.html` 的 `<img width/height>` 随之改为 `300×200` |
| 2026-10-06 | v3.28 | 右侧栏收窄 320 → **280px**、页面底色转**中性灰**（§3.2 / §7.8）：侧栏定宽减 40px，省下的宽度全归主栏——满宽时主栏 800 → **840px**、文字列 460 → **500px**（正好把 v3.26 封面放宽挤掉的那 40px 还回来），断点处主栏 680 → 720px、文字列 340 → 380px；**断点仍留 1080px**（按公式侧栏收窄后应为 1040，但 680 的主栏下限是钉住的那一头，往下挪等于在更挤的窗口上还要塞两栏）；`--color-bg` `#F7F8FA → #F5F5F5` 转不带色相的中性灰，`--color-surface` `#EDEFF3 → #EBEBEB` **跟着一起去色**——底色与底板是两个大面积色块、彼此紧挨，留一丝蓝调都会被看出来（保持原有约 10 级的明度差）；暗色不受影响；`_post.scss` 里那句已过期的宽度注释（"取 260px"）一并修正 |
| 2026-10-06 | v3.29 | 栏间距收窄 + 卡片元信息重做（§7.7 / §7.8）：`.layout` 间距 `--space-6`（32px）→ `--space-5`（24px）——两栏界线由灰底与白卡画出，32px 的白缝显得在互相躲，24px 仍宽于卡片内边距、不会读成贴合；省下的 8px 归主栏，满宽主栏 840 → **848px**、文字列 500 → **508px**，断点处主栏 720 → 728px、文字列 380 → 388px，**断点仍留 1080px**（按公式应为 1032）。卡片删除日期 + 标签整行，改为**图标 + 文字四项一排、排在标题上方**（`0.875rem` / `--color-text-muted`）：发布时间 `mdi-calendar-blank-outline`、阅读时长 `mdi-clock-outline`、阅读量 `mdi-eye-outline`、评论量 `mdi-comment-outline`（mdi 字体自带 `font-size: inherit`，不再另定字号）；阅读时长**不用 Hugo 的 `.ReadingTime`**——它按空格切词、中文整段被算成几个"词"，改为 `countrunes(replaceRE "\s+" "" (plainify .Content)) ÷ 400` 向上取整、下限 1 分钟；阅读量与评论量输出 `—` 占位（明确的无数据标记，不用会被当成真值的 `0`），挂 `.post-card-stat` 作为 Waline（阶段 9）回填挂钩；`page.html` 详情页的日期 / 标签不动 |
| 2026-10-06 | v3.30 | 文章卡片支持**整卡点击**（§7.7）：新增 `.post-card-link`——铺满卡片的空 `<a>`（`position: absolute` + `inset: 0` + `z-index: 1` + `border-radius: inherit`），作为卡片**子元素**放在最前，点卡片任意位置都能开文章；**不做父元素**是因为卡片里已有标题链接（分类 / 标签行的链接在路上），`<a>` 套 `<a>` 是非法 HTML，浏览器会自行拆开、DOM 与写法不一致；绝对定位子元素不是 flex 项，图文布局不受影响；同封面链接一样 `tabindex="-1"` + `aria-hidden="true"`（视觉重复，不进可访问性树与 Tab 序）；`.post-card` 补 `position: relative` 作定位基准；标题的悬停反馈由 `.post-card-title a:hover` 挪到 `.post-card:hover .post-card-title a`——覆盖层盖住了标题，指针碰不到那个 `<a>`，原规则永不触发，挪到卡片上后"停哪都亮"反成了整卡可点的提示。两个代价已记入 §7.7：文字不再可选中；卡内日后新增的可点元素须 `position: relative` + `z-index: 2` 抬到覆盖层之上 |
| 2026-10-06 | v3.31 | 文章卡片支持**置顶角标**（§7.7）：front matter `pinned: true` → `.post-card-badge`，白底圆角矩形 + `mdi-thumb-up-outline` +"置顶"（MDI 7.4.47 里竖大拇指有 `mdi-thumb-up` / `-outline` 两档，取 outline 与元信息行同语言），贴在封面**外侧上角**（非交替卡左上、交替卡镜像到右上）——斜切那一刀切的是靠文字列的**内侧角**，外侧上角才是完整直角，要贴边只能贴它；`top: 0` + `left: 0`（交替卡 `right: 0; left: auto`）贴到卡片边缘，只圆外露的内侧角（`0 0 var(--radius-md) 0`，交替卡镜像），与卡片圆角重合那角由 `overflow` 裁圆、贴边两角与卡片边缘共线；**故意不设 `z-index`**——该值 `auto` 让它压在封面之上、覆盖层（`z-index: 1`）之下，点角标照样开文章，给了 2 反而会造出一块点不动的死区；新增令牌 `--badge-bg` / `--badge-fg` 定义在 `:root` **不进 dark-tokens**（角标坐在照片上而非页面底色上，跟主题翻色会在亮/深封面上糊掉，同 `--color-over-hero`；`--badge-fg` 也不能图省事用 `--color-text`，暗色下那是浅色、白底浅字看不见）；模板里"置顶"二字**留在可访问性树里**（内容是，不是装饰），只摘图标；archetype 补 `pinned` 注释占位；**排序未做**——Hugo v0.165.0 无 `.ByPinned`，置顶排到最前是另一件事，见 §7.7 末段 |
