import type { SupportedLanguage } from "@prostcounter/shared/i18n";

import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingLocaleProvider } from "@/lib/i18n/MarketingLocaleProvider";
import { toSupportedLanguage } from "@/lib/utils/marketingUrl";

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: langParam } = await params;
  const lang = toSupportedLanguage(langParam);

  return (
    <MarketingLocaleProvider locale={lang}>
      <div className="flex min-h-screen flex-col">
        <MarketingHeader />
        <main className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
    </MarketingLocaleProvider>
  );
}
