"use server";

import { getProfileShort } from "@/lib/sharedActions";

import "server-only";

export async function getMissingProfileFields() {
  const profileData = await getProfileShort();

  const missingFields = {
    fullName: !profileData.full_name,
    username: !profileData.username,
    avatarUrl: !profileData.avatar_url,
  };

  return missingFields;
}
