import { PROD_URL } from "@prostcounter/shared/constants";
import type { Metadata } from "next";

import { BlogIndexView } from "@/components/blog/BlogIndexView";
import { getAllPosts, getCategories } from "@/lib/blog";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Blog - ProstCounter",
  description:
    "Guides, tips, and news about Oktoberfest, Munich beer festivals, and the ProstCounter app.",
  alternates: {
    canonical: `${PROD_URL}/blog`,
    languages: {
      en: `${PROD_URL}/blog`,
      de: `${PROD_URL}/blog/de`,
      es: `${PROD_URL}/blog/es`,
    },
  },
};

export default async function BlogIndex() {
  const posts = await getAllPosts("en");
  const categories = await getCategories();

  return <BlogIndexView posts={posts} categories={categories} locale="en" />;
}
