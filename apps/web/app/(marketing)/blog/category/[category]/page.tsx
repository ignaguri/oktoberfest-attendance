import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleCard } from "@/components/blog/ArticleCard";
import type { BlogCategory } from "@/lib/blog";
import { getCategories, getPostsByCategory } from "@/lib/blog";

export const revalidate = 3600;

const VALID_CATEGORIES: BlogCategory[] = [
  "festivals",
  "tips",
  "culture",
  "news",
];

const categoryDescriptions: Record<BlogCategory, string> = {
  festivals: "Guides and information about Munich beer festivals",
  tips: "Practical tips for your beer festival experience",
  culture: "Explore beer festival traditions and customs",
  news: "Latest news about upcoming festivals and events",
};

type Params = { category: string };

export async function generateStaticParams(): Promise<Params[]> {
  const categories = await getCategories();
  return categories.map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { category } = await params;
  const label = category.charAt(0).toUpperCase() + category.slice(1);

  return {
    title: `${label} - ProstCounter Blog`,
    description:
      categoryDescriptions[category as BlogCategory] ||
      `${label} articles from ProstCounter`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { category } = await params;

  if (!VALID_CATEGORIES.includes(category as BlogCategory)) {
    notFound();
  }

  const posts = await getPostsByCategory(category as BlogCategory, "en");
  const label = category.charAt(0).toUpperCase() + category.slice(1);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          {label}
        </h1>
        <p className="mt-2 text-lg text-gray-500">
          {categoryDescriptions[category as BlogCategory]}
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-gray-500">
          No articles in this category yet. Check back soon!
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <ArticleCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
