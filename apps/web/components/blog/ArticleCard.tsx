import { Calendar, Clock } from "lucide-react";
import Image from "next/image";
import { Link } from "next-view-transitions";

import type { BlogPostMeta } from "@/lib/blog";

import { categoryColors, dateLocaleMap, localizeCategory } from "./blog-i18n";

const minReadMap = {
  en: "min read",
  de: "Min.",
  es: "min",
} as const;

export function ArticleCard({ post }: { post: BlogPostMeta }) {
  const href = post.locale === "en" ? `/blog/${post.slug}` : `/blog/${post.locale}/${post.slug}`;

  return (
    <Link href={href} className="group block">
      <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
          <Image
            src={post.featuredImage}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
        <div className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryColors[post.category] || "bg-gray-100 text-gray-800"}`}
            >
              {localizeCategory(post.category, post.locale)}
            </span>
          </div>
          <h2 className="mb-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-yellow-600">
            {post.title}
          </h2>
          <p className="mb-3 line-clamp-2 text-sm text-gray-500">{post.description}</p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {new Date(post.date).toLocaleDateString(dateLocaleMap[post.locale] || "en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {post.readingTime} {minReadMap[post.locale] || "min read"}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
