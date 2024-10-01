import { fetchGroupDetails, fetchGroupMembers } from "./actions";
import GroupSettingsClient from "./GroupSettingsClient";

export default async function GroupSettingsPage({
  params,
}: {
  params: { id: string };
}) {
  const groupId = params.id;

  const groupData = fetchGroupDetails(groupId);
  const membersData = fetchGroupMembers(groupId);

  const [group, members] = await Promise.all([groupData, membersData]);

  return <GroupSettingsClient group={group} members={members} />;
}
