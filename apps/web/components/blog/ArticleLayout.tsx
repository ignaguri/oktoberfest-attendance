import { ArrowLeft, Calendar, Clock, Globe, User } from "lucide-react";
import { Link } from "next-view-transitions";

import type { BlogLocale, BlogPost } from "@/lib/blog";

const categoryColors: Record<string, string> = {
  festivals: "bg-yellow-100 text-yellow-800",
  tips: "bg-blue-100 text-blue-800",
  culture: "bg-purple-100 text-purple-800",
  news: "bg-green-100 text-green-800",
};

const localeNames: Record<BlogLocale, string> = {
  en: "English",
  de: "Deutsch",
  es: "Español",
};

export function ArticleLayout({
  post,
  availableLocales,
  children,
}: {
  post: BlogPost;
  availableLocales: BlogLocale[];
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Back link */}
      <Link
        href="/blog"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} />
        Back to Blog
      </Link>

      {/* Header */}
      <header className="mb-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${categoryColors[post.category] || "bg-gray-100 text-gray-800"}`}
          >
            {post.category}
          </span>
          {post.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
            >
              {tag}
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
            {new Date(post.date).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={14} />
            {post.readingTime} min read
          </span>
        </div>

        {/* Language switcher */}
        {availableLocales.length > 1 && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <Globe size={14} className="text-gray-400" />
            {availableLocales.map((locale) => {
              const href =
                locale === "en"
                  ? `/blog/${post.slug}`
                  : `/blog/${locale}/${post.slug}`;
              const isActive = locale === post.locale;
              return (
                <Link
                  key={locale}
                  href={href}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-yellow-100 text-yellow-800"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  {localeNames[locale]}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Content */}
      <div className="prose-custom">{children}</div>
    </article>
  );
}
