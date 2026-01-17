"use client";

import { useTransitionRouter } from "next-view-transitions";
import { use, useEffect } from "react";

import LoadingSpinner from "@/components/LoadingSpinner";
import { apiClient } from "@/lib/api-client";
import { useQuery } from "@/lib/data/react-query-provider";
import { useTranslation } from "@/lib/i18n/client";

import GroupSettingsClient from "./GroupSettingsClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default function GroupSettingsPage({ params }: Props) {
  const { t } = useTranslation();
  const { id: groupId } = use(params);
  const router = useTransitionRouter();

  const {
    data: groupResponse,
    loading: groupLoading,
    error: groupError,
  } = useQuery(["group", groupId], () => apiClient.groups.get(groupId), {
    enabled: !!groupId,
  });

  const { data: membersResponse, loading: membersLoading } = useQuery(
    ["group", groupId, "members"],
    () => apiClient.groups.getMembers(groupId),
    { enabled: !!groupId },
  );

  // Redirect to groups page if group not found or error
  useEffect(() => {
    if (!groupLoading && !groupResponse?.data && groupError) {
      router.push("/groups");
    }
  }, [groupLoading, groupResponse, groupError, router]);

  if (groupLoading || membersLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <LoadingSpinner />
        <span className="text-sm text-gray-500">
          {t("groups.settings.loading")}
        </span>
      </div>
    );
  }

  if (!groupResponse?.data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <LoadingSpinner />
        <span className="text-sm text-gray-500">
          {t("common.status.loading")}
        </span>
      </div>
    );
  }

  // Transform API response to match expected format
  // Note: API doesn't return description yet - using null for now
  const group = {
    id: groupResponse.data.id,
    name: groupResponse.data.name,
    description: null as string | null,
    created_by: groupResponse.data.createdBy,
    festival_id: groupResponse.data.festivalId,
    winning_criteria: groupResponse.data.winningCriteria,
    invite_token: groupResponse.data.inviteToken,
    created_at: groupResponse.data.createdAt,
  };

  const members = (membersResponse?.data || []).map((m) => ({
    id: m.userId,
    username: m.username,
    full_name: m.fullName,
  }));

  return <GroupSettingsClient group={group} members={members} />;
}
