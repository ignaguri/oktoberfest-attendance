"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { GroupWithMembers } from "@prostcounter/shared/schemas";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";
import { SkeletonGroups } from "@/components/ui/skeleton-cards";
import { useUserGroups } from "@/lib/data";

interface MyGroupsProps {
  showGroupsLink?: boolean;
}

export default function MyGroups({ showGroupsLink = true }: MyGroupsProps) {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const {
    data: groups = [],
    loading,
    error,
  } = useUserGroups(currentFestival?.id) as {
    data: GroupWithMembers[];
    loading: boolean;
    error: Error | null;
  };

  if (loading) {
    return <SkeletonGroups />;
  }

  return (
    <div className="min-h-[120px]">
      <h2 className="mb-2 text-xl font-bold">{t("groups.yourGroups")}</h2>
      <div className="flex flex-wrap justify-center gap-2">
        {(error || !groups || groups.length === 0) && (
          <div className="px-2 text-center">
            <p className="mb-2 text-sm text-gray-500">
              {t("groups.noGroupsYet")}
            </p>
            {showGroupsLink && (
              <Button asChild variant="yellow" size="sm">
                <Link href="/groups">{t("groups.joinOrCreate")}</Link>
              </Button>
            )}
          </div>
        )}
        {groups
          ?.filter((group) => group && group.id)
          .map((group) => (
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
