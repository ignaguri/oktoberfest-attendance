"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { i18n, useTranslation } from "@/lib/i18n/client";
import { marketingUrl } from "@/lib/utils/marketingUrl";
import AppLogo from "@/public/android-chrome-512x512.png";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

import { MarketingLanguageSelector } from "./MarketingLanguageSelector";

export function MarketingHeader() {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  const lang = i18n.language;
  const navLinks = [
    { href: marketingUrl("/blog", lang), label: t("marketing.header.blog") },
    {
      href: marketingUrl("/download", lang),
      label: t("marketing.header.download"),
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href={isLoggedIn ? "/home" : marketingUrl("/", lang)}
          className="flex items-center gap-2 text-lg font-bold text-gray-900"
        >
          <Image
            src={AppLogo}
            alt="ProstCounter Logo"
            className="size-8"
            priority
          />
          <span translate="no">ProstCounter</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              {link.label}
            </Link>
          ))}
          <MarketingLanguageSelector />
          <Button variant="yellow" size="sm" asChild>
            <Link href={isLoggedIn ? "/home" : "/sign-in"}>
              {isLoggedIn
                ? t("marketing.header.goToApp")
                : t("marketing.header.signIn")}
            </Link>
          </Button>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="rounded-md p-2 text-gray-600 md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t border-gray-200 bg-white px-4 pt-2 pb-4 md:hidden">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="px-3 py-2">
              <MarketingLanguageSelector />
            </div>
            <Button variant="yellow" size="sm" asChild className="mt-1 w-fit">
              <Link
                href={isLoggedIn ? "/home" : "/sign-in"}
                onClick={() => setMobileMenuOpen(false)}
              >
                {isLoggedIn
                  ? t("marketing.header.goToApp")
                  : t("marketing.header.signIn")}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
