---
title: "CommonMark 语法演示"
date: 2026-11-15T09:00:00+08:00
draft: false
categories: ["技术"]
tags: ["Markdown", "CommonMark", "排版"]
summary: "用一篇文章覆盖 CommonMark 常用语法，并附带 Goldmark 的表格、脚注、任务列表等扩展，作为文章页排版与组件的视觉样本。"
cover: "images/cover/cover2.jpg"
---

这是一篇用于文章页 UI 设计的排版样本。下面每个小节展示一类 Markdown 语法，页面中看到的样式就是当前主题的实际渲染结果。

> 严格来说，表格、删除线、任务列表、脚注和定义列表属于 GFM / Goldmark 扩展，不属于 CommonMark 核心语法；这里一并收录，方便之后统一设计样式。

## 标题

正文从二级标题开始，一级标题留给文章标题本身。

### 三级标题

#### 四级标题

##### 五级标题

###### 六级标题

Setext 写法（用下划线表示标题层级，只能表示一级和二级）：

Setext 二级标题
----------------

```markdown
Setext 一级标题
==============

Setext 二级标题
--------------
```

## 段落与换行

这是第一段。段落之间用空行分隔。

这是第二段，其中的这一行
会和下一行合并成同一段，渲染时只留一个空格。

这一行以反斜杠结尾，强制换行。\
这是换行后的第一行。

这一行以两个空格结尾，同样强制换行。  
这是换行后的第二行。

这是一个很长的中文段落，用来观察正文的行高、字距、段间距，以及标点符号在行首行尾的处理。中文排版通常需要比西文更大的行高，段落之间也不宜贴得太紧；否则长文阅读时眼睛容易在同一行里来回跳。你可以把它当作一段普通的博客正文，看看连续阅读十几行之后是否仍然舒适。

## 强调与删除线

*斜体*、_斜体_、**粗体**、__粗体__、***粗斜体***、___粗斜体___。

嵌套写法：**粗体里放 *斜体*，再放一段 `行内代码`，最后回到粗体**。

词内部的 underscores 不会触发强调：foo_bar_baz。

删除线写法：~~这一行会被划掉~~（Goldmark 扩展）。

## 链接

[行内链接](https://commonmark.org/)，[带标题的链接](https://commonmark.org/ "CommonMark 官网")。

引用式链接：[CommonMark 规范][cm]，以及[快捷引用][]。

自动链接：<https://commonmark.org/>。

邮箱自动链接：<mail@example.com>。

裸 URL（当前未开启 linkify，因此保持纯文本）：https://example.com/path?from=commonmark-demo

带格式的链接：[**加粗链接** 和 `行内代码`](https://example.com/)。

站内链接：[回到首页](/)。

[cm]: https://spec.commonmark.org/ "CommonMark Spec"
[快捷引用]: https://commonmark.org/

## 图片

行内图片（作为段落的一部分）：![封面小图](/images/cover/cover1.jpg "cover1.jpg")，图片会跟随文字基线排列。

独立成段的图片：

![封面图示例](/images/cover/cover2.jpg "cover2.jpg")

引用式图片：

![另一张封面][cover-img]

[cover-img]: /images/cover/cover3.jpg "cover3.jpg"

## 列表

### 无序列表

- 无序列表项一
- 无序列表项二
  - 嵌套项目 A
  - 嵌套项目 B
    - 第三层项目
- 无序列表项三

也可以换用 `+` 或 `*` 作为标记：

+ 加号标记
+ 第二项

* 星号标记
* 第二项

### 有序列表

1. 第一项
2. 第二项
3. 第三项

序号不必连续，渲染结果会自动编号：

1. 第一项
1. 第二项
1. 第三项

从指定数字开始：

5. 第五项
6. 第六项
7. 第七项

### 松散列表与多段落

- 松散列表项一

- 松散列表项二，与上一项之间隔了一个空行。

- 松散列表项三。

同一个列表项里放多个段落：

- 这是列表项的第一段。

  这是第二段，仍然属于同一个列表项。

  这是第三段。

### 列表中的代码块

- 列表项中的 fenced code：

  ```js
  const answer = 42;
  console.log(`答案是 ${answer}`);
  ```

  代码块之后的说明文字。

- 第二个列表项。

### 任务列表

- [x] 已完成的任务
- [x] 另一个已完成的任务
- [ ] 尚未完成的任务
- [ ] 需要确认的任务

## 引用

> 这是一段普通引用。
> 引用里可以放**强调**、`行内代码`和[链接](https://example.com/)。

> 引用中的列表：
>
> - 第一项
> - 第二项
>   - 嵌套项

> 引用中的代码块：
>
> ```js
> const inQuote = true;
> ```

### 嵌套引用

> 一级引用
>
> > 二级引用
> >
> > > 三级引用
> >
> > 回到二级

### 引用中的标题

> ### 引用里的三级标题
>
> 标题也可以出现在引用块中。

## 代码

行内代码：`const x = 1;`。

用双反引号包裹包含反引号的代码：`` const tick = `value`; ``。

JavaScript：

```js
function greet(name) {
  return `Hello, ${name}!`;
}

console.log(greet('CommonMark'));
```

CSS：

```css
.post-content {
  line-height: 1.75;
  word-break: break-word;
}
```

Python：

~~~python
def hello():
    print("hello, commonmark")

hello()
~~~

纯文本：

```text
这是一个没有语法高亮的代码块。
它用来观察代码块的基础样式：背景、内边距、圆角和滚动条。
```

缩进代码块（四个空格）：

    <div class="indented">
      缩进式代码块，不指定语言。
    </div>

超长代码行（用来测试横向滚动）：

```js
const veryLongLine = "CommonMark 语法演示：这一行故意写得很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长，用来观察代码块在小屏幕上是否出现横向滚动条，以及滚动条本身的样式。";
```

### 长代码块（自动折叠）

超过 12 行的代码块会默认收起，点窗口条右侧的「展开」查看全部：

```js
// 一个用于演示长代码折叠的示例：把 Markdown 标题压平成目录
function buildToc(root) {
  const headings = root.querySelectorAll('h2, h3');
  const toc = document.createElement('ol');

  headings.forEach((heading) => {
    const item = document.createElement('li');
    const link = document.createElement('a');

    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    item.appendChild(link);

    if (heading.tagName === 'H3') {
      item.style.marginLeft = '1.5em';
    }

    toc.appendChild(item);
  });

  return toc;
}

const article = document.querySelector('.markdown');
const toc = buildToc(article);
document.querySelector('.article-toc')?.appendChild(toc);
```

## 表格

| 左对齐 | 居中 | 右对齐 |
| :--- | :---: | ---: |
| 普通文本 | 居中内容 | 128 |
| `行内代码` | **粗体** | 1024 |
| [链接](/posts/commonmark-syntax/) | ~~删除线~~ | 42 |

单元格里换行可以用原始 HTML：

| 项目 | 说明 |
| --- | --- |
| 标题 | 文章页标题使用一级标题<br>正文从二级标题开始 |
| 代码 | fenced code 支持语言标注<br>渲染时由 Chroma 高亮 |

宽表格（用来测试横向滚动）：

| 序号 | 语法 | 写法 | 渲染结果 | 备注 |
| ---: | --- | --- | --- | --- |
| 01 | 强调 | `*文字*` | *文字* | 单星号 |
| 02 | 粗体 | `**文字**` | **文字** | 双星号 |
| 03 | 删除线 | `~~文字~~` | ~~文字~~ | Goldmark 扩展 |
| 04 | 行内代码 | `` `代码` `` | `代码` | 反引号包裹 |
| 05 | 链接 | `[文字](url)` | [文字](https://example.com/) | 行内链接 |

## 数学公式

下面的公式由 Hugo 在构建时渲染为 MathML，不依赖前端脚本。

行内公式：$E = mc^2$。

一元二次方程求根公式：

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$

傅里叶变换公式：

$$
F(\omega) = \int_{-\infty}^{\infty} f(t)\, e^{-i\omega t} \, dt
$$

## 脚注

正文里可以插入脚注[^1]，也可以给脚注起一个更有语义的名字[^note]。

[^1]: 这是第一个脚注的内容。

[^note]: 这是第二个脚注，里面可以放**强调**、`行内代码`和[链接](https://example.com/)。

## 定义列表

CommonMark
: 一种标准化的 Markdown 语法规范。

Goldmark
: Hugo 默认使用的 Markdown 渲染器，通过扩展支持表格、脚注等语法。
: 也可以通过配置调整渲染行为。

## 原始 HTML

原始 HTML 块可以渲染（站点已开启 `goldmark.renderer.unsafe`）：

<div class="demo-note">
  <p>这是一个原始 HTML 块，可以用来测试提示框、卡片之类的内嵌组件。</p>
</div>

行内 HTML：按下 <kbd>Ctrl</kbd> + <kbd>C</kbd> 复制，<mark>这段文字被高亮</mark>，H<sub>2</sub>O，x<sup>2</sup>，<abbr title="HyperText Markup Language">HTML</abbr>。

折叠块：

<details>
  <summary>点击展开</summary>
  <p>折叠内容，包含 <strong>HTML 粗体</strong>与 <a href="https://example.com/">链接</a>。</p>
</details>

用 HTML 写的图文块：

<figure>
  <img src="/images/cover/cover3.jpg" alt="封面图示例">
  <figcaption>图注：这是一张用原始 HTML 包起来的封面图。</figcaption>
</figure>

## 转义字符与实体

转义字符：\*不是斜体\*，\_不是强调\_，\# 不是标题，\[不是链接\]，\\ 是反斜杠。

实体引用：&copy; &amp; &lt; &gt; &quot; &#169; &#x2764;

代码里的实体不会被解析：`&copy;`。

## 分割线

上面是一段文字。

---

上面是一条分割线。

***

上面是另一种写法的分割线。

___

上面是第三种写法的分割线。

## 排版压力测试

### 长单词与长链接

SupercalifragilisticexpialidociousPneumonoultramicroscopicsilicovolcanoconiosis

<https://example.com/a/very/long/path/with/many-segments?query=commonmark&sort=descending&page=2>

### 深层嵌套列表

- 第一层
  - 第二层
    - 第三层
      - 第四层
        - 第五层
          - 第六层，用来观察每一层的缩进和对齐

### 长引用

> 这是一段故意写得很长的引用文字，用来观察引用块在长文本、窄容器和多行情况下的左边框、内边距、行高以及和后续段落的间距。引用结束之后应该还有足够的留白，不能和下一段粘在一起。

### 连续行内元素

**粗体**、*斜体*、`代码`、[链接](https://example.com/)、~~删除线~~、<mark>高亮</mark>、<kbd>Ctrl</kbd>、H<sub>2</sub>O、x<sup>2</sup> 连续排在同一行里，观察行内元素的基线、间距和换行表现。

文章到此结束。
