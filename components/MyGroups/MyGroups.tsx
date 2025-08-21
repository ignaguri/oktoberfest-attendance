"use client";

import { Button } from "@/components/ui/button";
import { useFestival } from "@/contexts/FestivalContext";
import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";

import type { Tables } from "@/lib/database.types";

import { fetchGroups } from "./actions";

export default function MyGroups() {
  const { currentFestival } = useFestival();
  const [groups, setGroups] = useState<Tables<"groups">[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGroups = async () => {
      try {
        setLoading(true);
        const groupsData = await fetchGroups(currentFestival?.id);
        setGroups(groupsData);
      } catch (error) {
        console.error("Error fetching groups:", error);
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };

    if (currentFestival) {
      loadGroups();
    }
  }, [currentFestival]);

  if (loading) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-2">Your Groups:</h2>
        <p className="text-sm text-gray-500">Loading groups...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Your Groups:</h2>
      <div className="flex flex-wrap gap-2 justify-center">
        {groups.length === 0 && (
          <p className="text-sm text-gray-500">
            You are not a member of any group yet for this festival.
          </p>
        )}
        {groups
          .filter((group) => group && group.id)
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
