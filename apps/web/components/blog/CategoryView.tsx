import type { SupportedLanguage } from "@prostcounter/shared/i18n";

import type { BlogCategory, BlogPostMeta } from "@/lib/blog";

import { ArticleCard } from "./ArticleCard";
import { localizeCategory, localizeCategoryDescription } from "./blog-i18n";

const emptyText: Record<SupportedLanguage, string> = {
  en: "No articles in this category yet. Check back soon!",
  de: "Noch keine Artikel in dieser Kategorie. Schau bald wieder vorbei!",
  es: "Aún no hay artículos en esta categoría. ¡Volvé pronto!",
};

export function CategoryView({
  category,
  posts,
  locale,
}: {
  category: BlogCategory;
  posts: BlogPostMeta[];
  locale: SupportedLanguage;
}) {
  const label = localizeCategory(category, locale);
  const description = localizeCategoryDescription(category, locale);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{label}</h1>
        <p className="mt-2 text-lg text-gray-500">{description}</p>
      </header>

      {posts.length === 0 ? (
        <p className="text-gray-500">{emptyText[locale]}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <ArticleCard key={post.slug} post={post} priority={index === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
