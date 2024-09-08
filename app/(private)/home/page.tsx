import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

const getProfileData = async () => {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(`full_name, username, avatar_url`)
    .eq("id", user.id)
    .single();

  if (!data || error) {
    redirect("/error");
  }

  const userData = data;

  let missingFields: {
    full_name?: string;
    username?: string;
    avatar_url?: string;
  } = {};

  if (!userData.full_name) {
    missingFields = { ...missingFields, full_name: "Name" };
  }
  if (!userData.username) {
    missingFields = { ...missingFields, username: "Username" };
  }
  if (!userData.avatar_url) {
    missingFields = { ...missingFields, avatar_url: "Profile picture" };
  }

  return { missingFields, username: userData.username };
};

export default async function Home() {
  const { missingFields, username } = await getProfileData();
  const showMissingSection = Object.values(missingFields).length > 0;

  return (
    <>
      <h1 className="mb-12 text-5xl font-bold sm:text-6xl">
        <span className="font-extrabold text-yellow-600">Prost</span>
        <span className="font-extrabold text-yellow-500">Counter</span> 🍻
      </h1>
      <div className="card">
        <h2>{username ? `Welcome, ${username}!` : "Welcome!"}</h2>
        {showMissingSection && (
          <div className="flex flex-col gap-2">
            <h5 className="text-sm text-gray-500">
              It seems you have some missing data in your profile:
            </h5>
            <ul className="highlight text-center">
              {Object.values(missingFields).map((value) => (
                <li key={value}>{`• ${value}`}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {showMissingSection && (
            <Link className="button" href="/profile">
              Complete your profile
            </Link>
          )}
          <Link className="button-inverse" href="/attendance">
            Register attendance
          </Link>
          <Link className="button-inverse bg-yellow-600" href="/groups">
            My Groups
          </Link>
        </div>
      </div>
    </>
  );
}
