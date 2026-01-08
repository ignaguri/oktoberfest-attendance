import { Button } from "@/components/ui/button";
import { Link } from "next-view-transitions";

export default function ErrorPage({ error }: { error?: Error }) {
  return (
    <div className="flex flex-col items-center bg-gray-100 p-2">
      <div className="rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-4 text-2xl font-bold text-red-600">
          Oops! Something went wrong.
        </h1>
        <p className="mb-4 text-gray-600">
          {error?.message || "An unexpected error occurred."}
        </p>
        <Button asChild variant="link">
          <Link href="/">Go back to home page</Link>
        </Button>
      </div>
    </div>
  );
}
