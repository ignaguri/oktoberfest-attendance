import { PROD_URL } from "@prostcounter/shared/constants";
import type { MetadataRoute } from "next";

import { getAllPosts, VALID_CATEGORIES } from "@/lib/blog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts("en");
  const dePosts = await getAllPosts("de");
  const esPosts = await getAllPosts("es");

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: PROD_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${PROD_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${PROD_URL}/download`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${PROD_URL}/de`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${PROD_URL}/es`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${PROD_URL}/de/download`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${PROD_URL}/es/download`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${PROD_URL}/blog/de`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${PROD_URL}/blog/es`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${PROD_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${PROD_URL}/child-safety`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${PROD_URL}/blog/${post.slug}`,
    lastModified: new Date(post.lastModified || post.date),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const deBlogRoutes: MetadataRoute.Sitemap = dePosts.map((post) => ({
    url: `${PROD_URL}/blog/de/${post.slug}`,
    lastModified: new Date(post.lastModified || post.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const esBlogRoutes: MetadataRoute.Sitemap = esPosts.map((post) => ({
    url: `${PROD_URL}/blog/es/${post.slug}`,
    lastModified: new Date(post.lastModified || post.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // Category pages
  const categories = VALID_CATEGORIES;
  const categoryRoutes: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${PROD_URL}/blog/category/${cat}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
  const deCategoryRoutes: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${PROD_URL}/blog/de/category/${cat}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));
  const esCategoryRoutes: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${PROD_URL}/blog/es/category/${cat}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [
    ...staticRoutes,
    ...blogRoutes,
    ...deBlogRoutes,
    ...esBlogRoutes,
    ...categoryRoutes,
    ...deCategoryRoutes,
    ...esCategoryRoutes,
  ];
}
