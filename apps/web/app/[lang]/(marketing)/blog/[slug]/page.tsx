import { PROD_URL } from "@prostcounter/shared/constants";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { ArticleLayout } from "@/components/blog/ArticleLayout";
import { getMdxComponents } from "@/components/blog/MDXComponents";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAllPosts, getAvailableLocales, getPostBySlug } from "@/lib/blog";
import { localeAlternates, marketingUrlAbsolute, toSupportedLanguage } from "@/lib/utils/marketingUrl";

export const revalidate = 3600;

type Params = { lang: string; slug: string };

export async function generateStaticParams({
  params,
}: {
  params: { lang: string };
}): Promise<{ slug: string }[]> {
  const posts = await getAllPosts(toSupportedLanguage(params.lang));
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang: langParam, slug } = await params;
  const lang = toSupportedLanguage(langParam);
  const post = await getPostBySlug(slug, lang);
  if (!post) return {};

  // Only advertise the locales this article was actually translated into, so
  // hreflang never points at a URL that 404s.
  const availableLocales = await getAvailableLocales(slug);

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
      ...(lang !== "en" && {
        locale: lang === "de" ? "de_DE" : "es_ES",
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
      canonical: marketingUrlAbsolute(`/blog/${slug}`, lang),
      languages: localeAlternates(`/blog/${slug}`, availableLocales),
    },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<Params> }) {
  const { lang: langParam, slug } = await params;
  const lang = toSupportedLanguage(langParam);
  const post = await getPostBySlug(slug, lang);

  if (!post) {
    notFound();
  }

  const { content } = await compileMDX({
    source: post.content,
    components: getMdxComponents(lang),
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
      },
    },
  });

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: `${PROD_URL}/api/og?title=${encodeURIComponent(post.title)}&category=${post.category}`,
    datePublished: post.date,
    dateModified: post.lastModified,
    author: { "@type": "Person", name: post.author },
    publisher: {
      "@type": "Organization",
      name: "ProstCounter",
      logo: {
        "@type": "ImageObject",
        url: `${PROD_URL}/android-chrome-512x512.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": marketingUrlAbsolute(`/blog/${slug}`, lang),
    },
    ...(lang !== "en" && { inLanguage: lang }),
  };

  return (
    <>
      <JsonLd data={articleJsonLd} />
      <ArticleLayout post={post}>{content}</ArticleLayout>
    </>
  );
}
