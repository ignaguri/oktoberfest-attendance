import { fetchGroupDetails, fetchGroupMembers } from "./actions";
import GroupSettingsClient from "./GroupSettingsClient";

interface Props {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function GroupSettingsPage({ params }: Props) {
  const { id: groupId } = await params;

  const groupData = fetchGroupDetails(groupId);
  const membersData = fetchGroupMembers(groupId);

  const [group, members] = await Promise.all([groupData, membersData]);

  return <GroupSettingsClient group={group} members={members} />;
}
