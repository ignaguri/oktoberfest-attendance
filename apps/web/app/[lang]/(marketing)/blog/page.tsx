import type { Metadata } from "next";

import { BlogIndexView } from "@/components/blog/BlogIndexView";
import { getAllPosts, getCategories } from "@/lib/blog";
import { blogIndexCopy } from "@/lib/marketing/seoCopy";
import { localeAlternates, marketingUrlAbsolute, toSupportedLanguage } from "@/lib/utils/marketingUrl";

export const revalidate = 3600;

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang: langParam } = await params;
  const lang = toSupportedLanguage(langParam);
  const copy = blogIndexCopy(lang);

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: marketingUrlAbsolute("/blog", lang),
      languages: localeAlternates("/blog"),
    },
  };
}

export default async function BlogIndex({ params }: { params: Promise<Params> }) {
  const { lang: langParam } = await params;
  const lang = toSupportedLanguage(langParam);
  const posts = await getAllPosts(lang);
  const categories = await getCategories();

  return <BlogIndexView posts={posts} categories={categories} locale={lang} />;
}
