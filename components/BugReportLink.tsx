"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function BugReportLink({ className }: { className?: string }) {
  const [mailtoLink, setMailtoLink] = useState<string>("");

  useEffect(() => {
    const info = [
      `Browser: ${navigator.userAgent}`,
      `Screen Size: ${window.screen.width}x${window.screen.height}`,
      `Viewport Size: ${window.innerWidth}x${window.innerHeight}`,
      `OS: ${navigator.platform}`,
      `Time: ${new Date().toISOString()}`,
    ].join("\n");

    const email = "pepe.grillo.parlante@gmail.com";
    const subject = "[ProstCounter🍻] Bug Report";
    const body = `Please describe the bug you encountered:

----- Environment Information -----
${info}
----- End Environment Information -----

Describe the bug here:
`;

    setMailtoLink(
      `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    );
  }, []);

  return (
    <Link
      href={mailtoLink}
      aria-label="Report a bug (opens email client)"
      className={cn(className)}
    >
      Report a bug
    </Link>
  );
}
