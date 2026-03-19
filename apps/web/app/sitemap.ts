import type { MetadataRoute } from "next";

import { getAllPosts } from "@/lib/blog";

const BASE_URL = "https://prostcounter.fun";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts("en");
  const dePosts = await getAllPosts("de");
  const esPosts = await getAllPosts("es");

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/download`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/sign-in`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/sign-up`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.lastModified || post.date),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const deBlogRoutes: MetadataRoute.Sitemap = dePosts.map((post) => ({
    url: `${BASE_URL}/blog/de/${post.slug}`,
    lastModified: new Date(post.lastModified || post.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const esBlogRoutes: MetadataRoute.Sitemap = esPosts.map((post) => ({
    url: `${BASE_URL}/blog/es/${post.slug}`,
    lastModified: new Date(post.lastModified || post.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // Category pages
  const categories = ["festivals", "tips", "culture", "news"];
  const categoryRoutes: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${BASE_URL}/blog/category/${cat}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [
    ...staticRoutes,
    ...blogRoutes,
    ...deBlogRoutes,
    ...esBlogRoutes,
    ...categoryRoutes,
  ];
}
