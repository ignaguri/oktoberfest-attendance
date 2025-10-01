import { notFound } from "next/navigation";

import { fetchGroupDetailsSafe, fetchGroupMembersSafe } from "./actions";
import GroupSettingsClient from "./GroupSettingsClient";

interface Props {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function GroupSettingsPage({ params }: Props) {
  const { id: groupId } = await params;

  const groupData = fetchGroupDetailsSafe(groupId);
  const membersData = fetchGroupMembersSafe(groupId);

  const [group, members] = await Promise.all([groupData, membersData]);

  if (!group) {
    notFound();
  }

  return <GroupSettingsClient group={group} members={members} />;
}
