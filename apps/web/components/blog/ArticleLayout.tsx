import type { SupportedLanguage } from "@prostcounter/shared/i18n";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import { Link } from "next-view-transitions";

import type { BlogPost } from "@/lib/blog";

import { categoryColors, dateLocaleMap, localizeCategory, localizeTag } from "./blog-i18n";

const uiTranslations: Record<SupportedLanguage, { backToBlog: string; minRead: string }> = {
  en: { backToBlog: "Back to Blog", minRead: "min read" },
  de: { backToBlog: "Zurück zum Blog", minRead: "Min. Lesezeit" },
  es: { backToBlog: "Volver al Blog", minRead: "min de lectura" },
};

export function ArticleLayout({ post, children }: { post: BlogPost; children: React.ReactNode }) {
  const locale = post.locale || "en";
  const t = uiTranslations[locale];
  const dateFmtLocale = dateLocaleMap[locale];

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Back link */}
      <Link
        href={post.locale === "en" ? "/blog" : `/blog/${post.locale}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} />
        {t.backToBlog}
      </Link>

      {/* Header */}
      <header className="mb-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${categoryColors[post.category] || "bg-gray-100 text-gray-800"}`}
          >
            {localizeCategory(post.category, locale)}
          </span>
          {post.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
            >
              {localizeTag(tag, locale)}
            </span>
          ))}
        </div>

        <h1 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          {post.title}
        </h1>

        <p className="mb-6 text-lg text-gray-500">{post.description}</p>

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <User size={14} />
            {post.author}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar size={14} />
            {new Date(post.date).toLocaleDateString(dateFmtLocale, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={14} />
            {post.readingTime} {t.minRead}
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="prose-custom">{children}</div>
    </article>
  );
}
