import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import MissingFields from "./MissingFields";
import OktoberfestStatus from "./OktoberfestStatus";
import MyGroups from "@/components/MyGroups";
import { Tables } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import Highlights from "./Highlights";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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

  let missingFields: { [key: string]: string } = {};
  if (!profileData.full_name) missingFields.full_name = "Name";
  if (!profileData.username) missingFields.username = "Username";
  if (!profileData.avatar_url) missingFields.avatar_url = "Profile picture";

  return { missingFields, groups };
};

export default async function Home() {
  const { missingFields, groups } = await getProfileData();

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

      <div className="mb-4">
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>
              What can I do with Prost Counter?
            </AccordionTrigger>
            <AccordionContent className="max-w-80 mx-auto">
              <p className="text-center text-gray-600">
                Compete with friends in different groups to see who visits
                Oktoberfest more often and drinks the most!
                <br />
                Track your progress and become the ultimate Wiesnmeister.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="flex flex-col gap-4">
        <MissingFields missingFields={missingFields} />
        <Highlights groups={groups} />
        <MyGroups groups={groups} />

        <div className="flex flex-col gap-2 items-center mt-4">
          <Button asChild variant="yellow">
            <Link href="/attendance">Register attendance</Link>
          </Button>
          <Button asChild variant="darkYellow">
            <Link href="/groups">Groups</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
