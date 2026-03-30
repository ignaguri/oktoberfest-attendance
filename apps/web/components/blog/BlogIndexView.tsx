import type { SupportedLanguage } from "@prostcounter/shared/i18n";
import { Link } from "next-view-transitions";

import type { BlogCategory, BlogPostMeta } from "@/lib/blog";

import { ArticleCard } from "./ArticleCard";
import { localizeCategory } from "./blog-i18n";

const uiText: Record<SupportedLanguage, { subtitle: string; empty: string }> = {
  en: {
    subtitle:
      "Your guide to Munich beer festivals, Oktoberfest tips, and more.",
    empty: "No articles yet. Check back soon!",
  },
  de: {
    subtitle: "Dein Guide zu Münchner Bierfesten, Oktoberfest-Tipps und mehr.",
    empty: "Noch keine Artikel. Schau bald wieder vorbei!",
  },
  es: {
    subtitle:
      "Tu guía de festivales cerveceros de Múnich, consejos para el Oktoberfest y más.",
    empty: "Aún no hay artículos. ¡Vuelve pronto!",
  },
};

function categoryHref(cat: string, locale: SupportedLanguage): string {
  return locale === "en"
    ? `/blog/category/${cat}`
    : `/blog/${locale}/category/${cat}`;
}

export function BlogIndexView({
  posts,
  categories,
  locale,
}: {
  posts: BlogPostMeta[];
  categories: BlogCategory[];
  locale: SupportedLanguage;
}) {
  const t = uiText[locale];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Blog
        </h1>
        <p className="mt-2 text-lg text-gray-500">{t.subtitle}</p>

        {/* Category filters */}
        <div className="mt-6 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Link
              key={cat}
              href={categoryHref(cat, locale)}
              className="rounded-full border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:border-yellow-300 hover:bg-yellow-50 hover:text-yellow-700"
            >
              {localizeCategory(cat, locale)}
            </Link>
          ))}
        </div>
      </header>

      {posts.length === 0 ? (
        <p className="text-gray-500">{t.empty}</p>
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
