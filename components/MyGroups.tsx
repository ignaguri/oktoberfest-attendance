import { Button } from "@/components/ui/button";
import { fetchGroups } from "@/lib/actions";
import { Link } from "next-view-transitions";

export default async function MyGroups() {
  const groups = await fetchGroups();

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Your Groups:</h2>
      <div className="flex flex-wrap gap-2 justify-center">
        {groups.length === 0 && (
          <p className="text-sm text-gray-500">
            You are not a member of any group yet.
          </p>
        )}
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
