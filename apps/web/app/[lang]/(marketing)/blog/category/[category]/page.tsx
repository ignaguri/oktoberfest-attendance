import type { SupportedLanguage } from "@prostcounter/shared/i18n";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CategoryView } from "@/components/blog/CategoryView";
import type { BlogCategory } from "@/lib/blog";
import { getCategories, getPostsByCategory, VALID_CATEGORIES } from "@/lib/blog";
import { categoryCopy } from "@/lib/marketing/seoCopy";
import { localeAlternates, marketingUrlAbsolute, toSupportedLanguage } from "@/lib/utils/marketingUrl";

export const revalidate = 3600;

type Params = { lang: string; category: string };

export async function generateStaticParams(): Promise<{ category: string }[]> {
  const categories = await getCategories();
  return categories.map((category) => ({ category }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang: langParam, category } = await params;
  const lang = toSupportedLanguage(langParam);
  const copy = categoryCopy(lang, category as BlogCategory);

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: marketingUrlAbsolute(`/blog/category/${category}`, lang),
      languages: localeAlternates(`/blog/category/${category}`),
    },
  };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { lang: langParam, category } = await params;
  const lang = toSupportedLanguage(langParam);

  if (!VALID_CATEGORIES.includes(category as BlogCategory)) {
    notFound();
  }

  const posts = await getPostsByCategory(category as BlogCategory, lang);

  return <CategoryView category={category as BlogCategory} posts={posts} locale={lang} />;
}
