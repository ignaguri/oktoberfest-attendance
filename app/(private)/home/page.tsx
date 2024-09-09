import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import MissingFields from "./MissingFields";

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

  return { missingFields };
};

export default async function Home() {
  const { missingFields } = await getProfileData();
  const showMissingSection = Object.values(missingFields).length > 0;

  return (
    <div className="max-w-lg">
      <h1 className="mb-12 text-5xl font-bold sm:text-6xl">
        <span className="font-extrabold text-yellow-600">Prost</span>
        <span className="font-extrabold text-yellow-500">Counter</span>
        <br />
        <span role="img" aria-label="beer">
          🍻
        </span>
      </h1>
      <p className="text-center text-gray-700 mb-6 px-4">
        Compete with friends in different groups to see who visits Oktoberfest
        more often and drinks the most! Track your progress and become the
        ultimate Wiesnmeister.
      </p>
      <div className="card gap-4">
        {showMissingSection && <MissingFields missingFields={missingFields} />}

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
    </div>
  );
}
