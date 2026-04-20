"use client";

import { motion } from "framer-motion";
import { Beer, Download, Globe, Smartphone, Watch } from "lucide-react";
import Image from "next/image";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/client";

const APP_STORE_URL = "https://apps.apple.com/de/app/prostcounter/id6758376527";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const platformKeys = [
  {
    key: "ios",
    icon: Smartphone,
    name: "iOS",
    href: APP_STORE_URL,
    available: true,
  },
  {
    key: "android",
    icon: Smartphone,
    name: "Android",
    href: "/sign-up",
    available: false,
  },
  {
    key: "webApp",
    icon: Globe,
    name: "Web App",
    href: "/sign-up",
    available: true,
  },
] as const;

export function DownloadContent() {
  const { t } = useTranslation();

  return (
    <div className="px-4 py-16 sm:px-6">
      <motion.div
        className="mx-auto max-w-3xl text-center"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <motion.div variants={fadeUp} className="mb-6">
          <Beer className="mx-auto size-16 text-yellow-500" />
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="mb-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
        >
          {t("marketing.download.title")}
        </motion.h1>

        <motion.p variants={fadeUp} className="mb-12 text-lg text-gray-500">
          {t("marketing.download.subtitle")}
        </motion.p>

        {/* Platform cards */}
        <motion.div
          className="mb-12 grid gap-4 sm:grid-cols-3"
          variants={stagger}
        >
          {platformKeys.map((platform) => (
            <motion.div
              key={platform.key}
              variants={fadeUp}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <platform.icon
                size={32}
                className={`mx-auto mb-3 ${platform.available ? "text-yellow-500" : "text-gray-300"}`}
              />
              <h2 className="text-lg font-bold text-gray-900">
                {platform.name}
              </h2>
              <p className="mb-4 text-sm text-gray-500">
                {t(`marketing.download.${platform.key}.description`)}
              </p>
              {platform.available ? (
                <Button variant="yellow" size="sm" asChild className="w-fit">
                  {platform.href.startsWith("http") ? (
                    <a
                      href={platform.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download size={16} />
                      {t(`marketing.download.${platform.key}.action`)}
                    </a>
                  ) : (
                    <Link href={platform.href}>
                      {t(`marketing.download.${platform.key}.action`)}
                    </Link>
                  )}
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href={platform.href}>
                    {t(`marketing.download.${platform.key}.action`)}
                  </Link>
                </Button>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* QR Code */}
        <motion.div
          variants={fadeUp}
          className="mx-auto max-w-xs rounded-2xl border border-gray-200 bg-white p-8"
        >
          <p className="mb-4 text-sm font-medium text-gray-600">
            {t("marketing.download.scanWithPhone")}
          </p>
          <Image
            src="/images/qrcode-download.svg"
            alt="QR code to download ProstCounter"
            width={200}
            height={200}
            className="mx-auto"
          />
          <p className="mt-4 text-xs text-gray-400">
            {t("marketing.download.opensAppStore")}
          </p>
        </motion.div>

        {/* Apple Watch Companion */}
        <motion.div
          variants={fadeUp}
          className="mx-auto mt-10 max-w-2xl rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50 p-6 text-left sm:p-8"
        >
          <div className="flex items-start gap-4 sm:gap-6">
            <div className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gray-900 sm:size-16">
              <Watch size={32} className="text-yellow-400" strokeWidth={1.75} />
            </div>
            <div className="flex-1">
              <h3 className="mb-2 text-lg font-bold text-gray-900 sm:text-xl">
                {t("marketing.download.appleWatch.title")}
              </h3>
              <p className="mb-2 text-sm text-gray-600 sm:text-base">
                {t("marketing.download.appleWatch.description")}
              </p>
              <p className="text-xs text-gray-500">
                {t("marketing.download.appleWatch.requirements")}
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
