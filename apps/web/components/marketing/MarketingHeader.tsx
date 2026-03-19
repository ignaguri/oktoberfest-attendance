"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import { Link } from "next-view-transitions";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import AppLogo from "@/public/android-chrome-512x512.png";

const navLinks = [
  { href: "/blog", label: "Blog" },
  { href: "/download", label: "Download" },
];

export function MarketingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
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
          <Button variant="yellow" size="sm" asChild>
            <Link href="/sign-in">Sign In</Link>
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
            <Button variant="yellow" size="sm" asChild className="mt-1">
              <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)}>
                Sign In
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
