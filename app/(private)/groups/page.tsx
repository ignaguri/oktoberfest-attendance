import LoadingSpinner from "@/components/LoadingSpinner";
import MyGroups from "@/components/MyGroups/MyGroups";
import { Separator } from "@/components/ui/separator";
import { Suspense } from "react";

import { CreateGroupForm } from "./CreateGroupForm";
import { JoinGroupForm } from "./JoinGroupForm";

export default async function GroupsPage() {
  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-3xl font-bold mb-6">Groups</h1>

      <Suspense fallback={<LoadingSpinner />}>
        <div className="flex flex-col gap-6">
          <MyGroups />

          <Separator />

          <section className="flex flex-col gap-8">
            <JoinGroupForm />
            <CreateGroupForm />
          </section>
        </div>
      </Suspense>
    </div>
  );
}
