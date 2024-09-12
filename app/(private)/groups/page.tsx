import { fetchGroups } from "./actions";
import Link from "next/link";
import { CreateGroupForm } from "./CreateGroupForm";
import { JoinGroupForm } from "./JoinGroupForm";
import { Suspense } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";

export default async function GroupsPage() {
  const groups = await fetchGroups();

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-3xl font-bold mb-6">Your Groups</h1>

      <Suspense fallback={<LoadingSpinner />}>
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {groups.length === 0 && (
              <p className="text-gray-600">
                You are not a member of any group yet.
              </p>
            )}
            {groups.map((group) => (
              <Button key={group.id} asChild variant="outline">
                <Link href={`/groups/${group.id}`}>{group.name}</Link>
              </Button>
            ))}
          </div>
          <div className="border-t-2 border-gray-300 my-6" />
          <section className="flex flex-col gap-8">
            <JoinGroupForm />
            <CreateGroupForm />
          </section>
        </div>
      </Suspense>
    </div>
  );
}
