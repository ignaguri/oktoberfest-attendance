import type { Metadata } from "next";

import { BlogIndexView } from "@/components/blog/BlogIndexView";
import { getAllPosts, getCategories } from "@/lib/blog";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Blog - ProstCounter",
  description:
    "Guides, tips, and news about Oktoberfest, Munich beer festivals, and the ProstCounter app.",
  alternates: {
    canonical: "https://prostcounter.fun/blog",
    languages: {
      en: "https://prostcounter.fun/blog",
      de: "https://prostcounter.fun/blog/de",
      es: "https://prostcounter.fun/blog/es",
    },
  },
};

export default async function BlogIndex() {
  const posts = await getAllPosts("en");
  const categories = await getCategories();

  return <BlogIndexView posts={posts} categories={categories} locale="en" />;
}
