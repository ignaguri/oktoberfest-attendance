/**
 * Admin Screens Layout
 *
 * Guards the admin stack on the client. This is presentation only -- the real
 * enforcement is the requireAdmin middleware on every /v1/admin/* endpoint, so
 * a non-admin who reaches these routes anyway gets empty screens and 403s
 * rather than data.
 */

import { useTranslation } from "@prostcounter/shared/i18n";
import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/lib/auth/AuthContext";
import { useAdaptedProfile } from "@/lib/database/adapted-hooks";
import { defaultScreenOptions } from "@/lib/navigation/header-config";

export default function AdminLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: profile, loading } = useAdaptedProfile(user?.id);

  // Wait for the local profile read before deciding -- redirecting on the first
  // render would bounce admins out of a deep link before the flag is known.
  if (loading) {
    return null;
  }

  if (!profile?.is_super_admin) {
    return <Redirect href="/(tabs)/profile" />;
  }

  return (
    <Stack screenOptions={defaultScreenOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: t("admin.pageTitle"),
        }}
      />
      <Stack.Screen
        name="users"
        options={{
          title: t("admin.tabs.users"),
        }}
      />
      <Stack.Screen
        name="user/[id]"
        options={{
          title: t("admin.mobile.userDetail.title"),
        }}
      />
      <Stack.Screen
        name="groups"
        options={{
          title: t("admin.tabs.groups"),
        }}
      />
      <Stack.Screen
        name="group/[id]"
        options={{
          title: t("admin.mobile.groupDetail.title"),
        }}
      />
      <Stack.Screen
        name="location"
        options={{
          title: t("admin.location.title"),
        }}
      />
    </Stack>
  );
}
