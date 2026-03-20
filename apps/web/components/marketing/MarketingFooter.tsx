import { Beer } from "lucide-react";
import Image from "next/image";
import { Link } from "next-view-transitions";

import AppLogo from "@/public/android-chrome-512x512.png";

const APP_STORE_URL = "https://apps.apple.com/de/app/prostcounter/id6758376527";

const blogLinks = [
  { href: "/blog/oktoberfest-2026-guide", label: "Oktoberfest 2026 Guide" },
  { href: "/blog/first-time-oktoberfest", label: "First Time Tips" },
  { href: "/blog/oktoberfest-tents-guide", label: "Tent Guide" },
  {
    href: "/blog/munich-beer-festivals-calendar",
    label: "Festival Calendar",
  },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/r/bugs", label: "Report a Bug", external: true },
  { href: "/r/feedback", label: "Request a Feature", external: true },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Image src={AppLogo} alt="ProstCounter Logo" className="size-8" />
              <span className="text-lg font-bold" translate="no">
                ProstCounter
              </span>
            </Link>
            <p className="mt-3 text-sm text-gray-600">
              Track your beer festival attendance and compete with friends.
            </p>
          </div>

          {/* Blog */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Blog</h3>
            <ul className="space-y-2">
              {blogLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Download */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Download
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  iOS App Store
                </a>
              </li>
              <li>
                <Link
                  href="/download"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  All Platforms
                </Link>
              </li>
              <li>
                <Link
                  href="/sign-up"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Try the Web App
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Legal</h3>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-6 sm:flex-row">
          <p className="flex items-center gap-1 text-sm text-gray-500">
            <Beer size={14} />
            <span>&copy; {new Date().getFullYear()} ProstCounter. Prost!</span>
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/ignaguri"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              @ignaguri
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
