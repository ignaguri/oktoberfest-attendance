import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";

import { ArticleLayout } from "@/components/blog/ArticleLayout";
import { mdxComponents } from "@/components/blog/MDXComponents";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAvailableLocales, getPostBySlug, getPostSlugs } from "@/lib/blog";

export const revalidate = 3600;

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const slugs = await getPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug, "en");
  if (!post) return {};

  const availableLocales = await getAvailableLocales(slug);

  const alternates: Record<string, string> = {};
  for (const locale of availableLocales) {
    if (locale === "en") {
      alternates[locale] = `https://prostcounter.fun/blog/${slug}`;
    } else {
      alternates[locale] = `https://prostcounter.fun/blog/${locale}/${slug}`;
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
      canonical: `https://prostcounter.fun/blog/${slug}`,
      languages: alternates,
    },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug, "en");

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
      "@id": `https://prostcounter.fun/blog/${slug}`,
    },
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
