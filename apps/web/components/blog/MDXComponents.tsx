import { Beer, Calendar, Download, MapPin } from "lucide-react";
import Image from "next/image";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";

const APP_STORE_URL = "https://apps.apple.com/de/app/prostcounter/id6758376527";

export function CTA({ children }: { children?: React.ReactNode }) {
  return (
    <div className="my-8 rounded-xl border border-yellow-200 bg-yellow-50 p-6">
      <div className="flex items-start gap-3">
        <Beer className="mt-0.5 size-6 shrink-0 text-yellow-600" />
        <div>
          {children || (
            <p className="mb-4 text-gray-700">
              Planning your trip? ProstCounter helps you track your beer
              festival experience, compete with friends, and keep memories of
              every visit.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button variant="yellow" size="sm" asChild>
              <Link href="/sign-up">Try ProstCounter Free</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/download">
                <Download size={16} className="mr-1" />
                Download App
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppScreenshot({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  return (
    <figure className="my-6">
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <Image
          src={src}
          alt={alt}
          width={800}
          height={450}
          className="w-full"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-gray-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export function FestivalInfo({
  name,
  dates,
  location,
  description,
}: {
  name: string;
  dates: string;
  location: string;
  description?: string;
}) {
  return (
    <div className="my-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-2 text-lg font-bold text-gray-900">{name}</h3>
      <div className="mb-2 flex flex-col gap-1.5 text-sm text-gray-600">
        <span className="flex items-center gap-1.5">
          <Calendar size={14} className="text-yellow-600" />
          {dates}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin size={14} className="text-yellow-600" />
          {location}
        </span>
      </div>
      {description && <p className="text-sm text-gray-500">{description}</p>}
    </div>
  );
}

export function DownloadButtons() {
  return (
    <div className="my-6 flex flex-wrap items-center gap-4">
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
      >
        <Download size={16} className="mr-2" />
        App Store
      </a>
      <Button variant="yellow" size="sm" asChild>
        <Link href="/sign-up">Try Web App</Link>
      </Button>
    </div>
  );
}

export const mdxComponents = {
  CTA,
  AppScreenshot,
  FestivalInfo,
  DownloadButtons,
  // Override default HTML elements for better styling
  h1: ({ children, ...props }: React.ComponentProps<"h1">) => (
    <h1
      className="mt-8 mb-4 text-3xl font-bold tracking-tight text-gray-900"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: React.ComponentProps<"h2">) => (
    <h2 className="mt-8 mb-3 text-2xl font-bold text-gray-900" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.ComponentProps<"h3">) => (
    <h3 className="mt-6 mb-2 text-xl font-semibold text-gray-900" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }: React.ComponentProps<"p">) => (
    <p className="mb-4 leading-7 text-gray-600" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }: React.ComponentProps<"ul">) => (
    <ul className="mb-4 ml-6 list-disc space-y-1 text-gray-600" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.ComponentProps<"ol">) => (
    <ol className="mb-4 ml-6 list-decimal space-y-1 text-gray-600" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: React.ComponentProps<"li">) => (
    <li className="leading-7" {...props}>
      {children}
    </li>
  ),
  a: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a
      href={href}
      className="font-medium text-yellow-600 underline decoration-yellow-300 underline-offset-2 hover:text-yellow-700"
      {...props}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }: React.ComponentProps<"blockquote">) => (
    <blockquote
      className="my-4 border-l-4 border-yellow-400 bg-yellow-50 py-2 pl-4 text-gray-700 italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  table: ({ children, ...props }: React.ComponentProps<"table">) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }: React.ComponentProps<"th">) => (
    <th
      className="border border-gray-200 bg-gray-50 px-4 py-2 text-left font-semibold text-gray-900"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.ComponentProps<"td">) => (
    <td className="border border-gray-200 px-4 py-2 text-gray-600" {...props}>
      {children}
    </td>
  ),
  strong: ({ children, ...props }: React.ComponentProps<"strong">) => (
    <strong className="font-semibold text-gray-900" {...props}>
      {children}
    </strong>
  ),
  hr: () => <hr className="my-8 border-gray-200" />,
};
