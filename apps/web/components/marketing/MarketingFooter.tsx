"use client";

import { Beer } from "lucide-react";
import Image from "next/image";
import { Link } from "next-view-transitions";

import { ANDROID_PLAY_STORE_URL, IOS_APP_STORE_URL } from "@/lib/constants";
import { i18n, useTranslation } from "@/lib/i18n/client";
import { marketingUrl } from "@/lib/utils/marketingUrl";
import AppLogo from "@/public/android-chrome-512x512.png";

export function MarketingFooter() {
  const { t } = useTranslation();
  const lang = i18n.language;

  const blogLinks = [
    { href: "/blog/oktoberfest-2026-guide", labelKey: "oktoberfestGuide" },
    { href: "/blog/first-time-oktoberfest", labelKey: "firstTimeTips" },
    { href: "/blog/oktoberfest-tents-guide", labelKey: "tentGuide" },
    {
      href: "/blog/munich-beer-festivals-calendar",
      labelKey: "festivalCalendar",
    },
  ] as const;

  const legalLinks = [
    { href: "/privacy", labelKey: "privacyPolicy" as const },
    { href: "/child-safety", labelKey: "childSafety" as const },
    { href: "/r/bugs", labelKey: "reportBug" as const, external: true },
    {
      href: "/r/feedback",
      labelKey: "requestFeature" as const,
      external: true,
    },
  ];

  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href={marketingUrl("/", lang)} className="flex items-center gap-2">
              <Image src={AppLogo} alt="ProstCounter Logo" className="size-8" />
              <span className="text-lg font-bold" translate="no">
                ProstCounter
              </span>
            </Link>
            <p className="mt-3 text-sm text-gray-600">{t("marketing.footer.tagline")}</p>
          </div>

          {/* Blog */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              {t("marketing.footer.blog")}
            </h3>
            <ul className="space-y-2">
              {blogLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={marketingUrl(link.href, lang)}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    {t(`marketing.footer.blogLinks.${link.labelKey}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Download */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              {t("marketing.footer.download")}
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href={IOS_APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {t("marketing.footer.downloadLinks.iosAppStore")}
                </a>
              </li>
              <li>
                <a
                  href={ANDROID_PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {t("marketing.footer.downloadLinks.androidPlayStore")}
                </a>
              </li>
              <li>
                <Link
                  href={marketingUrl("/download", lang)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {t("marketing.footer.downloadLinks.allPlatforms")}
                </Link>
              </li>
              <li>
                <Link href="/sign-up" className="text-sm text-gray-600 hover:text-gray-900">
                  {t("marketing.footer.downloadLinks.tryWebApp")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              {t("marketing.footer.legal")}
            </h3>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    {t(`marketing.footer.legalLinks.${link.labelKey}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-6 sm:flex-row">
          <p className="flex items-center gap-1 text-sm text-gray-500">
            <Beer size={14} />
            <span>
              {t("marketing.footer.copyright", {
                year: new Date().getFullYear(),
              })}
            </span>
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
