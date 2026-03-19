"use client";

import { motion } from "framer-motion";
import { Beer, Download, Globe, Smartphone } from "lucide-react";
import Image from "next/image";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";

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

const platforms = [
  {
    icon: Smartphone,
    name: "iOS",
    description: "iPhone & iPad",
    action: "Download on the App Store",
    href: APP_STORE_URL,
    available: true,
  },
  {
    icon: Smartphone,
    name: "Android",
    description: "Coming soon",
    action: "Get notified",
    href: "/sign-up",
    available: false,
  },
  {
    icon: Globe,
    name: "Web App",
    description: "Any browser, any device",
    action: "Open Web App",
    href: "/sign-up",
    available: true,
  },
];

export function DownloadContent() {
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
          Download ProstCounter
        </motion.h1>

        <motion.p variants={fadeUp} className="mb-12 text-lg text-gray-500">
          Track your beer festival experience on any device. Free forever.
        </motion.p>

        {/* Platform cards */}
        <motion.div
          className="mb-12 grid gap-4 sm:grid-cols-3"
          variants={stagger}
        >
          {platforms.map((platform) => (
            <motion.div
              key={platform.name}
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
                {platform.description}
              </p>
              {platform.available ? (
                <Button variant="yellow" size="sm" asChild className="w-full">
                  {platform.href.startsWith("http") ? (
                    <a
                      href={platform.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download size={16} />
                      {platform.action}
                    </a>
                  ) : (
                    <Link href={platform.href}>{platform.action}</Link>
                  )}
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href={platform.href}>{platform.action}</Link>
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
            Scan with your phone
          </p>
          <Image
            src="/images/qrcode-download.svg"
            alt="QR code to download ProstCounter"
            width={200}
            height={200}
            className="mx-auto"
          />
          <p className="mt-4 text-xs text-gray-400">
            Opens the App Store on iOS devices
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
