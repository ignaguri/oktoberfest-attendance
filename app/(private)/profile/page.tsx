import LoadingSpinner from "@/components/LoadingSpinner";
import { getProfileShort, getUser } from "@/lib/sharedActions";

import AccountForm from "./AccountForm";

export default async function ProfilePage() {
  const userData = getUser();
  const profileData = getProfileShort();

  const [user, profile] = await Promise.all([userData, profileData]);

  if (!user || !profile) {
    return <LoadingSpinner />;
  }

  return <AccountForm user={user} profile={profile} />;
}
