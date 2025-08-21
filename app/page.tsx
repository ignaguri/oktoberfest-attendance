import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/sharedActions";
import { redirect } from "next/navigation";
import { Link } from "next-view-transitions";

import "server-only";

export default async function Root() {
  let user;
  try {
    user = await getUser();
  } catch (error) {
    // do nothing
  }

  if (user) {
    redirect("/home");
  }

  return (
    <div className="max-w-lg flex flex-col items-center justify-center gap-12">
      <h1 className="text-5xl font-bold sm:text-6xl">
        <span className="font-extrabold text-yellow-600">Prost</span>
        <span className="font-extrabold text-yellow-500">Counter</span>
        <br />
        <span role="img" aria-label="beer">
          🍻
        </span>
      </h1>
      <p className="text-center text-gray-700 px-4">
        Compete with friends in different groups to see who visits beer
        festivals more often and drinks the most beers!
        <br />
        Track your progress and become the ultimate beer festival champion.
      </p>
      <div>
        <Button variant="yellow" asChild>
          <Link href="/sign-in">Sign In</Link>
        </Button>
      </div>
    </div>
  );
}
