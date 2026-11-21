---
title: "你好，世界"
date: 2026-10-03T21:00:00+08:00
draft: false
categories: ["随笔"]
tags: ["随笔", "Hugo"]
summary: "第一篇示例文章，用来验证 inaline-theme 的文章页渲染效果。"
---

这是 `inaline-theme` 的第一篇示例文章。你可以用它确认标题、日期、标签和正文排版是否符合预期。

## Markdown 基本元素

这是一段普通正文。中文排版下建议保持较大的行高，阅读更舒适。

### 列表

- 无序列表项一
- 无序列表项二

1. 有序列表项一
2. 有序列表项二

### 引用

> 引用块适合放一些补充说明，或者摘录。

### 代码

行内代码：`hugo server -D`

代码块：

```go
package main

import "fmt"

func main() {
	fmt.Println("你好，世界")
}
```

长代码块（超过 12 行会自动折叠，点窗口条右侧的「展开」查看全部）：

```go
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

type Post struct {
	Title string    `json:"title"`
	Date  time.Time `json:"date"`
}

func main() {
	posts := []Post{
		{Title: "你好，世界", Date: time.Now()},
		{Title: "Hugo 目录结构", Date: time.Now()},
		{Title: "Markdown 语法", Date: time.Now()},
	}

	http.HandleFunc("/api/posts", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if err := json.NewEncoder(w).Encode(posts); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})

	log.Println("listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

### 表格

| 命令 | 说明 |
| --- | --- |
| `hugo server` | 启动本地预览 |
| `hugo` | 构建静态文件到 `public/` |

---

等设计文档定下来，我们再继续调整主题的视觉与功能。
