import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import MissingFields from "./MissingFields";
import OktoberfestStatus from "./OktoberfestStatus";
import MyGroups from "@/components/MyGroups";
import { Tables } from "@/lib/database.types";

const getProfileData = async () => {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(`full_name, username, avatar_url`)
    .eq("id", user.id)
    .single();

  if (!profileData || profileError) {
    redirect("/error");
  }

  const { data: groupsData, error: groupsError } = await supabase
    .from("group_members")
    .select(
      `
      group_id,
      groups (
        id,
        name,
        winning_criteria
      )
    `,
    )
    .eq("user_id", user.id);

  if (groupsError) {
    console.error("Error fetching groups", groupsError);
  }

  const groups = groupsData
    ?.map((group) => group.groups)
    .filter((group) => group !== null) as Tables<"groups">[];
  const topPositions = [];
  for (const group of groups || []) {
    if (group && group.id) {
      const { data: leaderboardData } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("group_id", group.id)
        .order(group.winning_criteria ?? "total_beers", { ascending: false })
        .limit(1);

      if (leaderboardData && leaderboardData[0]?.user_id === user.id) {
        topPositions.push({
          id: group.id,
          name: group.name ?? "Unknown Group",
        });
      }
    }
  }

  let missingFields: { [key: string]: string } = {};
  if (!profileData.full_name) missingFields.full_name = "Name";
  if (!profileData.username) missingFields.username = "Username";
  if (!profileData.avatar_url) missingFields.avatar_url = "Profile picture";

  return { missingFields, groups, topPositions };
};

export default async function Home() {
  const { missingFields, groups, topPositions } = await getProfileData();
  const showMissingSection = Object.values(missingFields).length > 0;

  return (
    <div className="max-w-lg flex flex-col">
      <h1 className="mb-6 text-5xl font-bold sm:text-6xl">
        <span className="font-extrabold text-yellow-600">Prost</span>
        <span className="font-extrabold text-yellow-500">Counter</span>
        <br />
        <span role="img" aria-label="beer">
          🍻
        </span>
      </h1>

      <div className="mb-4">
        <OktoberfestStatus />
      </div>

      <p className="text-center text-gray-600 mb-4 px-4">
        Compete with friends in different groups to see who visits Oktoberfest
        more often and drinks the most!
        <br />
        Track your progress and become the ultimate Wiesnmeister.
      </p>

      {showMissingSection && (
        <div className="flex flex-col gap-4">
          <div className="card gap-4 py-4">
            <MissingFields missingFields={missingFields} />
            <Link className="button" href="/profile">
              Complete your profile
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {topPositions.length > 0 && (
          <div className="card-transparent">
            <h2 className="text-xl font-bold">👑 You&apos;re #1 in:</h2>
            <ul>
              {topPositions.map((group) => (
                <li key={group.id}>
                  <Link
                    href={`/groups/${group.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {group.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <MyGroups groups={groups} />

        <div className="flex flex-col gap-2 items-center mt-2">
          <Link className="button-inverse" href="/attendance">
            Register attendance
          </Link>
          <Link className="button-inverse bg-yellow-600" href="/groups">
            Groups
          </Link>
        </div>
      </div>
    </div>
  );
}
