import LoadingSpinner from "@/components/LoadingSpinner";
import MyGroups from "@/components/MyGroups/MyGroups";
import { FestivalSelector } from "@/components/FestivalSelector";
import { Separator } from "@/components/ui/separator";
import { Suspense } from "react";

import { CreateGroupForm } from "./CreateGroupForm";
import { JoinGroupForm } from "./JoinGroupForm";

export default async function GroupsPage() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Groups</h1>
        <FestivalSelector />
      </div>

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
