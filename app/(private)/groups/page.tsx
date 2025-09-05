import LoadingSpinner from "@/components/LoadingSpinner";
import MyGroups from "@/components/MyGroups/MyGroups";
import { Separator } from "@/components/ui/separator";
import { Suspense } from "react";

import { CreateGroupForm } from "./CreateGroupForm";
import { JoinGroupForm } from "./JoinGroupForm";

export default async function GroupsPage() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Groups</h1>
      </div>

      <Suspense fallback={<LoadingSpinner />}>
        <div className="flex flex-col gap-6">
          <section className="card">
            <MyGroups showGroupsLink={false} />
          </section>
          <section className="card">
            <JoinGroupForm />
            <Separator />
            <CreateGroupForm />
          </section>
        </div>
      </Suspense>
    </div>
  );
}
