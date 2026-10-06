# Inaline 博客

简体中文 | [English](README.en.md)

这是 [Inaline](https://inaline.net) 个人博客的 GitHub 备份仓库，保存博客站点的 Hugo 源码，用于备份与版本管理。

## 博客地址

站点部署在三个节点上，内容一致，可就近访问：

| 节点 | 地址 |
| --- | --- |
| 香港轻量云服务器 | <https://inaline.net> |
| GitHub Pages | <https://inaline.github.io> |
| Cloudflare Pages | <https://inaline-blog.pages.dev> |

## 相关项目

- 主题：[hugo-theme-inaline](https://github.com/Inaline/hugo-theme-inaline)

## 环境要求

| 依赖 | 版本 |
| --- | --- |
| [Hugo](https://gohugo.io/) | v0.165.0（extended） |
| [Go](https://go.dev/) | 1.24.4 |

构建时 Hugo 需要 extended 版本；版本过低可能导致构建失败。

## 本地预览

```bash
git clone git@github.com:Inaline/inaline-blog-hugo.git
cd inaline-blog-hugo
hugo server
```

启动后访问 <http://localhost:1313/>。

生成静态文件到 `public/`：

```bash
hugo --minify
```

## 许可

本项目基于 [MIT 协议](LICENSE) 开源。
