import Link from "next/link";
import { Tables } from "@/lib/database.types";

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
          <Link
            key={group.id}
            href={`/groups/${group.id}`}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
          >
            {group.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
