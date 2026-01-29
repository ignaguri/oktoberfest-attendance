"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import { Beer, Heart } from "lucide-react";
import { Link } from "next-view-transitions";

import { Separator } from "@/components/ui/separator";

const Footer = ({ isLoggedIn }: { isLoggedIn: boolean }) => {
  const { t } = useTranslation();
  return (
    <footer className="mx-2">
      <Separator className="my-4" decorative />

      <div className="flex flex-col items-center text-center text-sm">
        <div className="mb-2 flex items-center gap-1 text-gray-600">
          <span className="inline-flex items-center gap-1">
            <span>{t("footer.madeWith")}</span>
            <Heart size={16} aria-hidden />
            <span>{t("footer.by")}</span>
          </span>
          <Link
            href="/r/github"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            @ignaguri
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {isLoggedIn && (
            <>
              <Link
                href="/r/donate"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("footer.buyMeABeer")}
                className="inline-flex items-center gap-1 text-sm text-gray-500 underline"
              >
                <span>{t("footer.buyMeA")}</span>
                <Beer size={16} aria-hidden />
              </Link>
              <span className="text-gray-400" aria-hidden>
                ·
              </span>
            </>
          )}

          <div className="flex flex-wrap items-center gap-2 text-gray-500">
            <Link
              href="/r/bugs"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("footer.reportBug")}
              className="underline"
            >
              {t("footer.reportBug")}
            </Link>

            <span className="text-gray-400" aria-hidden>
              ·
            </span>

            <Link
              href="/r/feedback"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("footer.requestFeature")}
              className="underline"
            >
              {t("footer.requestFeature")}
            </Link>

            <span className="text-gray-400" aria-hidden>
              ·
            </span>

            <Link
              href="/privacy"
              aria-label={t("footer.links.privacy")}
              className="underline"
            >
              {t("footer.links.privacy")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
