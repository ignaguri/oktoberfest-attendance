"use client";

import { motion } from "framer-motion";
import { Beer, Calendar, Download, MapPin, Trophy, Users } from "lucide-react";
import Image from "next/image";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/client";
import AppLogo from "@/public/android-chrome-512x512.png";

const APP_STORE_URL = "https://apps.apple.com/de/app/prostcounter/id6758376527";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const featureKeys = [
  { key: "trackBeers", icon: Beer, color: "bg-amber-50 text-amber-600" },
  { key: "competeWithFriends", icon: Users, color: "bg-blue-50 text-blue-600" },
  {
    key: "liveLocation",
    icon: MapPin,
    color: "bg-emerald-50 text-emerald-600",
  },
  { key: "achievements", icon: Trophy, color: "bg-purple-50 text-purple-600" },
] as const;

const festivalKeys = [
  { key: "oktoberfest", href: "/blog/oktoberfest-2026-guide" },
  { key: "starkbierfest", href: "/blog/starkbierfest-guide" },
  { key: "fruehlingsfest", href: "/blog/fruehlingsfest-guide" },
] as const;

export function LandingContent() {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
        {/* Background gradient */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(245,158,11,0.15), transparent)",
          }}
        />

        <motion.div
          className="mx-auto max-w-4xl text-center"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="mb-6">
            <Image
              src={AppLogo}
              alt="ProstCounter Logo"
              className="mx-auto size-20 drop-shadow-lg sm:size-24"
              priority
            />
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mb-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-6xl"
          >
            {t("marketing.hero.title1")}
            <br />
            <span className="bg-gradient-to-r from-yellow-500 to-amber-600 bg-clip-text text-transparent">
              {t("marketing.hero.title2")}
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mb-10 max-w-2xl text-lg text-gray-500 sm:text-xl"
          >
            {t("marketing.hero.subtitle")}
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Button
              variant="darkYellow"
              size="lg"
              asChild
              className="px-8 text-base"
            >
              <Link href="/sign-up">{t("marketing.hero.getStarted")}</Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="text-base">
              <Link href="/download">
                <Download size={18} className="mr-1" />
                {t("marketing.hero.downloadApp")}
              </Link>
            </Button>
          </motion.div>

          {/* Social proof hint */}
          <motion.p variants={fadeUp} className="mt-6 text-sm text-gray-400">
            {t("marketing.hero.freeForever")}
          </motion.p>
        </motion.div>
      </section>

      {/* Features */}
      <section className="bg-white px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="mb-14 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
            >
              {t("marketing.features.sectionTitle")}
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-3 text-lg text-gray-500">
              {t("marketing.features.sectionSubtitle")}
            </motion.p>
          </motion.div>

          <motion.div
            className="grid gap-6 sm:grid-cols-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            {featureKeys.map((feature) => (
              <motion.div
                key={feature.key}
                variants={fadeUp}
                className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
              >
                <div
                  className={`mb-4 inline-flex rounded-xl p-3 ${feature.color}`}
                >
                  <feature.icon size={24} />
                </div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">
                  {t(`marketing.features.${feature.key}.title`)}
                </h3>
                <p className="leading-relaxed text-gray-500">
                  {t(`marketing.features.${feature.key}.description`)}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Festivals */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="mb-14 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
            >
              {t("marketing.festivals.sectionTitle")}
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-3 text-lg text-gray-500">
              {t("marketing.festivals.sectionSubtitle")}
            </motion.p>
          </motion.div>

          <motion.div
            className="grid gap-6 sm:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            {festivalKeys.map((festival) => (
              <motion.div key={festival.key} variants={fadeUp}>
                <Link
                  href={festival.href}
                  className="group block rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-yellow-300 hover:shadow-md"
                >
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-yellow-600">
                    <Calendar size={16} />
                    {t(`marketing.festivals.${festival.key}.dates`)}
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-yellow-600">
                    {t(`marketing.festivals.${festival.key}.name`)}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {t(`marketing.festivals.${festival.key}.description`)}
                  </p>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="mt-8 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <Link
              href="/blog/munich-beer-festivals-calendar"
              className="text-sm font-medium text-yellow-600 underline decoration-yellow-300 underline-offset-4 hover:text-yellow-700"
            >
              {t("marketing.festivals.viewCalendar")}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Download / CTA */}
      <section className="relative overflow-hidden bg-gray-900 px-4 py-20 sm:px-6">
        <div
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 120%, rgba(245,158,11,0.2), transparent)",
          }}
        />

        <motion.div
          className="relative z-10 mx-auto max-w-3xl text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          <motion.h2
            variants={fadeUp}
            className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            {t("marketing.cta.title")}
          </motion.h2>
          <motion.p variants={fadeUp} className="mb-10 text-lg text-gray-300">
            {t("marketing.cta.subtitle")}
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-100"
            >
              <Download size={18} className="mr-2" />
              {t("marketing.cta.downloadIos")}
            </a>
            <Button
              variant="yellowOutline"
              size="lg"
              asChild
              className="border-yellow-400 text-yellow-300 hover:bg-yellow-400/10 hover:text-yellow-200"
            >
              <Link href="/sign-up">{t("marketing.cta.tryWebApp")}</Link>
            </Button>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-10">
            <Image
              src="/images/qrcode.svg"
              alt="Scan to download ProstCounter"
              width={120}
              height={120}
              className="mx-auto rounded-lg bg-white p-2"
            />
            <p className="mt-2 text-xs text-gray-500">
              {t("marketing.cta.scanToDownload")}
            </p>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
