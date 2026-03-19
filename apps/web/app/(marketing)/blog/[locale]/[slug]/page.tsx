import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";

import { ArticleLayout } from "@/components/blog/ArticleLayout";
import { mdxComponents } from "@/components/blog/MDXComponents";
import { JsonLd } from "@/components/seo/JsonLd";
import type { BlogLocale } from "@/lib/blog";
import { getAllPosts, getAvailableLocales, getPostBySlug } from "@/lib/blog";

export const revalidate = 3600;

const VALID_LOCALES: BlogLocale[] = ["de", "es"];

type Params = { locale: string; slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const params: Params[] = [];

  for (const locale of VALID_LOCALES) {
    const posts = await getAllPosts(locale);
    for (const post of posts) {
      params.push({ locale, slug: post.slug });
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!VALID_LOCALES.includes(locale as BlogLocale)) return {};

  const post = await getPostBySlug(slug, locale as BlogLocale);
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
      locale: locale === "de" ? "de_DE" : "es_ES",
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(post.title)}&category=${post.category}`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    alternates: {
      canonical: `https://prostcounter.fun/blog/${locale}/${slug}`,
      languages: alternates,
    },
  };
}

export default async function LocalizedBlogArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, slug } = await params;

  if (!VALID_LOCALES.includes(locale as BlogLocale)) {
    notFound();
  }

  const post = await getPostBySlug(slug, locale as BlogLocale);
  if (!post) {
    notFound();
  }

  const availableLocales = await getAvailableLocales(slug);

  const { content } = await compileMDX({
    source: post.content,
    components: mdxComponents,
    options: {
      mdxOptions: {
        rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
      },
    },
  });

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
      "@id": `https://prostcounter.fun/blog/${locale}/${slug}`,
    },
    inLanguage: locale === "de" ? "de" : "es",
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
