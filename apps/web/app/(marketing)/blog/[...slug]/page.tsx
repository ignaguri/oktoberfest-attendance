import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { ArticleLayout } from "@/components/blog/ArticleLayout";
import { BlogIndexView } from "@/components/blog/BlogIndexView";
import { CategoryView } from "@/components/blog/CategoryView";
import { getMdxComponents } from "@/components/blog/MDXComponents";
import { JsonLd } from "@/components/seo/JsonLd";
import type { BlogCategory, BlogLocale } from "@/lib/blog";
import {
  getAllPosts,
  getAvailableLocales,
  getCategories,
  getPostBySlug,
  getPostsByCategory,
  getPostSlugs,
} from "@/lib/blog";

export const revalidate = 3600;

const VALID_LOCALES: BlogLocale[] = ["de", "es"];
const VALID_CATEGORIES: BlogCategory[] = [
  "festivals",
  "tips",
  "culture",
  "news",
];

type ParsedRoute =
  | { type: "article"; locale: BlogLocale; slug: string }
  | { type: "index"; locale: BlogLocale }
  | { type: "category"; locale: BlogLocale; category: BlogCategory };

type Params = { slug: string[] };

function parseParams(slugParts: string[]): ParsedRoute | null {
  // /blog/[slug] — English article
  if (
    slugParts.length === 1 &&
    !VALID_LOCALES.includes(slugParts[0] as BlogLocale)
  ) {
    return { type: "article", locale: "en", slug: slugParts[0] };
  }

  // /blog/de or /blog/es — Localized blog index
  if (
    slugParts.length === 1 &&
    VALID_LOCALES.includes(slugParts[0] as BlogLocale)
  ) {
    return { type: "index", locale: slugParts[0] as BlogLocale };
  }

  // /blog/de/[slug] or /blog/es/[slug] — Localized article
  if (
    slugParts.length === 2 &&
    VALID_LOCALES.includes(slugParts[0] as BlogLocale)
  ) {
    // Check if it's a category route: /blog/de/category
    if (slugParts[1] === "category") {
      return null; // /blog/de/category without a category name
    }
    return {
      type: "article",
      locale: slugParts[0] as BlogLocale,
      slug: slugParts[1],
    };
  }

  // /blog/de/category/[cat] or /blog/es/category/[cat] — Localized category
  if (
    slugParts.length === 3 &&
    VALID_LOCALES.includes(slugParts[0] as BlogLocale) &&
    slugParts[1] === "category" &&
    VALID_CATEGORIES.includes(slugParts[2] as BlogCategory)
  ) {
    return {
      type: "category",
      locale: slugParts[0] as BlogLocale,
      category: slugParts[2] as BlogCategory,
    };
  }

  return null;
}

export async function generateStaticParams(): Promise<Params[]> {
  const params: Params[] = [];

  // English articles: /blog/[slug]
  const enSlugs = await getPostSlugs();
  for (const slug of enSlugs) {
    params.push({ slug: [slug] });
  }

  for (const locale of VALID_LOCALES) {
    // Localized blog index: /blog/de, /blog/es
    params.push({ slug: [locale] });

    // Localized articles: /blog/de/[slug], /blog/es/[slug]
    const posts = await getAllPosts(locale);
    for (const post of posts) {
      params.push({ slug: [locale, post.slug] });
    }

    // Localized categories: /blog/de/category/[cat], /blog/es/category/[cat]
    for (const cat of VALID_CATEGORIES) {
      params.push({ slug: [locale, "category", cat] });
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug: slugParts } = await params;
  const parsed = parseParams(slugParts);
  if (!parsed) return {};

  if (parsed.type === "index") {
    return {
      title: "Blog - ProstCounter",
      description:
        "Guides, tips, and news about Oktoberfest, Munich beer festivals, and the ProstCounter app.",
      alternates: {
        canonical: `https://prostcounter.fun/blog/${parsed.locale}`,
        languages: {
          en: "https://prostcounter.fun/blog",
          de: "https://prostcounter.fun/blog/de",
          es: "https://prostcounter.fun/blog/es",
        },
      },
    };
  }

  if (parsed.type === "category") {
    const label =
      parsed.category.charAt(0).toUpperCase() + parsed.category.slice(1);
    return {
      title: `${label} - ProstCounter Blog`,
      description: `${label} articles from ProstCounter`,
      alternates: {
        canonical: `https://prostcounter.fun/blog/${parsed.locale}/category/${parsed.category}`,
        languages: {
          en: `https://prostcounter.fun/blog/category/${parsed.category}`,
          de: `https://prostcounter.fun/blog/de/category/${parsed.category}`,
          es: `https://prostcounter.fun/blog/es/category/${parsed.category}`,
        },
      },
    };
  }

  // Article
  const { locale, slug } = parsed;
  const post = await getPostBySlug(slug, locale);
  if (!post) return {};

  const availableLocales = await getAvailableLocales(slug);
  const alternates: Record<string, string> = {};
  for (const loc of availableLocales) {
    alternates[loc] =
      loc === "en"
        ? `https://prostcounter.fun/blog/${slug}`
        : `https://prostcounter.fun/blog/${loc}/${slug}`;
  }

  const canonicalPath =
    locale === "en" ? `/blog/${slug}` : `/blog/${locale}/${slug}`;

  return {
    title: `${post.title} - ProstCounter Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.lastModified,
      authors: [post.author],
      ...(locale !== "en" && {
        locale: locale === "de" ? "de_DE" : "es_ES",
      }),
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(post.title)}&category=${post.category}`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    robots: { index: true, follow: true },
    alternates: {
      canonical: `https://prostcounter.fun${canonicalPath}`,
      languages: alternates,
    },
  };
}

export default async function BlogCatchAllPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug: slugParts } = await params;
  const parsed = parseParams(slugParts);

  if (!parsed) {
    notFound();
  }

  // Localized blog index
  if (parsed.type === "index") {
    const posts = await getAllPosts(parsed.locale);
    const categories = await getCategories();
    return (
      <BlogIndexView
        posts={posts}
        categories={categories}
        locale={parsed.locale}
      />
    );
  }

  // Localized category page
  if (parsed.type === "category") {
    const posts = await getPostsByCategory(parsed.category, parsed.locale);
    return (
      <CategoryView
        category={parsed.category}
        posts={posts}
        locale={parsed.locale}
      />
    );
  }

  // Article page
  const { locale, slug } = parsed;
  const post = await getPostBySlug(slug, locale);

  if (!post) {
    notFound();
  }

  const availableLocales = await getAvailableLocales(slug);

  const { content } = await compileMDX({
    source: post.content,
    components: getMdxComponents(locale),
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
      },
    },
  });

  const canonicalPath =
    locale === "en" ? `/blog/${slug}` : `/blog/${locale}/${slug}`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: `https://prostcounter.fun/api/og?title=${encodeURIComponent(post.title)}&category=${post.category}`,
    datePublished: post.date,
    dateModified: post.lastModified,
    author: { "@type": "Person", name: post.author },
    publisher: {
      "@type": "Organization",
      name: "ProstCounter",
      logo: {
        "@type": "ImageObject",
        url: "https://prostcounter.fun/android-chrome-512x512.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://prostcounter.fun${canonicalPath}`,
    },
    ...(locale !== "en" && { inLanguage: locale }),
  };

  return (
    <>
      <JsonLd data={articleJsonLd} />
      <ArticleLayout post={post}>{content}</ArticleLayout>
    </>
  );
}
