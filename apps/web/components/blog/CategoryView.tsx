import type { SupportedLanguage } from "@prostcounter/shared/i18n";

import type { BlogCategory, BlogPostMeta } from "@/lib/blog";

import { ArticleCard } from "./ArticleCard";
import { localizeCategory } from "./blog-i18n";

const categoryDescriptions: Record<BlogCategory, Record<SupportedLanguage, string>> = {
  festivals: {
    en: "Guides and information about Munich beer festivals",
    de: "Guides und Informationen zu Münchner Bierfesten",
    es: "Guías e información sobre los festivales cerveceros de Múnich",
  },
  tips: {
    en: "Practical tips for your beer festival experience",
    de: "Praktische Tipps für dein Bierfest-Erlebnis",
    es: "Consejos prácticos para tu experiencia en el festival cervecero",
  },
  culture: {
    en: "Explore beer festival traditions and customs",
    de: "Entdecke Bierfest-Traditionen und Bräuche",
    es: "Descubre las tradiciones y costumbres de los festivales cerveceros",
  },
  news: {
    en: "Latest news about upcoming festivals and events",
    de: "Neuigkeiten über kommende Feste und Veranstaltungen",
    es: "Últimas noticias sobre próximos festivales y eventos",
  },
};

const emptyText: Record<SupportedLanguage, string> = {
  en: "No articles in this category yet. Check back soon!",
  de: "Noch keine Artikel in dieser Kategorie. Schau bald wieder vorbei!",
  es: "Aún no hay artículos en esta categoría. ¡Vuelve pronto!",
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
  const description = categoryDescriptions[category]?.[locale] ?? "";

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
          {posts.map((post) => (
            <ArticleCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
