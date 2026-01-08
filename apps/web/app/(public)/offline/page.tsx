import { Button } from "@/components/ui/button";
import { Link } from "next-view-transitions";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <h1 className="mb-4 text-4xl font-bold">You&apos;re Offline</h1>
      <p className="mb-8 text-xl">
        Please check your internet connection and try again.
      </p>
      <Button asChild>
        <Link href="/">Try Again</Link>
      </Button>
    </div>
  );
}
