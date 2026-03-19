"use client";

import { motion } from "framer-motion";
import { Beer, Calendar, Download, MapPin, Trophy, Users } from "lucide-react";
import Image from "next/image";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";
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

const features = [
  {
    icon: Beer,
    title: "Track Your Beers",
    description:
      "Log daily consumption, record tent visits, snap photos of your Masskrugs, and build a timeline of every festival day.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: Users,
    title: "Compete with Friends",
    description:
      "Create groups, challenge your crew on leaderboards, and see who racks up the most festival days (or beers).",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: MapPin,
    title: "Live Location Sharing",
    description:
      "Lost your friends at the Wiesn? Share your real-time location across festival tents so nobody drinks alone.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Trophy,
    title: "Earn Achievements",
    description:
      "Unlock 40+ badges across categories — from first-timer milestones to legendary streaks and hidden surprises.",
    color: "bg-purple-50 text-purple-600",
  },
];

const festivals = [
  {
    name: "Oktoberfest 2026",
    dates: "Sep 19 — Oct 4",
    description: "The world's largest beer festival returns to Munich.",
    href: "/blog/oktoberfest-2026-guide",
  },
  {
    name: "Starkbierfest",
    dates: "March — April",
    description: "Munich's strong beer season — the locals' hidden gem.",
    href: "/blog/starkbierfest-guide",
  },
  {
    name: "Frühlingsfest",
    dates: "April — May",
    description: "Munich's spring festival on the Theresienwiese.",
    href: "/blog/fruehlingsfest-guide",
  },
];

export function LandingContent() {
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
            Your Beer Festival
            <br />
            <span className="bg-gradient-to-r from-yellow-500 to-amber-600 bg-clip-text text-transparent">
              Companion App
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mb-10 max-w-2xl text-lg text-gray-500 sm:text-xl"
          >
            Track every Masskrug, compete with friends on leaderboards, and
            relive your Oktoberfest memories — all in one app.
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
              <Link href="/sign-up">Get Started Free</Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="text-base">
              <Link href="/download">
                <Download size={18} className="mr-1" />
                Download App
              </Link>
            </Button>
          </motion.div>

          {/* Social proof hint */}
          <motion.p variants={fadeUp} className="mt-6 text-sm text-gray-400">
            Free forever. Available on iOS, Android & Web.
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
              Everything you need at the Wiesn
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-3 text-lg text-gray-500">
              Built by festival-goers, for festival-goers.
            </motion.p>
          </motion.div>

          <motion.div
            className="grid gap-6 sm:grid-cols-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
              >
                <div
                  className={`mb-4 inline-flex rounded-xl p-3 ${feature.color}`}
                >
                  <feature.icon size={24} />
                </div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">
                  {feature.title}
                </h3>
                <p className="leading-relaxed text-gray-500">
                  {feature.description}
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
              Munich Beer Festivals
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-3 text-lg text-gray-500">
              ProstCounter supports all major Munich beer festivals.
            </motion.p>
          </motion.div>

          <motion.div
            className="grid gap-6 sm:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            {festivals.map((festival) => (
              <motion.div key={festival.name} variants={fadeUp}>
                <Link
                  href={festival.href}
                  className="group block rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-yellow-300 hover:shadow-md"
                >
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-yellow-600">
                    <Calendar size={16} />
                    {festival.dates}
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-yellow-600">
                    {festival.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {festival.description}
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
              View the full Munich festival calendar
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
            Ready for the next festival?
          </motion.h2>
          <motion.p variants={fadeUp} className="mb-10 text-lg text-gray-400">
            Download ProstCounter and start tracking your beer festival
            adventure today.
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
              Download on iOS
            </a>
            <Button
              variant="yellowOutline"
              size="lg"
              asChild
              className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-300"
            >
              <Link href="/sign-up">Try the Web App</Link>
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
              Scan to download on your phone
            </p>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
