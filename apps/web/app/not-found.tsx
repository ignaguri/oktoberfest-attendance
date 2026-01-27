import Image from "next/image";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";
import LogoImage from "@/public/android-chrome-512x512.png";

export default function NotFound() {
  return (
    <div className="flex max-w-lg flex-col items-center justify-center gap-8 py-12">
      <Image
        src={LogoImage}
        alt="Prost Counter Logo"
        className="inline-block size-16 opacity-60"
      />
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-6xl font-extrabold text-gray-300">404</h1>
        <h2 className="text-xl font-semibold text-gray-700">Page not found</h2>
        <p className="px-4 text-center text-gray-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Button variant="yellow" asChild>
        <Link href="/home">Go Home</Link>
      </Button>
    </div>
  );
}
