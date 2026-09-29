import { publicShareImagePath } from "@prostcounter/api/share-cards";
import { PROD_URL, type ShareLang } from "@prostcounter/shared";
import { i18n, initI18n } from "@prostcounter/shared/i18n/core";
import type { ShareCard } from "@prostcounter/shared/wrapped/server";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { cache } from "react";

import { toSupportedLanguage } from "@/lib/utils/marketingUrl";
import { createClient } from "@/utils/supabase/server";

type Params = { lang: string; token: string };

initI18n();

// Metadata and page both need it; cache() makes that one RPC per request
const loadShare = cache(async function loadShare(
  token: string,
): Promise<{ card: ShareCard; festivalName: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_wrapped_share", {
    p_token: token,
  });
  const row = data?.[0];
  if (error || !row) {
    return null;
  }
  return {
    card: row.card_data as unknown as ShareCard,
    festivalName: row.festival_name,
  };
});

async function siteOrigin(): Promise<string> {
  if (process.env.VERCEL_ENV === "production") {
    return PROD_URL;
  }
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3008";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

function downloadPath(lang: ShareLang): string {
  return lang === "en" ? "/download" : `/${lang}/download`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { lang: langParam, token } = await params;
  const lang = toSupportedLanguage(langParam);
  const t = i18n.getFixedT(lang);
  const share = await loadShare(token);
  if (!share) {
    return {
      title: t("wrapped.shareCards.teaser.unavailable"),
      robots: { index: false, follow: false },
    };
  }
  const title = t("wrapped.shareCards.teaser.title", {
    festival: share.festivalName,
  });
  const ogImage = `${await siteOrigin()}${publicShareImagePath(token, "og", lang, share.card)}`;
  return {
    title,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, images: [ogImage] },
  };
}

export default async function WrappedTeaserPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { lang: langParam, token } = await params;
  const lang = toSupportedLanguage(langParam);
  const t = i18n.getFixedT(lang);
  const share = await loadShare(token);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 py-8">
      {share ? (
        <>
          <h1 className="text-2xl font-extrabold">
            {t("wrapped.shareCards.teaser.title", {
              festival: share.festivalName,
            })}
          </h1>
          {/* eslint-disable-next-line @next/next/no-img-element -- an API-rendered, CDN-cached JPEG */}
          <img
            src={publicShareImagePath(token, "story", lang, share.card)}
            alt={t("wrapped.shareCards.teaser.imageAlt", {
              festival: share.festivalName,
            })}
            width={1080}
            height={1920}
            className="h-auto w-full rounded-2xl shadow-lg"
          />
        </>
      ) : (
        <h1 className="text-2xl font-extrabold">
          {t("wrapped.shareCards.teaser.unavailable")}
        </h1>
      )}
      <Link
        href={downloadPath(lang)}
        className="rounded-xl bg-yellow-500 px-6 py-4 text-base font-bold text-white hover:bg-yellow-600"
      >
        {t("wrapped.shareCards.teaser.cta")}
      </Link>
    </div>
  );
}
