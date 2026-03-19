import type { Metadata } from "next";

import { ArticleCard } from "@/components/blog/ArticleCard";
import { getAllPosts, getCategories } from "@/lib/blog";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Blog - ProstCounter",
  description:
    "Guides, tips, and news about Oktoberfest, Munich beer festivals, and the ProstCounter app.",
};

export default async function BlogIndex() {
  const posts = await getAllPosts("en");
  const categories = await getCategories();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Blog
        </h1>
        <p className="mt-2 text-lg text-gray-500">
          Your guide to Munich beer festivals, Oktoberfest tips, and more.
        </p>

        {/* Category filters */}
        <div className="mt-6 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <a
              key={cat}
              href={`/blog/category/${cat}`}
              className="rounded-full border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:border-yellow-300 hover:bg-yellow-50 hover:text-yellow-700"
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </a>
          ))}
        </div>
      </header>

      {posts.length === 0 ? (
        <p className="text-gray-500">No articles yet. Check back soon!</p>
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
