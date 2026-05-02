# Blog / Marketing Content

The web app has a file-based blog at `apps/web/content/blog/` using **MDX** (Markdown + JSX).

## Content Structure

```
apps/web/content/blog/
├── en/                    # English articles
├── de/                    # German translations
└── es/                    # Spanish translations
```

Each article is an `.mdx` file with YAML frontmatter. **All articles must exist in all 3 locales.**

## Writing a Blog Article

Frontmatter format:

```yaml
---
title: "Article Title"
description: "Short description for previews and SEO"
date: "2026-04-09"
lastModified: "2026-04-09"
author: "ProstCounter Team"
category: "festivals" # festivals | tips | culture | news
tags: ["oktoberfest", "2026", "guide"]
featuredImage: "/images/prost-counter-og-1.jpg"
locale: "en" # en | de | es
---
```

## Available MDX Components

- **`<CTA />`** - Call-to-action box for the ProstCounter app (app store links + sign-up button). Include at the end of every article.
- **`<DownloadButtons />`** - Download button group for app distribution
- **`<AppScreenshot src="" alt="" caption="" />`** - Responsive image with caption
- **`<FestivalInfo name="" dates="" location="" description="" />`** - Festival info card with icons

## Blog Utilities

- `apps/web/lib/blog.ts` - `getAllPosts()`, `getPostBySlug()`, `getPostsByCategory()`, etc.
- `apps/web/components/blog/` - `ArticleLayout`, `BlogIndexView`, `ArticleCard`, `CategoryView`, `MDXComponents`

## Blog Routes

- `/blog` - English index
- `/blog/[slug]` - English article
- `/blog/de/[slug]` - German article
- `/blog/es/[slug]` - Spanish article
- `/blog/category/[category]` - Category page (supports locale prefixes too)
