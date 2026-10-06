---
title: "Hugo 目录结构速览"
date: 2026-10-03T22:00:00+08:00
draft: false
tags: ["Hugo"]
summary: "记录这个项目当前的目录结构，方便后续维护主题与内容。"
---

当前项目采用标准 Hugo 站点结构，主题独立放在 `themes/inaline-theme`：

```text
.
├── archetypes/          # 新建内容时的 front matter 模板
├── assets/              # 站点级资源（可被 resources.Get 处理）
├── content/             # 文章与页面
│   ├── posts/           # 博客文章
│   └── about.md         # 关于页面
├── layouts/             # 站点级模板（可覆盖主题）
├── static/              # 原样拷贝的静态文件
├── themes/
│   └── inaline-theme/   # 主题：模板 + 样式 + archetype
└── hugo.toml            # 站点配置
```

## 主题内部分

```text
themes/inaline-theme/
├── archetypes/default.md
├── assets/css/main.css
├── layouts/
│   ├── baseof.html      # HTML 骨架
│   ├── home.html        # 首页
│   ├── section.html     # 栏目列表（如 /posts/）
│   ├── page.html        # 单篇文章
│   ├── taxonomy.html    # 分类法列表（如 /tags/）
│   ├── term.html        # 单个词条（如 /tags/hugo/）
│   └── partials/
│       ├── head.html
│       ├── header.html
│       ├── footer.html
│       └── post-card.html
└── theme.toml
```

后续如果需要覆盖主题里的某个模板，直接在站点根目录的 `layouts/` 下放同名文件即可，无需改动主题源码。
