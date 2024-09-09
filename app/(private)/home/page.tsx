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
        {showMissingSection && (
          <>
            <p className="text-sm text-center text-gray-600 mb-2">
              Let&apos;s complete your profile to get started:
            </p>
            <div className="space-y-4 mb-4">
              {missingFields.full_name && (
                <div className="flex items-center space-x-4 p-3 bg-gray-100 rounded-lg">
                  <span className="text-xl" role="img" aria-label="User">
                    👤
                  </span>
                  <span className="flex-grow text-gray-700">Name</span>
                  <Link
                    href="/profile"
                    className="text-xl cursor-pointer hover:opacity-70 transition-opacity"
                    aria-label="Edit"
                  >
                    ✏️
                  </Link>
                </div>
              )}
              {missingFields.username && (
                <div className="flex items-center space-x-4 p-3 bg-gray-100 rounded-lg">
                  <span className="text-xl" role="img" aria-label="User">
                    👤
                  </span>
                  <span className="flex-grow text-gray-700">Username</span>
                  <Link
                    href="/profile"
                    className="text-xl cursor-pointer hover:opacity-70 transition-opacity"
                    aria-label="Edit"
                  >
                    ✏️
                  </Link>
                </div>
              )}
              {missingFields.avatar_url && (
                <div className="flex items-center space-x-4 p-3 bg-gray-100 rounded-lg">
                  <span className="text-xl" role="img" aria-label="Image">
                    🖼️
                  </span>
                  <span className="flex-grow text-gray-700">
                    Profile picture
                  </span>
                  <Link
                    href="/profile"
                    className="text-xl cursor-pointer hover:opacity-70 transition-opacity"
                    aria-label="Edit"
                  >
                    ✏️
                  </Link>
                </div>
              )}
            </div>
          </>
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
    </div>
  );
}
