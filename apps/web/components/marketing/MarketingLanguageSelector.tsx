"use client";

import {
  changeLanguage,
  getCurrentLanguage,
  i18n,
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
} from "@prostcounter/shared/i18n";
import { Globe } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { setLangCookie } from "@/lib/utils/langCookie";

const LOCALE_PATTERN = /^\/(de|es)(\/|$)/;

/**
 * Resolve the localized URL for the current marketing page.
 * Handles: /, /de, /es, /download, /de/download, /blog, /blog/de, /blog/de/slug, etc.
 */
function getLocalizedUrl(pathname: string, newLocale: string): string | null {
  // Blog pages: /blog, /blog/de, /blog/de/slug, /blog/slug
  if (pathname.startsWith("/blog")) {
    const rest = pathname.slice("/blog".length);
    const localeMatch = rest.match(/^\/(de|es)(\/|$)/);
    const contentPath = localeMatch
      ? rest.slice(localeMatch[0].length - (localeMatch[2] === "/" ? 1 : 0))
      : rest;
    return newLocale === "en" ? `/blog${contentPath}` : `/blog/${newLocale}${contentPath}`;
  }

  // Download page: /download, /de/download, /es/download
  if (pathname === "/download" || /^\/(de|es)\/download$/.test(pathname)) {
    return newLocale === "en" ? "/download" : `/${newLocale}/download`;
  }

  // Landing page: /, /de, /es
  if (pathname === "/" || LOCALE_PATTERN.test(pathname)) {
    // Only match bare locale paths (not /de/download which is handled above)
    const localeMatch = pathname.match(/^\/(de|es)$/);
    if (pathname === "/" || localeMatch) {
      return newLocale === "en" ? "/" : `/${newLocale}`;
    }
  }

  return null;
}

export function MarketingLanguageSelector() {
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage);
  const pathname = usePathname();
  const router = useRouter();

  // Sync state if language changes externally (e.g. I18nProvider profile load)
  useEffect(() => {
    const handler = (lang: string) => setCurrentLang(lang);
    i18n.on("languageChanged", handler);
    return () => {
      i18n.off("languageChanged", handler);
    };
  }, []);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const lang = e.target.value;
      await changeLanguage(lang);
      setLangCookie(lang);
      setCurrentLang(lang);

      const newUrl = getLocalizedUrl(pathname, lang);
      if (newUrl && newUrl !== pathname) {
        router.push(newUrl);
      }
    },
    [pathname, router],
  );

  return (
    <div className="relative inline-flex items-center">
      <Globe size={16} className="pointer-events-none absolute left-2 text-gray-500" />
      <select
        value={currentLang}
        onChange={handleChange}
        className="appearance-none rounded-md border border-gray-200 bg-transparent py-1.5 pr-6 pl-7 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 focus:border-yellow-400 focus:outline-none"
        aria-label="Select language"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {LANGUAGE_NAMES[lang]}
          </option>
        ))}
      </select>
    </div>
  );
}
