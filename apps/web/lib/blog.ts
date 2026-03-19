import fs from "fs";
import matter from "gray-matter";
import path from "path";
import readingTime from "reading-time";

const CONTENT_DIR = path.join(process.cwd(), "content/blog");

export type BlogCategory = "festivals" | "tips" | "culture" | "news";
export type BlogLocale = "en" | "de" | "es";

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  lastModified: string;
  author: string;
  category: BlogCategory;
  tags: string[];
  featuredImage: string;
  locale: BlogLocale;
  readingTime: number;
  content: string;
}

export interface BlogPostMeta extends Omit<BlogPost, "content"> {}

function getLocaleDir(locale: BlogLocale): string {
  return path.join(CONTENT_DIR, locale);
}

export async function getAllPosts(
  locale: BlogLocale = "en",
): Promise<BlogPostMeta[]> {
  const dir = getLocaleDir(locale);

  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"));

  const posts = files.map((filename) => {
    const slug = filename.replace(/\.mdx$/, "");
    const filePath = path.join(dir, filename);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(fileContent);
    const stats = readingTime(content);

    return {
      slug,
      title: data.title || slug,
      description: data.description || "",
      date: data.date || new Date().toISOString(),
      lastModified: data.lastModified || data.date || new Date().toISOString(),
      author: data.author || "ProstCounter Team",
      category: (data.category || "tips") as BlogCategory,
      tags: data.tags || [],
      featuredImage: data.featuredImage || "/images/prost-counter-og-1.jpg",
      locale,
      readingTime: Math.ceil(stats.minutes),
    } satisfies BlogPostMeta;
  });

  return posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export async function getPostBySlug(
  slug: string,
  locale: BlogLocale = "en",
): Promise<BlogPost | null> {
  const dir = getLocaleDir(locale);
  const filePath = path.join(dir, `${slug}.mdx`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent);
  const stats = readingTime(content);

  return {
    slug,
    title: data.title || slug,
    description: data.description || "",
    date: data.date || new Date().toISOString(),
    lastModified: data.lastModified || data.date || new Date().toISOString(),
    author: data.author || "ProstCounter Team",
    category: (data.category || "tips") as BlogCategory,
    tags: data.tags || [],
    featuredImage: data.featuredImage || "/images/prost-counter-og-1.jpg",
    locale,
    readingTime: Math.ceil(stats.minutes),
    content,
  };
}

export async function getPostSlugs(): Promise<string[]> {
  const dir = getLocaleDir("en");

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

export async function getCategories(): Promise<BlogCategory[]> {
  return ["festivals", "tips", "culture", "news"];
}

export async function getPostsByCategory(
  category: BlogCategory,
  locale: BlogLocale = "en",
): Promise<BlogPostMeta[]> {
  const posts = await getAllPosts(locale);
  return posts.filter((post) => post.category === category);
}

export async function getAvailableLocales(slug: string): Promise<BlogLocale[]> {
  const locales: BlogLocale[] = ["en", "de", "es"];
  const available: BlogLocale[] = [];

  for (const locale of locales) {
    const filePath = path.join(getLocaleDir(locale), `${slug}.mdx`);
    if (fs.existsSync(filePath)) {
      available.push(locale);
    }
  }

  return available;
}
