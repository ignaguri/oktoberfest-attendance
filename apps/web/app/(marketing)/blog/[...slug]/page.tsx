import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { ArticleLayout } from "@/components/blog/ArticleLayout";
import { getMdxComponents } from "@/components/blog/MDXComponents";
import { JsonLd } from "@/components/seo/JsonLd";
import type { BlogLocale } from "@/lib/blog";
import {
  getAllPosts,
  getAvailableLocales,
  getPostBySlug,
  getPostSlugs,
} from "@/lib/blog";

export const revalidate = 3600;

const VALID_LOCALES: BlogLocale[] = ["de", "es"];

type Params = { slug: string[] };

function parseParams(slugParts: string[]): {
  locale: BlogLocale;
  slug: string;
} | null {
  if (slugParts.length === 1) {
    // /blog/[slug] — English article
    return { locale: "en", slug: slugParts[0] };
  }
  if (
    slugParts.length === 2 &&
    VALID_LOCALES.includes(slugParts[0] as BlogLocale)
  ) {
    // /blog/de/[slug] or /blog/es/[slug]
    return { locale: slugParts[0] as BlogLocale, slug: slugParts[1] };
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

  // Localized articles: /blog/de/[slug], /blog/es/[slug]
  for (const locale of VALID_LOCALES) {
    const posts = await getAllPosts(locale);
    for (const post of posts) {
      params.push({ slug: [locale, post.slug] });
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

  const { locale, slug } = parsed;
  const post = await getPostBySlug(slug, locale);
  if (!post) return {};

  const availableLocales = await getAvailableLocales(slug);

  const alternates: Record<string, string> = {};
  for (const loc of availableLocales) {
    if (loc === "en") {
      alternates[loc] = `https://prostcounter.fun/blog/${slug}`;
    } else {
      alternates[loc] = `https://prostcounter.fun/blog/${loc}/${slug}`;
    }
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
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `https://prostcounter.fun${canonicalPath}`,
      languages: alternates,
    },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug: slugParts } = await params;
  const parsed = parseParams(slugParts);

  if (!parsed) {
    notFound();
  }

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
    author: {
      "@type": "Person",
      name: post.author,
    },
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
      <ArticleLayout post={post} availableLocales={availableLocales}>
        {content}
      </ArticleLayout>
    </>
  );
}
