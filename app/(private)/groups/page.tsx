import { fetchGroups } from "./actions";
import Link from "next/link";
import { CreateGroupForm } from "./CreateGroupForm";
import { JoinGroupForm } from "./JoinGroupForm";
import { Suspense } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";

export default async function GroupsPage() {
  const groups = await fetchGroups();

  return (
    <div className="max-w-lg mx-auto p-4">
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
          <section className="flex flex-col gap-8">
            <JoinGroupForm />
            <CreateGroupForm />
          </section>
        </div>
      </Suspense>
    </div>
  );
}
