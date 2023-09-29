import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import SignOut from "@/components/Auth/SignOut";

export default async function Home() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="card">
      <h2>Welcome!</h2>
      <code className="highlight">Email: {user.email}</code>
      <code className="highlight">Role: {user.role}</code>
      <Link className="button" href="/profile">
        Go to Profile
      </Link>
      <SignOut />
    </div>
  );
}
