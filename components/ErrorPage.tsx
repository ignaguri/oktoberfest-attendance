import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error }: { error?: Error }) {
  return (
    <div className="flex flex-col items-center p-2 bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Oops! Something went wrong.
        </h1>
        <p className="text-gray-600 mb-4">
          {error?.message || "An unexpected error occurred."}
        </p>
        <Button asChild variant="link">
          <Link href="/">Go back to home page</Link>
        </Button>
      </div>
    </div>
  );
}
