import { CreateGroupForm } from "./CreateGroupForm";
import { JoinGroupForm } from "./JoinGroupForm";
import { Suspense } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import MyGroups from "@/components/MyGroups";

export default async function GroupsPage() {
  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-3xl font-bold mb-6">Groups</h1>

      <Suspense fallback={<LoadingSpinner />}>
        <div className="space-y-8">
          <MyGroups />
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
