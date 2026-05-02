import { PROD_URL } from "@prostcounter/shared/constants";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CategoryView } from "@/components/blog/CategoryView";
import type { BlogCategory } from "@/lib/blog";
import { getCategories, getPostsByCategory, VALID_CATEGORIES } from "@/lib/blog";

export const revalidate = 3600;

type Params = { category: string };

export async function generateStaticParams(): Promise<Params[]> {
  const categories = await getCategories();
  return categories.map((category) => ({ category }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category } = await params;
  const label = category.charAt(0).toUpperCase() + category.slice(1);

  return {
    title: `${label} - ProstCounter Blog`,
    description: `${label} articles from ProstCounter`,
    alternates: {
      canonical: `${PROD_URL}/blog/category/${category}`,
      languages: {
        en: `${PROD_URL}/blog/category/${category}`,
        de: `${PROD_URL}/blog/de/category/${category}`,
        es: `${PROD_URL}/blog/es/category/${category}`,
      },
    },
  };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { category } = await params;

  if (!VALID_CATEGORIES.includes(category as BlogCategory)) {
    notFound();
  }

  const posts = await getPostsByCategory(category as BlogCategory, "en");

  return <CategoryView category={category as BlogCategory} posts={posts} locale="en" />;
}
