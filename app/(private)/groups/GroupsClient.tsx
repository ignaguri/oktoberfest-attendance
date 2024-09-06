"use client";

import { useState, useCallback, useEffect } from "react";
import { CreateGroup } from "./CreateGroupForm";
import { JoinGroup } from "./JoinGroupForm";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchGroups } from "./helpers";
import { useSupabase } from "@/hooks/useSupabase";
import { Tables } from "@/lib/database.types";

type Group = Tables<"groups">;

type Props = {
  groups: Group[];
};

export default function GroupsClient({ groups: initialGroups }: Props) {
  const router = useRouter();
  const { supabase, user } = useSupabase();

  const [groups, setGroups] = useState<Group[]>(initialGroups);

  const fetchGroupsCallback = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      const groups = await fetchGroups(supabase, user.id);
      setGroups(groups);
    } catch (error) {
      console.error("Error fetching groups", error);
    }
  }, [supabase, user]);

  const handleOnGroupCreatedOrJoined = useCallback(
    (groupId: string) => {
      fetchGroupsCallback();
      router.push(`/groups/${groupId}`);
    },
    [fetchGroupsCallback, router],
  );

  useEffect(() => {
    if (user) {
      fetchGroupsCallback();
    }
  }, [fetchGroupsCallback, user]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Your Groups</h1>

      <div className="space-y-8">
        <div className="flex flex-wrap gap-2 justify-center">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
            >
              {group.name}
            </Link>
          ))}
        </div>

        <div className="border-t-2 border-gray-300 my-6" />

        <section className="flex flex-col gap-4">
          <JoinGroup onGroupJoined={handleOnGroupCreatedOrJoined} />
          <CreateGroup onGroupCreated={handleOnGroupCreatedOrJoined} />
        </section>
      </div>
    </div>
  );
}
