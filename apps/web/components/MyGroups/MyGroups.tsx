"use client";

import { Button } from "@/components/ui/button";
import { SkeletonGroups } from "@/components/ui/skeleton-cards";
import { useFestival } from "@/contexts/FestivalContext";
import { useUserGroups } from "@/lib/data";
import { Link } from "next-view-transitions";

import type { GroupWithMembers } from "@prostcounter/shared/schemas";

interface MyGroupsProps {
  showGroupsLink?: boolean;
}

export default function MyGroups({ showGroupsLink = true }: MyGroupsProps) {
  const { currentFestival } = useFestival();
  const {
    data: groups = [],
    loading,
    error,
  } = useUserGroups(currentFestival?.id) as {
    data: GroupWithMembers[];
    loading: boolean;
    error: Error | null;
  };

  if (loading) {
    return <SkeletonGroups />;
  }

  return (
    <div className="min-h-[120px]">
      <h2 className="text-xl font-bold mb-2">Your Groups:</h2>
      <div className="flex flex-wrap gap-2 justify-center">
        {(error || !groups || groups.length === 0) && (
          <div className="px-2 text-center">
            <p className="text-sm text-gray-500 mb-2">
              You are not a member of any group yet for this festival.
            </p>
            {showGroupsLink && (
              <Button asChild variant="yellow" size="sm">
                <Link href="/groups">Join or Create a Group</Link>
              </Button>
            )}
          </div>
        )}
        {groups
          ?.filter((group) => group && group.id)
          .map((group) => (
            <Button key={group.id} asChild variant="outline">
              <Link
                href={`/groups/${group.id}`}
                className="inline-flex items-center justify-center"
              >
                {group.name}
              </Link>
            </Button>
          ))}
      </div>
    </div>
  );
}
