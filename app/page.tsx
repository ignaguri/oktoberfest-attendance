import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <>
      <h1 className="mb-12 text-5xl font-bold sm:text-6xl">
        <span className="font-extrabold text-yellow-600">Prost</span>
        <span className="font-extrabold text-yellow-500">Counter</span> 🍻
      </h1>
      <div className="card">
        <h2>Welcome!</h2>
        <code className="highlight">Email: {user.email}</code>
        <Link className="button" href="/attendance">
          Register attendance
        </Link>
      </div>
    </>
  );
}
