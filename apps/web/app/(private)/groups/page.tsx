import LoadingSpinner from "@/components/LoadingSpinner";
import MyGroups from "@/components/MyGroups/MyGroups";
import { Separator } from "@/components/ui/separator";
import { getTranslations } from "@/lib/i18n/server";
import { Suspense } from "react";

import { CreateGroupForm } from "./CreateGroupForm";
import { JoinGroupForm } from "./JoinGroupForm";

export default async function GroupsPage() {
  const t = getTranslations();

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("groups.pageTitle")}</h1>
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
