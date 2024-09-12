"use client";

import Link from "next/link";
import { Tables } from "@/lib/database.types";
import { Button } from "@/components/ui/button";

interface MyGroupsProps {
  groups: Tables<"groups">[];
}

export default function MyGroups({ groups }: MyGroupsProps) {
  if (!groups || groups.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Your Groups:</h2>
      <div className="flex flex-wrap gap-2 justify-center">
        {groups.map((group) => (
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
