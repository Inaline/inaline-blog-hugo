# Inaline's Blog

[简体中文](README.md) | English

This repository is the GitHub backup of [Inaline](https://inaline.net)'s personal blog. It holds the Hugo source for the site and serves as a backup and version-control copy.

## Sites

The blog is deployed to three nodes. All of them serve the same content, so you can use whichever is closest to you:

| Node | URL |
| --- | --- |
| Hong Kong cloud server | <https://inaline.net> |
| GitHub Pages | <https://inaline.github.io> |
| Cloudflare Pages | <https://inaline-blog.pages.dev> |

## Related

- Theme: [hugo-theme-inaline](https://github.com/Inaline/hugo-theme-inaline)

## Requirements

| Dependency | Version |
| --- | --- |
| [Hugo](https://gohugo.io/) | v0.165.0 (extended) |
| [Go](https://go.dev/) | 1.24.4 |

Building requires the extended edition of Hugo. Older versions may fail to build.

## Local development

```bash
git clone git@github.com:Inaline/inaline-blog-hugo.git
cd inaline-blog-hugo
hugo server
```

The site is then available at <http://localhost:1313/>.

To render the static files into `public/`:

```bash
hugo --minify
```

## License

Released under the [MIT License](LICENSE).
