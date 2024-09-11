import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";

export default async function Root() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        Compete with friends in different groups to see who visits Oktoberfest
        more often and drinks the most!
        <br />
        Track your progress and become the ultimate Wiesnmeister.
      </p>
      <div>
        <Link className="button-inverse" href="/sign-in">
          Sign In
        </Link>
      </div>
    </div>
  );
}
